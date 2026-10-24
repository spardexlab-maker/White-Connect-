import { supabase } from './supabase';

/** Browser notifications (Web Push): the service worker shows them even when the site is closed. */
export type PushState = 'unsupported' | 'denied' | 'off' | 'on';

const supported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const fromB64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

async function registration() {
  return (await navigator.serviceWorker.getRegistration('/')) ?? navigator.serviceWorker.register('/sw.js', { scope: '/' });
}

export async function pushState(): Promise<PushState> {
  if (!supported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

/** Ask permission (after a tap), subscribe, and register this browser for the signed-in user. */
export async function enablePush(): Promise<PushState> {
  if (!supported()) return 'unsupported';
  if ((await Notification.requestPermission()) !== 'granted') return Notification.permission === 'denied' ? 'denied' : 'off';
  const { data: key, error } = await supabase.rpc('web_push_public_key');
  if (error || !key) throw new Error('push_not_ready');
  const reg = await registration();
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription())
    ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromB64u(String(key)) });
  await saveSubscription(sub);
  return 'on';
}

export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await supabase.rpc('unregister_push_device', { p_token: sub.endpoint });
  await sub.unsubscribe();
}

async function saveSubscription(sub: PushSubscription) {
  const j = sub.toJSON() as { endpoint: string; keys?: { p256dh: string; auth: string } };
  const ua = navigator.userAgent;
  const platform = /Edg\//.test(ua) ? 'edge' : /Firefox\//.test(ua) ? 'firefox' : /Safari\//.test(ua) && !/Chrome\//.test(ua) ? 'safari' : 'chrome';
  const { error } = await supabase.rpc('register_push_device', { p_kind: 'web', p_token: j.endpoint, p_platform: platform, p_web_keys: j.keys ?? {} });
  if (error) throw error;
}

/** After sign-in: if this browser was already allowed, keep its subscription tied to the current user. */
export async function refreshPush(): Promise<void> {
  if (!supported() || Notification.permission !== 'granted') return;
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = await reg?.pushManager.getSubscription();
  if (sub) await saveSubscription(sub).catch(() => undefined);
}
