// Push delivery without third-party imports:
//  * Android: FCM HTTP v1, OAuth token signed (RS256) with the service account
//    in the edge secret FCM_SERVICE_ACCOUNT (pasted by the owner in the dashboard);
//  * browsers: Web Push — VAPID (ES256) + aes128gcm payload encryption (RFC 8291).
//    The VAPID key pair is created on first use and kept in Vault.
import type { Rendered } from './templates.ts';

const te = new TextEncoder();
const b64u = (b: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};

export interface PushTarget { id: string; kind: 'fcm' | 'web'; token: string; web_keys: { p256dh: string; auth: string } | null }
export interface SendResult { ok: boolean; gone?: boolean; error?: string }

// ---------------------------------------------------------------- FCM
interface ServiceAccount { project_id: string; client_email: string; private_key: string; token_uri?: string }
let fcmToken: { value: string; exp: number } | null = null;

export function fcmAccount(): ServiceAccount | null {
  const raw = Deno.env.get('FCM_SERVICE_ACCOUNT');
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw) as ServiceAccount;
    return sa.project_id && sa.client_email && sa.private_key ? sa : null;
  } catch { return null; }
}

async function fcmAccessToken(sa: ServiceAccount): Promise<string> {
  if (fcmToken && fcmToken.exp > Date.now() + 60_000) return fcmToken.value;
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const key = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const now = Math.floor(Date.now() / 1000);
  const aud = sa.token_uri ?? 'https://oauth2.googleapis.com/token';
  const unsigned = `${b64u(te.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })))}.${b64u(te.encode(JSON.stringify({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud, iat: now, exp: now + 3600 })))}`;
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, te.encode(unsigned));
  const r = await fetch(aud, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${unsigned}.${b64u(sig)}`,
  });
  if (!r.ok) throw new Error(`fcm_oauth_${r.status}`);
  const j = await r.json() as { access_token: string; expires_in: number };
  fcmToken = { value: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return j.access_token;
}

export async function sendFcm(sa: ServiceAccount, token: string, msg: Rendered): Promise<SendResult> {
  const r = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await fcmAccessToken(sa)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: {
      token,
      notification: { title: msg.title, body: msg.body },
      data: { link: msg.link ?? '' },
      android: { priority: 'HIGH', notification: { channel_id: 'general', sound: 'default' } },
    } }),
  });
  if (r.ok) return { ok: true };
  const text = await r.text();
  const gone = r.status === 404 || /UNREGISTERED|registration-token-not-registered|not a valid FCM registration token/i.test(text);
  return { ok: false, gone, error: `fcm_${r.status}` };
}

// ---------------------------------------------------------------- Web Push
export interface Vapid { public_key: string; private_jwk: JsonWebKey; subject: string }

export async function newVapid(subject: string): Promise<Vapid> {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
  return {
    public_key: b64u(await crypto.subtle.exportKey('raw', kp.publicKey)),
    private_jwk: await crypto.subtle.exportKey('jwk', kp.privateKey),
    subject,
  };
}

async function vapidAuth(v: Vapid, endpoint: string): Promise<string> {
  const key = await crypto.subtle.importKey('jwk', v.private_jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const unsigned = `${b64u(te.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))}.${b64u(te.encode(JSON.stringify({
    aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: v.subject })))}`;
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, te.encode(unsigned));
  return `vapid t=${unsigned}.${b64u(sig)}, k=${v.public_key}`;
}

const hkdf = async (salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number) =>
  new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info },
    await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']), bytes * 8));

/** RFC 8291 (aes128gcm) — one record. */
export async function encryptWebPush(payload: Uint8Array, p256dh: string, auth: string, salt = crypto.getRandomValues(new Uint8Array(16))) {
  const uaPublic = unb64u(p256dh);
  const as = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair;
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey));
  const ua = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: ua }, as.privateKey, 256));
  const ikm = await hkdf(unb64u(auth), shared, concat(te.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const cek = await hkdf(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(payload, new Uint8Array([2]))));
  const header = new Uint8Array(21 + asPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = asPublic.length;
  header.set(asPublic, 21);
  return concat(header, cipher);
}

export async function sendWeb(v: Vapid, t: PushTarget, msg: Rendered): Promise<SendResult> {
  if (!t.web_keys) return { ok: false, gone: true, error: 'web_keys_missing' };
  const body = await encryptWebPush(te.encode(JSON.stringify({ title: msg.title, body: msg.body, link: msg.link })), t.web_keys.p256dh, t.web_keys.auth);
  const r = await fetch(t.token, {
    method: 'POST',
    headers: { Authorization: await vapidAuth(v, t.token), 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '86400', Urgency: 'high' },
    body,
  });
  await r.body?.cancel();
  if (r.ok) return { ok: true };
  return { ok: false, gone: r.status === 404 || r.status === 410, error: `web_${r.status}` };
}
