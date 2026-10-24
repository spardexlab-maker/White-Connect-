// notifications-worker — short-lived consumer of public.notification_outbox.
// Invoked every minute by pg_cron + pg_net (see docs/OPERATIONS.md) with a
// shared secret header. Claims a batch with FOR UPDATE SKIP LOCKED
// (outbox_claim), delivers, and records the outcome (outbox_complete),
// which is idempotent and applies retry/backoff/dead-letter.
// No third-party imports: talks to PostgREST RPC endpoints directly.
import { render } from './templates.ts';
import { ensureVapid, providerFor } from './providers.ts';

const SECRET = Deno.env.get('WORKER_SHARED_SECRET');
const URL_ = Deno.env.get('SUPABASE_URL')!;
const KEY = Deno.env.get('APP_SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface OutboxRow {
  id: string; recipient_user_id: string; channel: 'in_app' | 'push' | 'sms' | 'email';
  template: string; payload: Record<string, unknown> | null;
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${URL_}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`${fn}_${res.status}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

Deno.serve(async (req) => {
  if (!SECRET || req.headers.get('x-worker-secret') !== SECRET) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }
  // make sure browsers can subscribe (the public key is read by web_push_public_key)
  await ensureVapid(rpc).catch((e) => console.error(JSON.stringify({ event: 'vapid_failed', error: String(e) })));
  let batch: OutboxRow[];
  try {
    batch = await rpc<OutboxRow[]>('outbox_claim', { p_limit: 50, p_lease_seconds: 60 });
  } catch (e) {
    console.error(JSON.stringify({ event: 'claim_failed', error: String(e) }));
    return new Response(JSON.stringify({ error: 'claim_failed' }), { status: 500 });
  }

  let sent = 0, failed = 0;
  for (const row of batch ?? []) {
    const msg = render(row.template, row.payload ?? {});
    let ok = true;
    let err: string | undefined;
    if (row.channel !== 'in_app') {
      const res = await providerFor(row.channel, rpc).send(row.recipient_user_id, msg, row.template);
      ok = res.ok; err = res.error;
    }
    try {
      await rpc('outbox_complete', {
        p_id: row.id, p_success: ok, p_error: err ?? null,
        p_inbox_title: msg.title, p_inbox_body: msg.body, p_inbox_link: msg.link,
      });
      if (ok) sent++; else failed++;
    } catch {
      failed++; // lease expires and the row is re-claimed later; completion is idempotent
    }
  }
  // identifiers and counts only — no health information in logs
  console.log(JSON.stringify({ event: 'batch_done', claimed: batch?.length ?? 0, sent, failed }));
  return new Response(JSON.stringify({ claimed: batch?.length ?? 0, sent, failed }), { headers: { 'content-type': 'application/json' } });
});
