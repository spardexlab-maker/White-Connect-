import { useState } from 'react';
import { View } from 'react-native';
import { BellPlus, Plus, X } from 'lucide-react-native';
import { errorMessage, localDateKey } from '@app/shared';
import { supabase } from '../lib/supabase';
import { Alert, Button, Chip, Field, Row, Stack, Text } from './ui';
import { color, radius, space } from '../theme';

const COMMON = ['08:00', '14:00', '20:00', '22:00'];

/**
 * The patient picks explicit reminder times. The doctor's wording is shown
 * for reference only — "three times daily" is never converted automatically.
 */
export function ReminderSetup({ prescriptionId, lineNo, displayName, frequencyText, asNeeded, durationDays, onDone }: {
  prescriptionId: string; lineNo: number; displayName: string; frequencyText: string | null; asNeeded: boolean; durationDays: number | null; onDone?: () => void;
}) {
  const [start, setStart] = useState(localDateKey(new Date()));
  const [times, setTimes] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const add = (t: string) => { if (/^([01]\d|2[0-3]):[0-5]\d$/.test(t) && !times.includes(t)) setTimes([...times, t].sort()); };
  const submit = async () => {
    setBusy(true); setError(null);
    const { error: err } = await supabase.rpc('create_medication_plan', {
      p_prescription_id: prescriptionId, p_line_no: lineNo, p_start_date: start, p_times: (asNeeded ? null : times) as string[], p_patient_consent: consent,
    });
    setBusy(false);
    if (err) { setError(errorMessage(err)); return; }
    setDone(true); onDone?.();
  };

  if (done) return <Alert tone="success">{asNeeded ? 'سُجلت الخطة (عند اللزوم — بدون تذكير ثابت).' : 'فُعّلت التذكيرات حتى نهاية مدة العلاج.'}</Alert>;
  return (
    <View style={{ borderWidth: 1, borderStyle: 'dashed', borderColor: color.borderStrong, borderRadius: radius.md, padding: space[3], gap: space[3] }}>
      <Row><BellPlus size={16} color={color.accent} /><Text variant="title" ltr style={{ fontSize: 15 }}>{displayName}</Text></Row>
      <Text variant="small" muted>تعليمات الطبيب: {frequencyText ?? '—'}{durationDays ? ` · لمدة ${durationDays} يوم` : ''}</Text>
      {asNeeded ? <Alert tone="info">دواء عند اللزوم: لا يُنشأ جدول جرعات ثابت.</Alert> : (
        <Stack>
          {durationDays == null && <Alert tone="warning">لم تُحدد مدة العلاج في الوصفة؛ لا يمكن جدولة تذكيرات بلا نهاية.</Alert>}
          <Field label="تاريخ البدء" ltr value={start} onChangeText={setStart} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
          <Text variant="label">الأوقات التي تناسبك</Text>
          <Row wrap>{COMMON.map((t) => <Chip key={t} label={t} selected={times.includes(t)} onPress={() => (times.includes(t) ? setTimes(times.filter((x) => x !== t)) : add(t))} />)}</Row>
          <Row style={{ alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}><Field label="وقت آخر" ltr placeholder="HH:MM" value={draft} onChangeText={setDraft} keyboardType="numbers-and-punctuation" maxLength={5} /></View>
            <Button title="إضافة" variant="secondary" icon={<Plus size={16} color={color.primary} />} onPress={() => { add(draft); setDraft(''); }} />
          </Row>
          {times.length > 0 && <Row wrap>{times.map((t) => <Chip key={t} label={t} icon={<X size={12} color={color.mutedText} />} onPress={() => setTimes(times.filter((x) => x !== t))} />)}</Row>}
        </Stack>
      )}
      <Chip label={consent ? '✓ أوافق على تلقي التذكيرات' : 'أوافق على تلقي التذكيرات'} selected={consent} onPress={() => setConsent(!consent)} />
      {error && <Alert tone="danger">{error}</Alert>}
      <Button title="تفعيل" small loading={busy} disabled={!consent || (!asNeeded && (times.length === 0 || durationDays == null))} onPress={submit} />
      <Text variant="small" muted>الأوقات التي تختارها أنت لا تغيّر الجرعة. إذا كان لديك شك اسأل الطبيب أو الصيدلي.</Text>
    </View>
  );
}
