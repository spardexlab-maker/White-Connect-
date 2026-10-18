import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';

/**
 * Device-local medication reminders. The server keeps the authoritative
 * plan (my_medication_plans); the phone schedules local notifications for
 * the upcoming doses so a reminder still fires without network.
 * Lock-screen text is generic — it never names the medicine (§ privacy).
 */
const FLAG = 'reminders.enabled';
const PREFIX = 'dose:';
const MAX = 50; // iOS keeps at most 64 pending local notifications

export interface UpcomingDose { id: string; scheduled_at: string; dose_status: string | null }

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

export async function remindersEnabled(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  return (await SecureStore.getItemAsync(FLAG)) === '1';
}

/** Ask permission (only after the patient taps "enable"). */
export async function enableReminders(): Promise<'granted' | 'denied' | 'unsupported'> {
  if (Platform.OS === 'web') return 'unsupported';
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('medication', {
      name: 'تذكير الدواء', importance: Notifications.AndroidImportance.HIGH, lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  const res = current.granted ? current : await Notifications.requestPermissionsAsync();
  if (!res.granted) return 'denied';
  await SecureStore.setItemAsync(FLAG, '1');
  return 'granted';
}

export async function disableReminders(): Promise<void> {
  if (Platform.OS === 'web') return;
  await SecureStore.deleteItemAsync(FLAG);
  await cancelAllReminders();
}

export async function cancelAllReminders(): Promise<void> {
  if (Platform.OS === 'web') return;
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(pending.filter((n) => n.identifier.startsWith(PREFIX)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
}

/** Replace all scheduled dose notifications with the given upcoming doses. */
export async function syncReminders(doses: UpcomingDose[]): Promise<number> {
  if (!(await remindersEnabled())) return 0;
  await cancelAllReminders();
  const now = Date.now();
  const upcoming = doses
    .filter((d) => !d.dose_status && new Date(d.scheduled_at).getTime() > now + 30_000)
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
    .slice(0, MAX);
  for (const d of upcoming) {
    await Notifications.scheduleNotificationAsync({
      identifier: `${PREFIX}${d.id}`,
      content: { title: 'تذكير', body: 'حان موعد دوائك. افتح التطبيق لتسجيل الجرعة.', data: { url: '/meds' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(d.scheduled_at), channelId: 'medication' },
    });
  }
  return upcoming.length;
}
