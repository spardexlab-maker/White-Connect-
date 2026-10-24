import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { supabase } from './supabase';
import { enableReminders, remindersEnabled } from './reminders';
import { resyncDoses } from './doseActions';

/**
 * Server push on Android (Firebase Cloud Messaging): appointment changes,
 * results, prescriptions — even when the app is closed. Medication reminders
 * stay local (reminders.ts), so the phone never rings twice for one dose.
 * iPhone builds without a paid Apple account cannot receive server push.
 */
const ASKED = 'push.asked';

async function channel() {
  await Notifications.setNotificationChannelAsync('general', {
    name: 'المواعيد والنتائج', importance: Notifications.AndroidImportance.HIGH,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
  });
}

/** After sign-in: ask once; then medicine reminders ring from the phone's own schedule
 *  (also offline), and on Android the FCM token is registered for everything else. */
export async function registerPhonePush(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    if (Platform.OS === 'android') await channel();
    let perm = await Notifications.getPermissionsAsync();
    if (!perm.granted && (await SecureStore.getItemAsync(ASKED)) !== '1') {
      await SecureStore.setItemAsync(ASKED, '1');
      perm = await Notifications.requestPermissionsAsync();
    }
    if (!perm.granted) return;
    if (await remindersEnabled()) { await enableReminders(); await resyncDoses(); }
    if (Platform.OS !== 'android') return;
    const tok = await Notifications.getDevicePushTokenAsync();   // fails on builds without Firebase — fine
    if (typeof tok.data === 'string' && tok.data) {
      await supabase.rpc('register_push_device', { p_kind: 'fcm', p_token: tok.data, p_platform: 'android' });
      await reportLocalReminders();
    }
  } catch { /* older app build without Firebase: local reminders keep working */ }
}

/** Tell the server whether this phone rings doses itself (then it sends no medicine push here). */
export async function reportLocalReminders(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const tok = await Notifications.getDevicePushTokenAsync();
    if (typeof tok.data === 'string') await supabase.rpc('set_push_device_local_reminders', { p_token: tok.data, p_on: await remindersEnabled() });
  } catch { /* no Firebase on this build */ }
}

/** Before sign-out: stop this phone receiving the account's notifications. */
export async function unregisterPhonePush(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const tok = await Notifications.getDevicePushTokenAsync();
    if (typeof tok.data === 'string') await supabase.rpc('unregister_push_device', { p_token: tok.data });
  } catch { /* nothing registered */ }
}

/** Keep the server in step when Firebase rotates the token. */
export function watchPushToken(): () => void {
  if (Platform.OS !== 'android') return () => undefined;
  const sub = Notifications.addPushTokenListener((t) => {
    if (typeof t.data === 'string') void supabase.rpc('register_push_device', { p_kind: 'fcm', p_token: t.data, p_platform: 'android' });
  });
  return () => sub.remove();
}

/** Web links in notifications → the app's screens. */
const ROUTES: [RegExp, string][] = [
  [/^\/patient\/appointments/, '/(tabs)/appointments'],
  [/^\/patient\/meds/, '/meds'],
  [/^\/patient\/home-lab/, '/home-lab'],
  [/^\/patient\/lab-orders/, '/lab-orders'],
  [/^\/patient\/labs\/(.+)/, '/lab/$1'],
  [/^\/patient\/rx\/(.+)/, '/rx/$1'],
  [/^\/patient\/(journey|health)/, '/(tabs)/$1'],
];

/** A tap on a server notification; true when it was one (not a dose reminder). */
export function openPushLink(r: Notifications.NotificationResponse): boolean {
  const req = r.notification.request;
  const remote = (req.trigger as { remoteMessage?: { data?: Record<string, string> } } | null)?.remoteMessage?.data;
  const link = (req.content.data as { link?: string } | undefined)?.link ?? remote?.link;
  if (typeof link !== 'string') return false;
  const hit = ROUTES.find(([re]) => re.test(link));
  router.push((hit ? link.replace(hit[0], hit[1]) : '/(tabs)/notifications') as never);
  return true;
}
