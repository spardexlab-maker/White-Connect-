import { useState } from 'react';
import { router } from 'expo-router';
import { errorMessage, reminderIntervals, timesEvery } from '@app/shared';
import { supabase } from '../lib/supabase';
import { enableReminders } from '../lib/reminders';
import { Alert, Button, Card, Chip, Field, Row, Stack, Text } from './ui';
import { space } from '../theme';

export interface OwnPlanEdit { planId: string; every: number | null; first: string; days: number | null; instructions: string | null }

/** Set reminders for one medicine: every N hours from a first time, for N days or ongoing.
 *  With `edit`, changes a medicine the patient added for themselves (the doctor's ones are locked). */
export function OwnReminder({ patientId, name, reportedMedicationId, edit, onDone, onCancel }: {
  patientId: string; name: string; reportedMedicationId?: string; edit?: OwnPlanEdit; onDone: () => void; onCancel: () => void;
}) {
  const [title, setTitle] = useState(name);
  const [every, setEvery] = useState<number>(edit?.every ?? 8);
  const [first, setFirst] = useState(edit?.first ?? '08:00');
  const [days, setDays] = useState(edit?.days ? String(edit.days) : '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const times = timesEvery(first, every);
  const save = async () => {
    setBusy(true); setErr(null);
    const { error } = edit
      ? await supabase.rpc('update_own_medication_plan', {
          p_plan_id: edit.planId, p_name: title, p_times: times, p_interval_hours: every,
          p_days: days ? Number(days) : undefined, p_instructions: edit.instructions ?? undefined })
      : await supabase.rpc('create_own_medication_plan', {
          p_patient_id: patientId, p_name: name, p_times: times, p_days: days ? Number(days) : undefined,
          p_interval_hours: every, p_reported_medication_id: reportedMedicationId });
    if (error) { setBusy(false); setErr(errorMessage(error)); return; }
    if (edit) { setBusy(false); onDone(); return; }
    await enableReminders();          // ask once for permission to show reminders on this phone
    setBusy(false); onDone(); router.push('/meds');
  };
  return (
    <Card>
      {edit ? <Field label="اسم الدواء" value={title} onChangeText={setTitle} /> : <Text variant="title">تذكير: {name}</Text>}
      <Text variant="label">كل كم ساعة؟</Text>
      <Row wrap gap={space[2]}>{reminderIntervals.map((h) => <Chip key={h} label={h === 24 ? 'مرة يومياً' : `كل ${h} ساعات`} selected={every === h} onPress={() => setEvery(h)} />)}</Row>
      <Field label="أول جرعة (ساعة:دقيقة)" ltr value={first} onChangeText={setFirst} placeholder="08:00"
             error={times.length ? undefined : 'اكتب الوقت بهذا الشكل: 08:00'} />
      {times.length > 0 && <Text variant="small" muted>الأوقات: {times.join('، ')}</Text>}
      <Field label="عدد الأيام" optional hint="اتركه فارغاً إذا كان الدواء مستمراً" ltr keyboardType="number-pad" value={days} onChangeText={setDays} />
      {err && <Alert tone="danger">{err}</Alert>}
      <Stack gap={space[2]}>
        <Row gap={space[2]}><Button title={edit ? 'حفظ التعديل' : 'تفعيل التذكير'} loading={busy} disabled={!times.length || !title.trim()} onPress={() => void save()} /><Button title="إلغاء" variant="ghost" onPress={onCancel} /></Row>
        <Text variant="small" muted>يصلك إشعار على الهاتف بكل موعد، وتسجّل «أخذت» من صفحة أدويتي. يرى طبيبك المعالج إن أخذت جرعاتك.</Text>
      </Stack>
    </Card>
  );
}
