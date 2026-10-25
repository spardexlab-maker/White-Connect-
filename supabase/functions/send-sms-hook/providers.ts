// WhatsApp code delivery. Switching to Meta later is a secret change, not a code change:
// OTP_PROVIDER=meta plus META_WA_TOKEN, META_WA_PHONE_ID, META_WA_TEMPLATE (an approved
// AUTHENTICATION template with a copy-code button) and optionally META_WA_LANG (default ar).

export interface Sent { ok: boolean; provider: string; error?: string; code?: string; status?: number }

const env = (k: string) => Deno.env.get(k) ?? '';

/** OTPIQ — https://docs.otpiq.com/api-reference/messaging/post */
async function otpiq(phone: string, otp: string): Promise<Sent> {
  const key = env('OTPIQ_API_KEY');
  if (!key) return { ok: false, provider: 'otpiq', error: 'not_configured', code: 'otp_unavailable', status: 400 };
  const r = await fetch('https://api.otpiq.com/api/sms', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber: phone, smsType: 'verification', verificationCode: otp, provider: env('OTPIQ_CHANNEL') || 'whatsapp' }),
  });
  if (r.ok) { await r.body?.cancel(); return { ok: true, provider: 'otpiq' }; }
  const text = await r.text();
  if (r.status === 429) return { ok: false, provider: 'otpiq', error: 'rate_limited', code: 'otp_rate_limited', status: 429 };
  // no credit / trial mode / spending cap are ours to fix, not the patient's
  const ours = r.status === 401 || /credit|trial|threshold/i.test(text);
  // OTPIQ's own reason (e.g. trial mode, no credit), digits masked so no number reaches the logs
  const reason = text.slice(0, 160).replace(/\d{6,}/g, '…');
  return { ok: false, provider: 'otpiq', error: `otpiq_${r.status}${ours ? '_account' : ''}: ${reason}`, code: ours ? 'otp_unavailable' : 'otp_send_failed', status: 400 };
}

/** Meta WhatsApp Cloud API — authentication template, the code in the body and the copy button. */
async function meta(phone: string, otp: string): Promise<Sent> {
  const token = env('META_WA_TOKEN'), phoneId = env('META_WA_PHONE_ID'), template = env('META_WA_TEMPLATE');
  if (!token || !phoneId || !template) return { ok: false, provider: 'meta', error: 'not_configured', code: 'otp_unavailable', status: 400 };
  const r = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp', to: phone, type: 'template',
      template: {
        name: template, language: { code: env('META_WA_LANG') || 'ar' },
        components: [
          { type: 'body', parameters: [{ type: 'text', text: otp }] },
          { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: otp }] },
        ],
      },
    }),
  });
  if (r.ok) { await r.body?.cancel(); return { ok: true, provider: 'meta' }; }
  const text = await r.text();
  const ours = r.status === 401 || /OAuthException|payment|template/i.test(text);
  return { ok: false, provider: 'meta', error: `meta_${r.status}`, code: ours ? 'otp_unavailable' : 'otp_send_failed', status: 400 };
}

export function deliver(phone: string, otp: string): Promise<Sent> {
  return env('OTP_PROVIDER') === 'meta' ? meta(phone, otp) : otpiq(phone, otp);
}
