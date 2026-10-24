import { useEffect, useMemo, useState } from 'react';
import { Linking, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { Check, Home, MapPin, Phone, Plus } from 'lucide-react-native';
import { addDays, errorMessage, formatDate, formatDateTime, formatMoney, homeLabStatus, homeLabStep, homeLabSteps, homeLabWindowLabel, homeLabWindows,
  patientLabStatus, localDateKey, type HomeLabStatus, type LabStatus } from '@app/shared';
import { supabase } from '../src/lib/supabase';
import { unwrap, useAsync } from '../src/lib/useAsync';
import { useAuth } from '../src/lib/auth';
import { SignInPrompt } from '../src/components/SignInPrompt';
import { Alert, Badge, Button, Card, Chip, EmptyState, ErrorState, Field, Loading, Ltr, Row, Screen, Stack, Text, type Tone } from '../src/components/ui';
import { color, radius, space } from '../src/theme';

interface Lab { id: string; name: string; phone: string | null; area: string | null; fee_minor: number | null; note: string | null;
  tests: { id: string; name: string; price_minor: number | null; preparation_note: string | null }[] }
interface Req { id: string; request_number: string; status: HomeLabStatus; lab: string; lab_phone: string | null; tests: string | null;
  preferred_date: string; preferred_window: string; scheduled_at: string | null; collector_name: string | null; status_reason: string | null;
  lab_order_id: string | null; lab_order_status: LabStatus | null; patient_name: string }

/** «تحليل منزلي»: ask a lab to take the sample at home, then follow the visit step by step. */
export default function HomeLabScreen() {
  const { session } = useAuth();
  const params = useLocalSearchParams<{ lab?: string; order?: string }>();
  const [form, setForm] = useState(!!params.lab || !!params.order);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const list = useAsync(async () => (session ? ((await unwrap(supabase.rpc('my_home_lab_requests'))) as unknown as Req[]) : []), [session?.user.id]);
  if (!session) return <SignInPrompt />;
  const cancel = async (id: string) => {
    const { error } = await supabase.rpc('cancel_home_lab_request', { p_request_id: id });
    setMsg(error ? { tone: 'danger', text: errorMessage(error) } : { tone: 'success', text: 'أُلغي الطلب' });
    if (!error) list.reload();
  };
  return (
    <Screen refreshing={list.status === 'loading' && !!list.data} onRefresh={list.reload}>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      {form
        ? <NewRequest presetLab={params.lab ?? null} presetOrder={params.order ?? null}
                      onDone={() => { setForm(false); setMsg({ tone: 'success', text: 'وصل طلبك للمختبر — يوصلك إشعار لما يحدد الموعد' }); list.reload(); }}
                      onCancel={() => setForm(false)} />
        : <Button title="طلب سحب منزلي جديد" icon={<Plus size={18} color={color.surface} />} block onPress={() => setForm(true)} />}
      {list.status === 'loading' && !list.data && <Card><Loading /></Card>}
      {list.status === 'error' && <Card><ErrorState error={list.error} onRetry={list.reload} /></Card>}
      {list.data?.length === 0 && !form && (
        <Card><EmptyState icon={<Home size={28} color={color.mutedText} />} title="ما عندك طلبات">اطلب من مختبر يجي لبيتك ويسحب العينة، وتابع الزيارة خطوة بخطوة من هنا.</EmptyState></Card>
      )}
      {list.data?.map((r) => <RequestCard key={r.id} r={r} onCancel={() => void cancel(r.id)} />)}
    </Screen>
  );
}

function RequestCard({ r, onCancel }: { r: Req; onCancel: () => void }) {
  const step = homeLabStep(r.status);
  const ended = r.status === 'rejected' || r.status === 'cancelled';
  const st = homeLabStatus[r.status];
  return (
    <Card>
      <Row between><Text variant="title" style={{ flex: 1 }}>{r.lab}</Text><Badge label={st.label} tone={st.tone as Tone} /></Row>
      <Text variant="small">{r.tests}</Text>
      <Text variant="small" muted>{r.patient_name} · <Ltr>{r.request_number}</Ltr></Text>
      {!ended && (
        <Row style={{ justifyContent: 'space-between', marginVertical: space[2] }}>
          {homeLabSteps.map((s, i) => {
            const done = i < step, now = i === step;
            return (
              <View key={s} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 2,
                               borderColor: done || now ? color.accent : color.border, backgroundColor: done ? color.accent : color.surface }}>
                  {done ? <Check size={14} color={color.surface} /> : <Text variant="small" weight="bold" style={{ color: now ? color.accent : color.mutedText }}>{i + 1}</Text>}
                </View>
                <Text variant="small" weight={now ? 'semibold' : undefined} muted={!now} style={{ textAlign: 'center' }}>{homeLabStatus[s].label}</Text>
              </View>
            );
          })}
        </Row>
      )}
      <Alert tone={ended ? 'warning' : r.status === 'collected' ? 'success' : 'info'}>
        {st.patient}
        {r.status === 'scheduled' && r.scheduled_at ? `: ${formatDateTime(r.scheduled_at)}${r.collector_name ? ` — ${r.collector_name}` : ''}` : ''}
        {r.status === 'requested' ? ` (يفضّل ${formatDate(r.preferred_date + 'T12:00:00Z')} ${homeLabWindowLabel(r.preferred_window)})` : ''}
        {r.status_reason ? ` — ${r.status_reason}` : ''}
      </Alert>
      <Row wrap gap={space[2]}>
        {r.lab_order_id && <Button title={r.lab_order_status === 'released' ? 'عرض النتيجة' : `حالة التحليل: ${r.lab_order_status ? patientLabStatus[r.lab_order_status].label : '—'}`}
                                   small variant="secondary" onPress={() => router.push(`/lab/${r.lab_order_id}`)} />}
        {r.lab_phone && <Button title="اتصل بالمختبر" small variant="ghost" icon={<Phone size={14} color={color.primary} />} onPress={() => void Linking.openURL(`tel:${r.lab_phone}`)} />}
        {(r.status === 'requested' || r.status === 'scheduled') && <Button title="إلغاء الطلب" small variant="ghost" onPress={onCancel} />}
      </Row>
    </Card>
  );
}

function NewRequest({ presetLab, presetOrder, onDone, onCancel }: { presetLab: string | null; presetOrder: string | null; onDone: () => void; onCancel: () => void }) {
  const { access } = useAuth();
  const labs = useAsync(async () => (await unwrap(supabase.rpc('home_collection_labs'))) as unknown as Lab[], []);
  const people = useAsync(async () => ((await unwrap(supabase.from('patients').select('id, full_name'))) ?? []) as { id: string; full_name: string }[], []);
  const today = localDateKey(new Date(), 'Asia/Baghdad');
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(today, i)), [today]);
  const [patientId, setPatientId] = useState((access?.patient_ids.find((x) => x.relationship === 'self') ?? access?.patient_ids[0])?.patient_id ?? '');
  const [labId, setLabId] = useState(presetLab ?? '');
  const [tests, setTests] = useState<string[]>([]);
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [date, setDate] = useState(days[1]);
  const [win, setWin] = useState<string>('morning');
  const [notes, setNotes] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (!patientId && people.data?.[0]) setPatientId(people.data[0].id); }, [people.data, patientId]);
  useEffect(() => { if (!labId && labs.data?.length === 1) setLabId(labs.data[0].id); }, [labs.data, labId]);
  const lab = labs.data?.find((l) => l.id === labId) ?? null;
  const total = (lab?.tests.filter((t) => tests.includes(t.id)).reduce((s, t) => s + (t.price_minor ?? 0), 0) ?? 0) + (lab?.fee_minor ?? 0);

  const locate = async () => {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.granted) {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } else setErr('ما انطى إذن الموقع — اكتب العنوان بالتفصيل.');
    } catch { setErr('تعذّر تحديد موقعك — اكتب العنوان بالتفصيل.'); }
    setLocating(false);
  };
  const submit = async () => {
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc('request_home_lab', {
      p_patient_id: patientId, p_lab_facility_id: labId, p_test_ids: presetOrder ? [] : tests, p_address: address, p_phone: phone,
      p_date: date, p_window: win, p_notes: notes || undefined, p_latitude: coords?.lat, p_longitude: coords?.lng, p_lab_order_id: presetOrder ?? undefined,
    });
    setBusy(false);
    if (error) { setErr(errorMessage(error)); return; }
    onDone();
  };
  return (
    <Card>
      <Text variant="title">طلب سحب عينة من البيت</Text>
      {labs.status === 'loading' && <Loading />}
      {labs.data?.length === 0 && <Alert tone="info">ماكو مختبر يقدّم السحب المنزلي حالياً. نبلّغك أول ما يتوفر.</Alert>}
      {(people.data?.length ?? 0) > 1 && (
        <Stack gap={space[1]}>
          <Text variant="label">لمن التحليل؟</Text>
          <Row wrap gap={space[2]}>{people.data!.map((p) => <Chip key={p.id} label={p.full_name} selected={p.id === patientId} onPress={() => setPatientId(p.id)} />)}</Row>
        </Stack>
      )}
      {!!labs.data?.length && !presetOrder && (
        <Stack gap={space[1]}>
          <Text variant="label">المختبر</Text>
          <Row wrap gap={space[2]}>{labs.data.map((l) => <Chip key={l.id} label={l.area ? `${l.name} — ${l.area}` : l.name} selected={l.id === labId} onPress={() => { setLabId(l.id); setTests([]); }} />)}</Row>
        </Stack>
      )}
      {lab?.note && <Text variant="small" muted>{lab.note}</Text>}
      {presetOrder && <Alert tone="info">نفس التحاليل اللي طلبها طبيبك{lab ? ` — ${lab.name}` : ''}.</Alert>}
      {lab && !presetOrder && (
        <Stack gap={space[1]}>
          <Text variant="label">التحاليل المطلوبة</Text>
          <Row wrap gap={space[2]}>
            {lab.tests.map((t) => <Chip key={t.id} label={t.price_minor != null ? `${t.name} · ${formatMoney(t.price_minor)}` : t.name} selected={tests.includes(t.id)}
                                        onPress={() => setTests(tests.includes(t.id) ? tests.filter((x) => x !== t.id) : [...tests, t.id])} />)}
          </Row>
          {lab.tests.filter((t) => tests.includes(t.id) && t.preparation_note).map((t) => <Text key={t.id} variant="small" style={{ color: color.warningText }}>{t.name}: {t.preparation_note}</Text>)}
        </Stack>
      )}
      <Field label="العنوان بالتفصيل" hint="المنطقة، الشارع، رقم الدار، أقرب نقطة دالة" multiline value={address} onChangeText={setAddress} />
      <Button title={coords ? 'تم تحديد موقعك ✓' : 'أرسل موقعي الحالي'} small variant="ghost" loading={locating} icon={<MapPin size={14} color={color.primary} />} onPress={() => void locate()} />
      <Field label="رقم الهاتف للتواصل" ltr keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
      <Stack gap={space[1]}>
        <Text variant="label">اليوم</Text>
        <Row wrap gap={space[2]}>{days.map((d, i) => <Chip key={d} label={i === 0 ? 'اليوم' : i === 1 ? 'باچر' : formatDate(d + 'T12:00:00Z')} selected={d === date} onPress={() => setDate(d)} />)}</Row>
      </Stack>
      <Stack gap={space[1]}>
        <Text variant="label">الوقت المفضّل</Text>
        <Row wrap gap={space[2]}>{homeLabWindows.map((w) => <Chip key={w.id} label={w.label} selected={w.id === win} onPress={() => setWin(w.id)} />)}</Row>
      </Stack>
      <Field label="ملاحظات" optional multiline value={notes} onChangeText={setNotes} />
      {lab && (tests.length > 0 || presetOrder) && total > 0 && (
        <View style={{ backgroundColor: color.surfaceSunken, borderRadius: radius.sm, padding: space[2] }}>
          <Text variant="small">المجموع التقريبي: <Text variant="small" weight="bold">{formatMoney(total)}</Text>{lab.fee_minor ? ` (منها أجور الزيارة ${formatMoney(lab.fee_minor)})` : ''} — يُدفع للمختبر.</Text>
        </View>
      )}
      {err && <Alert tone="danger">{err}</Alert>}
      <Row gap={space[2]}>
        <Button title="إرسال الطلب" loading={busy} onPress={() => void submit()}
                disabled={!labId || !patientId || (!presetOrder && !tests.length) || address.trim().length < 5 || phone.trim().length < 7} />
        <Button title="إلغاء" variant="ghost" onPress={onCancel} />
      </Row>
    </Card>
  );
}
