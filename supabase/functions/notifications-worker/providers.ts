// Delivery providers. Push/SMS/email need real accounts and keys; until
// configured they report "not configured" instead of pretending to send.
import type { Rendered } from './templates.ts';

export interface DeliveryResult { ok: boolean; error?: string }
export interface Provider { send(userId: string, msg: Rendered): Promise<DeliveryResult> }

class NotConfigured implements Provider {
  constructor(private channel: string) {}
  async send(): Promise<DeliveryResult> { return { ok: false, error: `${this.channel}_provider_not_configured` }; }
}

/** Development-only mock: logs identifiers, never message content. */
class MockProvider implements Provider {
  constructor(private channel: string) {}
  async send(userId: string): Promise<DeliveryResult> {
    console.log(JSON.stringify({ event: 'mock_delivery', channel: this.channel, user: userId.slice(0, 8) }));
    return { ok: true };
  }
}

export function providerFor(channel: 'push' | 'sms' | 'email'): Provider {
  const configured = Deno.env.get(`${channel.toUpperCase()}_PROVIDER`);
  const isDev = Deno.env.get('APP_ENV') === 'development';
  if (configured === 'mock' && isDev) return new MockProvider(channel);
  // Real providers (FCM / Expo / SMS gateway / SMTP) plug in here (Phase 5).
  return new NotConfigured(channel);
}
