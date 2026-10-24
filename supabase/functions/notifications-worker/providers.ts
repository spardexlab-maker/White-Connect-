// Delivery providers. Push is real (FCM for Android phones, Web Push for
// browsers); SMS/email need real accounts and keys — until configured they
// report "not configured" instead of pretending to send.
import type { Rendered } from './templates.ts';
import { fcmAccount, newVapid, sendFcm, sendWeb, type PushTarget, type SendResult, type Vapid } from './push.ts';

export interface DeliveryResult { ok: boolean; error?: string }
export interface Provider { send(userId: string, msg: Rendered, template: string): Promise<DeliveryResult> }
export type Rpc = <T>(fn: string, args: Record<string, unknown>) => Promise<T>;

class NotConfigured implements Provider {
  channel: string;
  constructor(channel: string) { this.channel = channel; }
  async send(): Promise<DeliveryResult> { return { ok: false, error: `${this.channel}_provider_not_configured` }; }
}

/** Development-only mock: logs identifiers, never message content. */
class MockProvider implements Provider {
  channel: string;
  constructor(channel: string) { this.channel = channel; }
  async send(userId: string): Promise<DeliveryResult> {
    console.log(JSON.stringify({ event: 'mock_delivery', channel: this.channel, user: userId.slice(0, 8) }));
    return { ok: true };
  }
}

let vapid: Vapid | null = null;
/** The VAPID key pair from Vault; made on the very first run. */
export async function ensureVapid(rpc: Rpc): Promise<Vapid> {
  if (vapid) return vapid;
  vapid = await rpc<Vapid | null>('push_vapid', {});
  if (!vapid) vapid = await rpc<Vapid>('push_store_vapid', { p_value: await newVapid('https://white-connect.vercel.app') });
  return vapid;
}

class PushProvider implements Provider {
  rpc: Rpc;
  constructor(rpc: Rpc) { this.rpc = rpc; }
  async send(userId: string, msg: Rendered, template: string): Promise<DeliveryResult> {
    let targets = await this.rpc<PushTarget[]>('push_targets', { p_user_id: userId });
    // a phone that rings each dose from its own schedule is skipped (no double ring)
    if (template === 'medication.reminder') targets = targets.filter((t) => t.kind === 'web' || !t.local_reminders);
    if (!targets.length) return { ok: true };          // nowhere to deliver: the in-app inbox has it
    const sa = fcmAccount();
    let delivered = 0, lastError: string | undefined;
    for (const t of targets) {
      let r: SendResult;
      try {
        r = t.kind === 'fcm'
          ? (sa ? await sendFcm(sa, t.token, msg) : { ok: false, error: 'fcm_not_configured' })
          : await sendWeb(await ensureVapid(this.rpc), t, msg);
      } catch (e) {
        r = { ok: false, error: String(e).slice(0, 80) };
      }
      if (r.ok) delivered++; else lastError = r.error;
      if (r.ok || r.gone || r.error !== 'fcm_not_configured') {
        await this.rpc('push_device_result', { p_id: t.id, p_ok: r.ok, p_gone: !!r.gone }).catch(() => undefined);
      }
    }
    // one device reached is a delivery (retrying would ring the others twice)
    return delivered ? { ok: true } : { ok: false, error: lastError };
  }
}

export function providerFor(channel: 'push' | 'sms' | 'email', rpc: Rpc): Provider {
  const configured = Deno.env.get(`${channel.toUpperCase()}_PROVIDER`);
  const isDev = Deno.env.get('APP_ENV') === 'development';
  if (configured === 'mock' && isDev) return new MockProvider(channel);
  if (channel === 'push') return new PushProvider(rpc);
  return new NotConfigured(channel);
}
