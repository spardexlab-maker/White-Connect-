import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';

/**
 * Device-local medication reminders. The server keeps the authoritative
 * plan; the phone schedules local notifications for the next days of doses
 * (my_upcoming_doses) so a reminder still fires without network.
 * Each reminder carries «أخذتها ✓» / «ذكرني بعد 15 د» buttons that log the
 * dose for that exact job. The medicine name is in the body; the channel is
 * PRIVATE on Android and iOS hides previews on a locked phone by default,
 * so the name is not shown on the lock screen.
 */
const FLAG = 'reminders.enabled';
const PREFIX = 'dose:';
const MAX = 50; // iOS keeps at most 64 pending local notifications

export interface UpcomingDose { id: string; scheduled_at: string; dose_status: string | null; display_name?: string; dose?: number | null; dose_unit?: string | null }
export const DOSE_CATEGORY = 'dose';

async function ensureCategory() {
  await Notifications.setNotificationCategoryAsync(DOSE_CATEGORY, [
    { identifier: 'taken', buttonTitle: 'أخذتها ✓', options: { opensAppToForeground: true } },
    { identifier: 'snooze', buttonTitle: 'ذكرني بعد 15 د', options: { opensAppToForeground: true } },
  ]);
}

/** «1 كبسولة» / «2 قرص» — the prescribed amount per intake. */
export const doseLabel = (dose?: number | null, unit?: string | null) => (dose ? `${Number(dose)} ${unit ?? ''}`.trim() : '');

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
  await ensureCategory();
  await cancelAllReminders();
  const now = Date.now();
  const upcoming = doses
    .filter((d) => !d.dose_status && new Date(d.scheduled_at).getTime() > now + 30_000)
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
    .slice(0, MAX);
  for (const d of upcoming) {
    await Notifications.scheduleNotificationAsync({
      identifier: `${PREFIX}${d.id}`,
      content: {
        title: 'حان موعد الدواء 💊',
        body: d.display_name ? `${d.display_name}${doseLabel(d.dose, d.dose_unit) ? ` — ${doseLabel(d.dose, d.dose_unit)}` : ''}` : 'حان موعد دوائك.',
        data: { url: '/meds', jobId: d.id },
        categoryIdentifier: DOSE_CATEGORY,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(d.scheduled_at), channelId: 'medication' },
    });
  }
  return upcoming.length;
}

/** Fetches the next 3 days of doses from the server and schedules them on the phone. */
export async function syncFromServer(rpc: () => PromiseLike<{ data: unknown; error: unknown }>): Promise<number> {
  if (Platform.OS === 'web' || !(await remindersEnabled())) return 0;
  const { data, error } = await rpc();
  if (error || !Array.isArray(data)) return 0;
  return syncReminders(data as UpcomingDose[]);
}
