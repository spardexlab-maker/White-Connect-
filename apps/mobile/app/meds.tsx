import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { Check, Clock, Minus, Pause, Pill, Play, Plus, SkipForward, Square } from 'lucide-react-native';
import { errorMessage, formatDate, formatTime } from '@app/shared';
import { supabase } from '../src/lib/supabase';
import { unwrap, useAsync } from '../src/lib/useAsync';
import { useAuth } from '../src/lib/auth';
import { doseLabel, remindersEnabled } from '../src/lib/reminders';
import { resyncDoses } from '../src/lib/doseActions';
import { PendingRx } from '../src/components/PendingRx';
import { SignInPrompt } from '../src/components/SignInPrompt';
import { Alert, Badge, Button, Card, Divider, EmptyState, ErrorState, Loading, Row, Screen, Stack, Text, type Tone } from '../src/components/ui';
import { color, space } from '../src/theme';

interface Dose { id: string; scheduled_at: string; status: string; dose_status: string | null; snooze_count: number; dose_amount: number | null; recorded_at: string | null }
interface Plan { id: string; display_name: string; instructions: string | null; start_date: string; end_date: string | null; times: string[]; as_needed: boolean;
  status: string; patient_name: string; doses: Dose[]; dose: number | null; dose_unit: string | null; interval_hours: number | null; prescribed_by: string | null }
const statusLabel: Record<string, { l: string; t: Tone }> = {
  active: { l: 'فعّالة', t: 'success' }, paused: { l: 'متوقفة مؤقتاً', t: 'warning' }, stopped: { l: 'أوقفتها', t: 'neutral' },
  cancelled: { l: 'أُلغيت (تغيّرت الوصفة)', t: 'danger' }, completed: { l: 'انتهت مدة العلاج', t: 'neutral' },
};

/** Medication plan: approved info, times, end of course, taken/skip/snooze (self-report). */
export default function Meds() {
  const { session } = useAuth();
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [localOn, setLocalOn] = useState(false);
  const plans = useAsync(async () => (session ? ((await unwrap(supabase.rpc('my_medication_plans'))) as unknown as Plan[]) : []), [session?.user.id]);

  // keep device notifications in step with the server plan
  useEffect(() => {
    if (!plans.data) return;
    void remindersEnabled().then(setLocalOn);
    void resyncDoses();
  }, [plans.data]);
  const [amounts, setAmounts] = useState<Record<string, number>>({});

  if (!session) return <SignInPrompt />;
  const act = async (p: PromiseLike<{ error: unknown }>, ok: string) => {
    const { error } = await p;
    setMsg(error ? { tone: 'danger', text: errorMessage(error) } : { tone: 'success', text: ok });
    if (!error) plans.reload();
  };

  return (
    <Screen refreshing={plans.status === 'loading' && !!plans.data} onRefresh={plans.reload}>
      {Platform.OS !== 'web' && !localOn && <Alert tone="info" title="تذكيرات الهاتف غير مفعّلة">فعّلها من «حسابي» لتصلك التذكيرات حتى دون إنترنت.</Alert>}
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      {plans.status === 'loading' && !plans.data && <Card><Loading /></Card>}
      {plans.status === 'error' && <Card><ErrorState error={plans.error} onRetry={plans.reload} /></Card>}
      <PendingRx onActivated={plans.reload} />
      {plans.data?.length === 0 && (
        <Card><EmptyState icon={<Pill size={28} color={color.mutedText} />} title="لا توجد خطط دواء">تُفعّل التذكيرات من الصيدلية عند الصرف، أو من صفحة الوصفة إذا حصلت على الدواء من مكان آخر.</EmptyState></Card>
      )}
      {plans.data?.map((p) => {
        const st = statusLabel[p.status] ?? { l: p.status, t: 'neutral' as Tone };
        return (
          <Card key={p.id}>
            <Row between><Text variant="title" ltr style={{ flex: 1 }}>{p.display_name}</Text><Badge label={st.l} tone={st.t} /></Row>
            <Text variant="small" muted>{p.patient_name} · من {formatDate(p.start_date + 'T12:00:00Z')}{p.end_date ? ` حتى ${formatDate(p.end_date + 'T12:00:00Z')}` : ''}</Text>
            {p.instructions && <Text variant="small">التعليمات المعتمدة: {p.instructions}</Text>}
            {(p.prescribed_by || p.dose) && <Text variant="small">{[p.prescribed_by ? `من ${p.prescribed_by}` : null, doseLabel(p.dose, p.dose_unit) ? `كل جرعة: ${doseLabel(p.dose, p.dose_unit)}` : null, p.interval_hours ? `كل ${p.interval_hours} ساعات` : null].filter(Boolean).join(' · ')}</Text>}
            <Text variant="small">{p.as_needed ? 'عند اللزوم — بدون جدول ثابت.' : `الأوقات: ${p.times.map((t) => t.slice(0, 5)).join('، ')}`}</Text>
            {p.doses.length > 0 && <Divider />}
            {p.doses.map((d) => (
              <View key={d.id} style={{ gap: space[2] }}>
                <Row gap={space[2]}><Clock size={16} color={color.mutedText} /><Text variant="small" weight="medium" style={{ flex: 1 }}>{formatDate(d.scheduled_at)} — {formatTime(d.scheduled_at)}</Text>
                  {d.dose_status === 'taken' && <Badge label={`أخذتها${d.recorded_at ? ` ${formatTime(d.recorded_at)}` : ''}${d.dose_amount ? ` · ${doseLabel(d.dose_amount, p.dose_unit)}` : ''}`} tone="success" />}
                  {d.dose_status === 'skipped' && <Badge label="تخطيت" tone="neutral" />}
                </Row>
                {!d.dose_status && p.status === 'active' && (() => {
                  const amount = amounts[d.id] ?? (p.dose ? Number(p.dose) : 1);
                  const step = amount % 1 ? 0.5 : 1;
                  return (
                    <Stack gap={space[2]}>
                      <Row gap={space[2]} style={{ alignItems: 'center' }}>
                        <Text variant="small" muted>الكمية:</Text>
                        <Button title="" small variant="ghost" accessibilityLabel="أقل" icon={<Minus size={14} color={color.primary} />} disabled={amount <= 0.5}
                                onPress={() => setAmounts({ ...amounts, [d.id]: Math.max(0.5, amount - step) })} />
                        <Text weight="semibold">{doseLabel(amount, p.dose_unit) || amount}</Text>
                        <Button title="" small variant="ghost" accessibilityLabel="أكثر" icon={<Plus size={14} color={color.primary} />}
                                onPress={() => setAmounts({ ...amounts, [d.id]: amount + step })} />
                      </Row>
                      <Row wrap>
                        <Button title="أخذت" small variant="accent" icon={<Check size={14} color={color.surface} />} onPress={() => act(supabase.rpc('log_dose', { p_job_id: d.id, p_status: 'taken', p_amount: amount }), 'سُجلت الجرعة — يظهر لطبيبك')} />
                        <Button title="تخطي" small variant="ghost" icon={<SkipForward size={14} color={color.primary} />} onPress={() => act(supabase.rpc('log_dose', { p_job_id: d.id, p_status: 'skipped' }), 'سُجل التخطي')} />
                        {d.snooze_count < 3 && <Button title="تأجيل 15 د" small variant="ghost" onPress={() => act(supabase.rpc('log_dose', { p_job_id: d.id, p_status: 'snoozed' }), 'سيُذكّرك بعد 15 دقيقة')} />}
                      </Row>
                    </Stack>
                  );
                })()}
              </View>
            ))}
            {['active', 'paused'].includes(p.status) && (
              <Stack gap={space[2]}>
                <Divider />
                <Row wrap>
                  {p.status === 'active'
                    ? <Button title="إيقاف مؤقت" small variant="secondary" icon={<Pause size={14} color={color.primary} />} onPress={() => act(supabase.rpc('set_medication_plan_status', { p_plan_id: p.id, p_status: 'paused' }), 'أُوقفت التذكيرات مؤقتاً')} />
                    : <Button title="استئناف" small variant="secondary" icon={<Play size={14} color={color.primary} />} onPress={() => act(supabase.rpc('set_medication_plan_status', { p_plan_id: p.id, p_status: 'active' }), 'استؤنفت التذكيرات')} />}
                  <Button title="إيقاف التذكيرات" small variant="ghost" icon={<Square size={14} color={color.primary} />} onPress={() => act(supabase.rpc('set_medication_plan_status', { p_plan_id: p.id, p_status: 'stopped' }), 'أُوقفت التذكيرات')} />
                </Row>
              </Stack>
            )}
          </Card>
        );
      })}
      <Alert tone="info">إذا فاتتك جرعة فلا تضاعف الجرعة التالية؛ اتبع تعليمات طبيبك أو الصيدلي. تسجيلك للجرعات لا يُعتبر إثباتاً طبياً للالتزام.</Alert>
    </Screen>
  );
}
