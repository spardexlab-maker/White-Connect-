import { useState } from 'react';
import { Platform, View } from 'react-native';
import { router } from 'expo-router';
import { BellRing, Pill } from 'lucide-react-native';
import { errorMessage, localDateKey, timesEvery } from '@app/shared';
import { supabase } from '../lib/supabase';
import { useAsync, unwrap } from '../lib/useAsync';
import { enableReminders } from '../lib/reminders';
import { resyncDoses } from '../lib/doseActions';
import { Alert, Button, Card, Chip, Row, Stack, Text } from './ui';
import { color, radius, space } from '../theme';

export interface PendingLine {
  prescription_id: string; rx_number: string; line_no: number; display_name: string; dose: number | null; dose_unit: string | null;
  frequency_text: string | null; interval_hours: number | null; duration_days: number | null; instructions: string | null; doctor: string; patient_name: string;
}

/** Next round half hour, e.g. 14:10 → 14:30 — a sensible "first dose now". */
function soon(): string {
  const d = new Date(Date.now() + 15 * 60_000);
  const m = d.getMinutes() < 30 ? 30 : 0;
  if (m === 0) d.setHours(d.getHours() + 1);
  return `${String(d.getHours()).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** The doctor's newly prescribed medicines: one tap turns them into reminders. */
export function PendingRx({ onActivated, compact }: { onActivated?: () => void; compact?: boolean }) {
  const pending = useAsync(async () => (await unwrap(supabase.rpc('rx_pending_reminders'))) as unknown as PendingLine[], []);
  if (!pending.data?.length) return null;
  if (compact) {
    return (
      <Card>
        <Row gap={space[2]}>
          <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: color.accentSoft, alignItems: 'center', justifyContent: 'center' }}><BellRing size={18} color={color.accent} /></View>
          <Stack gap={0} style={{ flex: 1 }}>
            <Text variant="title">{pending.data.length === 1 ? 'دواء جديد من طبيبك' : `${pending.data.length} أدوية جديدة من طبيبك`}</Text>
            <Text variant="small" muted>فعّل التذكير حتى ينبهك التطبيق بموعد كل جرعة.</Text>
          </Stack>
        </Row>
        <Button title="فعّل التذكير" icon={<BellRing size={16} color={color.surface} />} onPress={() => router.push('/meds')} />
      </Card>
    );
  }
  return (
    <Stack gap={space[3]}>
      {pending.data.map((l) => <Activate key={`${l.prescription_id}:${l.line_no}`} line={l} onDone={() => { pending.reload(); onActivated?.(); }} />)}
    </Stack>
  );
}

function Activate({ line, onDone }: { line: PendingLine; onDone: () => void }) {
  const [first, setFirst] = useState(soon());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const times = line.interval_hours ? timesEvery(first, line.interval_hours) : [];
  const dose = line.dose ? `${Number(line.dose)} ${line.dose_unit ?? ''}`.trim() : null;
  const choices = [...new Set([soon(), '06:00', '08:00', '09:00', '20:00', '22:00'])];

  const activate = async () => {
    setBusy(true); setError(null);
    const { error: err } = await supabase.rpc('create_medication_plan', {
      p_prescription_id: line.prescription_id, p_line_no: line.line_no, p_start_date: localDateKey(new Date()), p_times: times, p_patient_consent: true,
    });
    if (err) { setBusy(false); setError(errorMessage(err)); return; }
    if (Platform.OS !== 'web') { await enableReminders(); await resyncDoses(); }
    setBusy(false);
    onDone();
  };

  return (
    <Card>
      <Row gap={space[2]} style={{ alignItems: 'flex-start' }}>
        <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: color.accentSoft, alignItems: 'center', justifyContent: 'center' }}><Pill size={20} color={color.accent} /></View>
        <Stack gap={2} style={{ flex: 1 }}>
          <Text variant="title" ltr>{line.display_name}</Text>
          <Text variant="small" muted>من {line.doctor} · {line.patient_name}</Text>
        </Stack>
      </Row>
      <View style={{ backgroundColor: color.surfaceSunken, borderRadius: radius.md, padding: space[3], gap: 4 }}>
        <Text variant="small">تعليمات الطبيب: <Text variant="small" weight="semibold">{[dose, line.frequency_text, line.duration_days ? `لمدة ${line.duration_days} أيام` : null].filter(Boolean).join(' · ') || '—'}</Text></Text>
        {line.instructions ? <Text variant="small" muted>{line.instructions}</Text> : null}
      </View>
      {line.interval_hours && line.duration_days ? (
        <>
          <Text variant="label">متى تاخذ أول جرعة؟</Text>
          <Row wrap gap={space[2]}>{choices.map((t) => <Chip key={t} label={t === soon() ? `${t} (قريباً)` : t} selected={first === t} onPress={() => setFirst(t)} />)}</Row>
          <Text variant="small">مواعيدك كل يوم: <Text variant="small" weight="semibold">{times.join(' · ')}</Text></Text>
          {error && <Alert tone="danger">{error}</Alert>}
          <Button title="فعّل التذكير" loading={busy} icon={<BellRing size={16} color={color.surface} />} onPress={activate} />
          <Text variant="small" muted>بتفعيلك توافق على وصول التذكيرات. المواعيد تتبع فاصل الطبيب ({line.interval_hours} ساعات) ولا تغيّر الجرعة.</Text>
        </>
      ) : (
        <>
          <Alert tone="info">{line.duration_days ? 'الطبيب ما حدد كل كم ساعة؛ اختر أوقاتك بنفسك من صفحة الوصفة.' : 'مدة العلاج غير محددة بالوصفة؛ اختر أوقاتك من صفحة الوصفة.'}</Alert>
          <Button title="اختيار الأوقات" variant="secondary" onPress={() => router.push(`/rx/${line.prescription_id}`)} />
        </>
      )}
    </Card>
  );
}
