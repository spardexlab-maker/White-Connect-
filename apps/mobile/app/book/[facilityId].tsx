import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text as RNText, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CalendarCheck2, CalendarX2, CheckCircle2, Clock } from 'lucide-react-native';
import {
  addDays, errorCode, errorMessage, formatDate, formatDateTime, formatMoney, formatTime, localDateKey, weekdayLabel, weekdayOf,
} from '@app/shared';
import { supabase } from '../../src/lib/supabase';
import { unwrap, useAsync } from '../../src/lib/useAsync';
import { useAuth } from '../../src/lib/auth';
import { newIdempotencyKey } from '../../src/lib/idempotency';
import { useProviderProfile } from '../../src/lib/provider';
import { AuthForm, RegisterSelf } from '../../src/components/AuthForms';
import { Alert, AppointmentBadge, Button, Card, Chip, EmptyState, ErrorState, Field, Loading, Ltr, Row, Screen, Stack, Summary, Text } from '../../src/components/ui';
import { color, family, radius, space } from '../../src/theme';

type Step = 1 | 2 | 3 | 4;
interface Slot { slot_start: string; slot_end: string }
interface Result { id: string; booking_number: string; status: 'awaiting_confirmation' | 'confirmed'; confirmation_deadline: string | null }
const steps = ['الخدمة', 'الموعد', 'المراجعة', 'الإرسال'];

export default function BookingScreen() {
  const { facilityId, practitioner, service: initialService } = useLocalSearchParams<{ facilityId: string; practitioner?: string; service?: string }>();
  const { session, access, refreshAccess } = useAuth();
  const profile = useProviderProfile(facilityId, practitioner);
  const today = useMemo(() => localDateKey(new Date()), []);

  const [step, setStep] = useState<Step>(initialService ? 2 : 1);
  const [serviceId, setServiceId] = useState<string | null>(initialService ?? null);
  const [day, setDay] = useState(today);
  const [slot, setSlot] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [patientId, setPatientId] = useState<string | null>(null);
  const [idemKey, setIdemKey] = useState(() => newIdempotencyKey('book'));
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [result, setResult] = useState<Result | null>(null);

  const p = profile.data;
  const service = p?.services.find((s) => s.id === serviceId) ?? null;
  const horizon = Math.min(p?.policy.booking_window_days ?? 14, 21);

  const slots = useAsync(async () => {
    if (!serviceId || !facilityId) return [] as Slot[];
    return (await unwrap(supabase.rpc('get_available_slots', {
      p_facility_id: facilityId, p_practitioner_id: (practitioner ?? null) as string, p_service_id: serviceId,
      p_from: today, p_to: addDays(today, horizon),
    }))) as Slot[];
  }, [facilityId, practitioner, serviceId, today, horizon]);

  const byDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots.data ?? []) {
      const k = localDateKey(new Date(s.slot_start));
      map.set(k, [...(map.get(k) ?? []), s]);
    }
    return map;
  }, [slots.data]);

  // jump to the first day that has free time
  useEffect(() => {
    if (slots.status === 'success' && !byDay.get(day)?.length) {
      const first = [...byDay.keys()].sort()[0];
      if (first) setDay(first);
    }
  }, [slots.status, byDay]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (access?.patient_ids?.length && !patientId) {
      setPatientId((access.patient_ids.find((x) => x.relationship === 'self') ?? access.patient_ids[0]).patient_id);
    }
  }, [access, patientId]);

  const patients = useAsync(async () => {
    if (!session) return [] as { id: string; full_name: string }[];
    return (await unwrap(supabase.from('patients').select('id, full_name'))) ?? [];
  }, [session?.user.id, access?.patient_ids?.length]);

  if (profile.status === 'loading' && !p) return <Screen><Loading /></Screen>;
  if (profile.status === 'error') return <Screen><Card><ErrorState error={profile.error} onRetry={profile.reload} /></Card></Screen>;
  if (!p) return <Screen><Card><EmptyState icon={<CalendarX2 size={28} color={color.mutedText} />} title="لا يمكن الحجز لدى مقدم الخدمة هذا حالياً" /></Card></Screen>;

  const name = p.practitioner?.full_name ?? p.facility.name;
  const tz = p.facility.timezone;
  const offDays = new Set([0, 1, 2, 3, 4, 5, 6].filter((d) => !p.weekly_hours.some((h) => h.weekday === d)));

  const submit = async () => {
    if (!slot || !serviceId || !patientId) return;
    setSubmitting(true); setSubmitError(null);
    const { data, error } = await supabase.rpc('book_appointment', {
      p_patient_id: patientId, p_facility_id: p.facility.id, p_practitioner_id: (p.practitioner?.id ?? null) as string,
      p_service_id: serviceId, p_start: slot, p_idempotency_key: idemKey, p_source: 'app', p_patient_note: note.trim() || undefined,
    });
    setSubmitting(false);
    if (error) {
      setSubmitError(error);
      if (errorCode(error) === 'slot_unavailable') { setSlot(null); slots.reload(); setIdemKey(newIdempotencyKey('book')); setStep(2); }
      return;
    }
    setResult(data as unknown as Result);
    setStep(4);
  };

  return (
    <Screen>
      <Stepper step={step} />

      {step === 1 && (
        <Card>
          <Text variant="h3">اختر نوع الزيارة</Text>
          <Stack gap={space[2]}>
            {p.services.map((s) => (
              <Pressable key={s.id} accessibilityRole="radio" accessibilityState={{ checked: serviceId === s.id }}
                         onPress={() => { setServiceId(s.id); setSlot(null); }} style={[st.option, serviceId === s.id && st.optionOn]}>
                <Text variant="title" style={{ fontSize: 15 }}>{s.name}</Text>
                <Text variant="small" muted>{s.duration_minutes} دقيقة · {formatMoney(s.price_minor, s.currency)}</Text>
              </Pressable>
            ))}
          </Stack>
          <Button title="التالي: اختيار الموعد" disabled={!serviceId} onPress={() => setStep(2)} />
        </Card>
      )}

      {step === 2 && service && (
        <Card>
          <Row between><Text variant="h3">اختر اليوم والوقت</Text><Text variant="small" muted>{service.duration_minutes} دقيقة</Text></Row>
          {!!submitError && errorCode(submitError) === 'slot_unavailable' && <Alert tone="warning" title="تغيّر التوفر">حُجز هذا الوقت للتو. اختر وقتاً آخر.</Alert>}
          {slots.status === 'error' && <ErrorState error={slots.error} onRetry={slots.reload} />}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space[2] }}>
            {Array.from({ length: horizon + 1 }, (_, i) => addDays(today, i)).map((k) => {
              const wd = weekdayOf(k);
              const count = byDay.get(k)?.length ?? 0;
              const label = offDays.has(wd) ? 'عطلة' : count ? `${count} متاح` : slots.status === 'loading' ? '…' : 'ممتلئ';
              const on = day === k;
              return (
                <Pressable key={k} disabled={!count} onPress={() => { setDay(k); setSlot(null); }}
                           accessibilityRole="button" accessibilityState={{ selected: on, disabled: !count }} accessibilityLabel={`${weekdayLabel[wd]} ${Number(k.slice(8))} — ${label}`}
                           style={[st.day, on && st.dayOn, !count && { opacity: 0.45 }]}>
                  <RNText style={[st.dayName, on && { color: color.surface }]}>{weekdayLabel[wd]}</RNText>
                  <RNText style={[st.dayNum, on && { color: color.surface }]}>{Number(k.slice(8))}</RNText>
                  <RNText style={[st.dayState, on && { color: color.surface }]}>{label}</RNText>
                </Pressable>
              );
            })}
          </ScrollView>
          <Text variant="title">{formatDate(day + 'T12:00:00Z')}</Text>
          {slots.status === 'loading' ? <Loading /> : byDay.get(day)?.length ? (
            <Row wrap gap={space[2]}>
              {byDay.get(day)!.map((s) => <Chip key={s.slot_start} label={formatTime(s.slot_start, tz)} selected={slot === s.slot_start} onPress={() => setSlot(s.slot_start)} />)}
            </Row>
          ) : <Text variant="small" muted>لا توجد أوقات متاحة في هذا اليوم. اختر يوماً آخر.</Text>}
          <Row between>
            <Button title="رجوع" variant="ghost" onPress={() => setStep(1)} />
            <Button title="التالي: مراجعة" disabled={!slot} onPress={() => { setIdemKey(newIdempotencyKey('book')); setSubmitError(null); setStep(3); }} />
          </Row>
        </Card>
      )}

      {step === 3 && service && slot && (
        <>
          <Card>
            <Text variant="h3">راجع تفاصيل الحجز</Text>
            <Summary rows={[
              [p.practitioner ? 'الطبيب' : 'المختبر', name],
              ['الفرع', `${p.facility.name} — ${p.facility.branch_name}`],
              ['التاريخ', formatDate(slot, tz)],
              ['الوقت', `${formatTime(slot, tz)} (${service.duration_minutes} دقيقة)`],
              ['الخدمة', service.name],
              ['الرسوم', `${formatMoney(service.price_minor, service.currency)} — تُدفع في العيادة`],
              ['التأكيد', p.policy.confirmation_mode === 'auto' ? 'يُثبت فوراً عند الإرسال' : `بانتظار تأكيد العيادة خلال ${p.policy.confirmation_timeout_minutes} دقيقة كحد أقصى؛ الوقت محجوز لك خلالها`],
              ['الإلغاء', p.policy.cancellation_policy_text ?? `قبل ${Math.round(p.policy.cancellation_cutoff_minutes / 60)} ساعة`],
            ]} />
          </Card>

          {!session ? (
            <Card>
              <Alert tone="info" title="سجّل الدخول لإرسال الطلب">اختيارك محفوظ في هذه الشاشة، وسنتحقق من توفر الوقت عند الإرسال.</Alert>
              <AuthForm />
            </Card>
          ) : !access ? <Card><Loading /></Card> : !access.patient_ids.length ? (
            <Card><RegisterSelf onDone={() => void refreshAccess()} /></Card>
          ) : (
            <Card>
              {(patients.data?.length ?? 0) > 1 && (
                <Stack gap={6}>
                  <Text variant="label">الحجز لـ</Text>
                  <Row wrap>{patients.data!.map((pt) => <Chip key={pt.id} label={pt.full_name} selected={patientId === pt.id} onPress={() => setPatientId(pt.id)} />)}</Row>
                </Stack>
              )}
              <Field label="ملاحظة للعيادة" optional maxLength={300} multiline value={note} onChangeText={setNote} placeholder="مثال: أول زيارة"
                     style={{ minHeight: 72, textAlignVertical: 'top', paddingTop: 10 }} hint="لا تكتب معلومات حساسة هنا؛ يناقشها الطبيب معك خلال الزيارة." />
              {!!submitError && errorCode(submitError) !== 'slot_unavailable' && <Alert tone="danger" title="لم يتم الحجز">{errorMessage(submitError)}</Alert>}
              <Button title={submitting ? 'جارٍ الإرسال…' : 'إرسال طلب الحجز'} loading={submitting} disabled={!patientId}
                      icon={<CalendarCheck2 size={18} color={color.surface} />} onPress={submit} />
              <Button title="تغيير الموعد" variant="ghost" disabled={submitting} onPress={() => setStep(2)} />
            </Card>
          )}
        </>
      )}

      {step === 4 && result && slot && (
        <Card>
          <Row><CheckCircle2 size={28} color={color.success} /><Text variant="h3">تم تسجيل طلبك</Text></Row>
          <Summary rows={[
            ['رقم الحجز', <Text key="n" variant="title"><Ltr>{result.booking_number}</Ltr></Text>],
            ['الحالة', <AppointmentBadge key="s" status={result.status} />],
            ['الموعد', formatDateTime(slot, tz)],
            ...(result.status === 'awaiting_confirmation' && result.confirmation_deadline
              ? [['مهلة التأكيد', <Row key="d" gap={4} style={{ alignItems: 'flex-start' }}><Clock size={14} color={color.warningText} /><Text variant="small" style={{ flex: 1 }}>حتى {formatTime(result.confirmation_deadline, tz)} — إن لم تؤكده العيادة يُلغى الطلب تلقائياً ويتحرر الوقت.</Text></Row>] as [string, ReactNode]]
              : []),
          ]} />
          <Button title="عرض حجوزاتي" onPress={() => { router.dismissAll(); router.navigate('/appointments'); }} />
          <Button title="العودة للرئيسية" variant="secondary" onPress={() => { router.dismissAll(); router.navigate('/'); }} />
        </Card>
      )}
    </Screen>
  );
}

function Stepper({ step }: { step: Step }) {
  return (
    <View style={{ flexDirection: 'row', gap: space[2] }} accessibilityLabel={`المرحلة ${step} من 4: ${steps[step - 1]}`}>
      {steps.map((label, i) => {
        const n = i + 1; const on = n === step; const done = n < step;
        return (
          <View key={label} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <View style={[st.stepDot, (on || done) && { backgroundColor: done ? color.accent : color.primary, borderColor: 'transparent' }]}>
              <RNText style={{ color: on || done ? color.surface : color.mutedText, fontFamily: family.semibold, fontSize: 13 }}>{n}</RNText>
            </View>
            <RNText style={{ fontFamily: on ? family.semibold : family.regular, fontSize: 12, color: on ? color.text : color.mutedText }}>{label}</RNText>
          </View>
        );
      })}
    </View>
  );
}

const st = StyleSheet.create({
  option: { borderWidth: 1, borderColor: color.border, borderRadius: radius.md, padding: space[3], gap: 2 },
  optionOn: { borderColor: color.accent, backgroundColor: color.accentSoft, borderWidth: 2 },
  day: { width: 74, paddingVertical: space[2], borderRadius: radius.md, borderWidth: 1, borderColor: color.border, alignItems: 'center', gap: 2, backgroundColor: color.surface },
  dayOn: { backgroundColor: color.primary, borderColor: color.primary },
  dayName: { fontFamily: family.medium, fontSize: 12, color: color.mutedText },
  dayNum: { fontFamily: family.bold, fontSize: 20, color: color.text },
  dayState: { fontFamily: family.regular, fontSize: 11, color: color.mutedText },
  stepDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: color.borderStrong, alignItems: 'center', justifyContent: 'center' },
});
