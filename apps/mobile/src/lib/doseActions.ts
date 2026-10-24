import { Alert, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { errorMessage } from '@app/shared';
import { supabase } from './supabase';
import { doseLabel, syncFromServer } from './reminders';
import { openPushLink } from './push';

const handled = new Set<string>();
export const resyncDoses = () => syncFromServer(() => supabase.rpc('my_upcoming_doses', { p_hours: 72 }));

/** A tap on a medication reminder or on one of its buttons («أخذتها ✓» / «ذكرني بعد 15 د»). */
export async function handleDoseResponse(r: Notifications.NotificationResponse): Promise<void> {
  if (Platform.OS === 'web') return;
  const data = r.notification.request.content.data as { jobId?: string; url?: string } | undefined;
  const key = `${r.notification.request.identifier}:${r.actionIdentifier}`;
  if (handled.has(key)) return;
  handled.add(key);
  if (!data?.jobId && openPushLink(r)) return;
  if (!data?.jobId) { if (data?.url === '/meds') router.push('/meds'); return; }

  if (r.actionIdentifier === 'taken' || r.actionIdentifier === 'snooze') {
    const { data: res, error } = await supabase.rpc('log_dose', { p_job_id: data.jobId, p_status: r.actionIdentifier === 'taken' ? 'taken' : 'snoozed' });
    await Notifications.dismissNotificationAsync(r.notification.request.identifier).catch(() => undefined);
    void resyncDoses();
    if (error) { Alert.alert('تعذّر التسجيل', errorMessage(error)); return; }
    const d = res as { display_name?: string; dose_amount?: number | null; dose_unit?: string | null } | null;
    Alert.alert(r.actionIdentifier === 'taken' ? 'سُجلت الجرعة ✓' : 'تم التأجيل',
      r.actionIdentifier === 'taken' ? `${d?.display_name ?? ''} ${doseLabel(d?.dose_amount, d?.dose_unit)}`.trim() + ' — يظهر لطبيبك.' : 'نذكّرك بعد 15 دقيقة.');
    return;
  }
  router.push('/meds');
}
