import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { FlaskConical, PenLine, Plus, Trash2 } from 'lucide-react-native';
import { errorMessage, formatDate, formatDateTime, localDateKey, patientLabStatus, type LabStatus } from '@app/shared';
import { supabase, webUrl } from '../src/lib/supabase';
import { unwrap, useAsync } from '../src/lib/useAsync';
import { useAuth } from '../src/lib/auth';
import { SignInPrompt } from '../src/components/SignInPrompt';
import { Alert, Badge, Button, Card, Chip, EmptyState, ErrorState, Field, Loading, Ltr, Row, Screen, Stack, Text } from '../src/components/ui';
import { color, radius, space } from '../src/theme';

interface Item { id: string; name: string; master_id: string | null; code: string | null; unit: string | null; reference_range: string | null;
  status: 'open' | 'at_lab' | 'self_entered' | 'cancelled'; lab: string | null; lab_order_status: LabStatus | null }
interface Order { id: string; code: string; created_at: string; expires_at: string; note: string | null; expired: boolean; cancelled: boolean;
  doctor: string; clinic: string; patient_name: string; patient_id: string; public_code: string; items: Item[] }
interface Master { id: string; code: string; name_ar: string; unit: string | null; reference_range: string | null }
interface Entry { id: string; name: string; value_numeric: number | null; value_text: string | null; unit: string | null; taken_on: string; lab_name: string | null }

/** «طلبات التحاليل»: the doctor's order with its code / QR for any lab, and results entered by the patient from a lab off the platform. */
export default function LabOrdersScreen() {
  const { session, access } = useAuth();
  const patientId = (access?.patient_ids?.find((x) => x.relationship === 'self') ?? access?.patient_ids?.[0])?.patient_id ?? null;
  const orders = useAsync(async () => (session ? ((await unwrap(supabase.rpc('my_open_lab_orders'))) as unknown as Order[]) : []), [session?.user.id]);
  const entries = useAsync(async () => (session
    ? ((await unwrap(supabase.from('patient_lab_entries').select('id, name, value_numeric, value_text, unit, taken_on, lab_name').order('taken_on', { ascending: false }).limit(50))) ?? []) as Entry[]
    : []), [session?.user.id]);
  const master = useAsync(async () => ((await unwrap(supabase.from('lab_test_master').select('id, code, name_ar, unit, reference_range').eq('is_active', true).order('sort_order'))) ?? []) as Master[], []);
  const [entering, setEntering] = useState<{ order?: Order; item?: Item } | null>(null);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  if (!session) return <SignInPrompt />;
  const reload = () => { orders.reload(); entries.reload(); };
  const remove = async (id: string) => {
    const { error } = await supabase.rpc('delete_self_lab_result', { p_entry_id: id });
    setMsg(error ? { tone: 'danger', text: errorMessage(error) } : { tone: 'success', text: 'حُذفت النتيجة' });
    if (!error) reload();
  };
  return (
    <Screen refreshing={orders.status === 'loading' && !!orders.data} onRefresh={reload}>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <Text variant="small" muted>اعرض الرمز أو الـ QR في أي مختبر يستخدم التطبيق فيُضاف الطلب عنده وتوصلك النتيجة. إذا سويت التحليل بمختبر ثاني، أدخل النتيجة بنفسك.</Text>
      {entering && patientId
        ? <SelfResultForm patientId={entering.order?.patient_id ?? patientId} master={master.data ?? []} item={entering.item}
                          onDone={() => { setEntering(null); setMsg({ tone: 'success', text: 'حُفظت النتيجة — تطلع بصحتي مع الرسم والمقارنة' }); reload(); }}
                          onCancel={() => setEntering(null)} />
        : <Button title="أضف نتيجة تحليل" variant="secondary" icon={<Plus size={18} color={color.primary} />} block onPress={() => setEntering({})} />}
      {orders.status === 'loading' && !orders.data && <Card><Loading /></Card>}
      {orders.status === 'error' && <Card><ErrorState error={orders.error} onRetry={orders.reload} /></Card>}
      {orders.data?.length === 0 && (
        <Card><EmptyState icon={<FlaskConical size={28} color={color.mutedText} />} title="ما عندك طلبات تحاليل">لما يطلب طبيبك تحاليل بدون مختبر محدد، يظهر الطلب هنا مع رمزه.</EmptyState></Card>
      )}
      {orders.data?.map((o) => <OrderCard key={o.id} o={o} onEnter={(item) => setEntering({ order: o, item })} />)}
      {!!entries.data?.length && (
        <Card>
          <Text variant="title">نتائج أدخلتها</Text>
          {entries.data.map((e) => (
            <Row key={e.id} between style={{ backgroundColor: color.surfaceSunken, borderRadius: radius.sm, padding: space[2] }}>
              <View style={{ flex: 1 }}>
                <Text variant="small"><Text variant="small" style={{ fontWeight: '700' }}>{e.name}</Text> <Ltr>{String(e.value_numeric ?? e.value_text ?? '')} {e.unit ?? ''}</Ltr></Text>
                <Text variant="small" muted>{formatDate(e.taken_on)}{e.lab_name ? ` · ${e.lab_name}` : ''}</Text>
              </View>
              <Button title="حذف" small variant="ghost" icon={<Trash2 size={14} color={color.danger} />} onPress={() => void remove(e.id)} />
            </Row>
          ))}
          <Button title="شوف الرسوم والمقارنة في «صحتي»" small variant="ghost" onPress={() => router.push('/health')} />
        </Card>
      )}
    </Screen>
  );
}

function OrderCard({ o, onEnter }: { o: Order; onEnter: (item: Item) => void }) {
  const dead = o.expired || o.cancelled;
  return (
    <Card>
      <Text variant="small" muted>طلب تحاليل لأي مختبر</Text>
      <Text variant="title">{o.doctor} <Text variant="small" muted>— {o.clinic}</Text></Text>
      <Text variant="small">المريض: {o.patient_name} · <Ltr>{o.public_code}</Ltr></Text>
      <Text variant="small" muted>صدر {formatDateTime(o.created_at)} · {dead ? (o.cancelled ? 'ملغى' : 'منتهي الصلاحية') : `صالح حتى ${formatDate(o.expires_at)}`}</Text>
      <View style={{ alignItems: 'center', gap: space[2], paddingVertical: space[2], opacity: dead ? 0.35 : 1 }}>
        <QRCode value={`${webUrl}/lab-order?code=${o.code}`} size={180} color={color.text} backgroundColor={color.surface} ecl="M" />
        <Text variant="h2" style={{ letterSpacing: 3 }}><Ltr>{o.code}</Ltr></Text>
      </View>
      <Stack gap={space[2]}>
        {o.items.map((i) => (
          <Row key={i.id} between wrap style={{ backgroundColor: color.surfaceSunken, borderRadius: radius.sm, padding: space[2] }}>
            <Text variant="small" style={{ flex: 1 }}>{i.name}</Text>
            {i.status === 'open' && (dead ? <Badge label="لم يُجرَ" tone="neutral" />
              : <Chip label="أدخل النتيجة" icon={<PenLine size={14} color={color.accent} />} onPress={() => onEnter(i)} />)}
            {i.status === 'at_lab' && <Badge label={`${i.lab ?? ''}${i.lab_order_status ? ` — ${patientLabStatus[i.lab_order_status].label}` : ''}`} tone="info" />}
            {i.status === 'self_entered' && <Badge label="أدخلتها أنت" tone="accent" />}
          </Row>
        ))}
      </Stack>
      {o.note && <Text variant="small">ملاحظة الطبيب: {o.note}</Text>}
    </Card>
  );
}

function SelfResultForm({ patientId, master, item, onDone, onCancel }: { patientId: string; master: Master[]; item?: Item; onDone: () => void; onCancel: () => void }) {
  const [masterId, setMasterId] = useState(item?.master_id ?? '');
  const [q, setQ] = useState('');
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('');
  const [range, setRange] = useState('');
  const [date, setDate] = useState(localDateKey(new Date()));
  const [lab, setLab] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const m = master.find((t) => t.id === masterId);
  useEffect(() => { setErr(null); }, [value, date]);
  const shown = master.filter((t) => !q.trim() || `${t.name_ar} ${t.code}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 12);
  const submit = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { setErr('اكتب التاريخ بالشكل 2026-10-24'); return; }
    setBusy(true);
    const { error } = await supabase.rpc('add_self_lab_result', {
      p_patient_id: patientId, p_name: item?.name ?? (m?.name_ar || name), p_value: value, p_taken_on: date,
      p_unit: unit || undefined, p_reference_range: range || undefined, p_lab_name: lab || undefined,
      p_master_id: masterId || undefined, p_open_item_id: item?.id,
    });
    setBusy(false);
    if (error) { setErr(errorMessage(error)); return; }
    onDone();
  };
  return (
    <Card>
      <Text variant="title">{item ? `نتيجة ${item.name}` : 'أضف نتيجة تحليل'}</Text>
      {!item?.master_id && (
        <>
          <Field label="ابحث عن التحليل" value={q} onChangeText={setQ} placeholder="سكر، CBC…" />
          <Row gap={6} wrap>
            {shown.map((t) => <Chip key={t.id} label={t.name_ar} selected={masterId === t.id} onPress={() => setMasterId(masterId === t.id ? '' : t.id)} />)}
          </Row>
          {!item && !masterId && <Field label="أو اكتب اسم التحليل" value={name} onChangeText={setName} />}
        </>
      )}
      <Field label="النتيجة" ltr keyboardType="decimal-pad" value={value} onChangeText={setValue} />
      <Field label="الوحدة" optional ltr placeholder={m?.unit ?? item?.unit ?? ''} value={unit} onChangeText={setUnit} />
      <Field label="المجال الطبيعي" optional ltr placeholder={m?.reference_range ?? item?.reference_range ?? '70-100'}
             hint="من ورقة المختبر، وإذا تركته نستخدم المجال المعتمد" value={range} onChangeText={setRange} />
      <Field label="تاريخ التحليل" ltr placeholder="2026-10-24" value={date} onChangeText={setDate} />
      <Field label="اسم المختبر" optional value={lab} onChangeText={setLab} />
      {err && <Alert tone="danger">{err}</Alert>}
      <Text variant="small" muted>النتيجة تتعلّم «أدخلها المريض» حتى يعرف طبيبك مصدرها.</Text>
      <Row gap={space[2]}>
        <Button title="حفظ النتيجة" loading={busy} disabled={!value.trim() || (!item && !masterId && name.trim().length < 2)} onPress={() => void submit()} />
        <Button title="إلغاء" variant="ghost" onPress={onCancel} />
      </Row>
    </Card>
  );
}
