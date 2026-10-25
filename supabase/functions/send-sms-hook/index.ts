// send-sms-hook — Supabase Auth «Send SMS» hook: Auth makes the 6-digit code, this
// function delivers it on WhatsApp. The provider is chosen by OTP_PROVIDER:
//   otpiq (default, now) — OTPIQ's own sender, no WhatsApp number of ours needed;
//   meta (later)          — our WhatsApp Business number on Meta's Cloud API.
// Every send is first checked by public.otp_send_allowed (per-number and per-hour caps).
// Signed by Auth with the hook secret (Standard Webhooks); no third-party imports.
import { deliver } from './providers.ts';

const SECRET = Deno.env.get('SEND_SMS_HOOK_SECRET') ?? '';
const URL_ = Deno.env.get('SUPABASE_URL')!;
const KEY = Deno.env.get('APP_SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Auth reads the error only from a 200 reply (other statuses become a generic failure);
// http_code is what the app then receives, message carries our code for errorMessage().
const fail = (status: number, code: string) =>
  new Response(JSON.stringify({ error: { http_code: status, message: `app:${code}` } }), { status: 200, headers: { 'content-type': 'application/json' } });

/** Standard Webhooks: base64(HMAC-SHA256(secret, `${id}.${timestamp}.${body}`)), within 5 minutes. */
async function verified(req: Request, body: string): Promise<boolean> {
  const id = req.headers.get('webhook-id'), ts = req.headers.get('webhook-timestamp'), sigs = req.headers.get('webhook-signature');
  if (!SECRET || !id || !ts || !sigs) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const raw = Uint8Array.from(atob(SECRET.replace(/^v1,whsec_/, '').replace(/^whsec_/, '')), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${ts}.${body}`)));
  const expected = btoa(String.fromCharCode(...mac));
  return sigs.split(' ').some((s) => s.split(',')[1] === expected);
}

Deno.serve(async (req) => {
  const body = await req.text();
  if (!(await verified(req, body))) return new Response('{}', { status: 401 });
  let phone = '', otp = '';
  try {
    const p = JSON.parse(body) as { user?: { phone?: string }; sms?: { otp?: string } };
    phone = (p.user?.phone ?? '').replace(/\D/g, ''); otp = p.sms?.otp ?? '';
  } catch { return fail(400, 'otp_send_failed'); }

  const check = await fetch(`${URL_}/rest/v1/rpc/otp_send_allowed`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_phone: phone }),
  });
  const verdict = check.ok ? ((await check.json()) as string) : 'otp_unavailable';
  if (verdict !== 'ok') return fail(verdict === 'otp_rate_limited' ? 429 : 400, verdict);

  const r = await deliver(phone, otp);
  // identifiers only — never the code; the number is cut to its last 3 digits
  console.log(JSON.stringify({ event: 'otp_send', provider: r.provider, ok: r.ok, error: r.error ?? null, to: `…${phone.slice(-3)}` }));
  if (!r.ok) return fail(r.status ?? 502, r.code ?? 'otp_send_failed');
  return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
});
