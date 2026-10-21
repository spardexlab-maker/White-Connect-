import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ArrowDown, ArrowUp, ChevronLeft, FileText, FlaskConical, Minus, Pencil, Plus, Share2 } from 'lucide-react-native';
import { errorMessage, formatDate, labFlag, parseRange } from '@app/shared';
import { supabase } from '../../src/lib/supabase';
import { unwrap, useAsync } from '../../src/lib/useAsync';
import { useAuth } from '../../src/lib/auth';
import { SignInPrompt } from '../../src/components/SignInPrompt';
import { Alert, Badge, Button, Card, Chip, EmptyState, ErrorState, Field, Loading, Ltr, Row, Screen, SectionTitle, Stack, Text } from '../../src/components/ui';
import { color, radius, space } from '../../src/theme';
import { RangeBar, TrendChart } from '../../src/components/LabCharts';
import { labReportPdf } from '../../src/lib/labPdf';
import { OwnReminder } from '../../src/components/OwnReminder';

interface Point { value_numeric: number | null; value_text: string | null; flag: string | null; released_at: string; lab: string; order_id: string }
interface Trend { key: string; name: string; unit: string | null; reference_range: string | null; points: Point[] }
interface Health {
  patient: { id: string; full_name: string; birth_date: string | null; birth_year: number | null };
  profile: { height_cm: number | null; weight_kg: number | null; blood_type: string | null; notes: string | null };
  conditions: { id: string; name: string; since_year: number | null; status: string; source: string }[];
  medications: { id: string; name: string; dose_text: string | null }[];
  prescribed: { name: string; frequency: string | null; until: string | null; doctor: string }[];
  allergies: { id: string; substance: string; reaction: string | null }[];
  lab_trends: Trend[];
}
const BLOOD = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const val = (p: Point) => (p.value_numeric != null ? String(Number(p.value_numeric)) : p.value_text ?? '—');

/** «صحتي»: my basics, chronic conditions, regular medicines, allergies and my tests (previous → current). */
export default function HealthTab() {
  const { session, access } = useAuth();
  const [pid, setPid] = useState<string | null>(null);
  useEffect(() => {
    if (access?.patient_ids?.length && !pid) setPid((access.patient_ids.find((x) => x.relationship === 'self') ?? access.patient_ids[0]).patient_id);
  }, [access, pid]);
  const people = useAsync(async () => (session ? ((await unwrap(supabase.from('patients').select('id, full_name'))) ?? []) as { id: string; full_name: string }[] : []), [session?.user.id]);
  const h = useAsync(async () => (pid ? (await unwrap(supabase.rpc('health_profile', { p_patient_id: pid }))) as unknown as Health : null), [pid]);
  useFocusEffect(useCallback(() => { if (pid) h.reload(); }, [pid])); // eslint-disable-line react-hooks/exhaustive-deps

  if (!session) return <SignInPrompt />;
  return (
    <Screen refreshing={h.status === 'loading' && !!h.data} onRefresh={h.reload}>
      {(people.data?.length ?? 0) > 1 && (
        <Row wrap gap={space[2]}>{people.data!.map((p) => <Chip key={p.id} label={p.full_name} selected={p.id === pid} onPress={() => setPid(p.id)} />)}</Row>
      )}
      {h.status === 'error' && <Card><ErrorState error={h.error} onRetry={h.reload} /></Card>}
      {!h.data && h.status !== 'error' && <Loading />}
      {h.data && <Body h={h.data} reload={h.reload} />}
    </Screen>
  );
}

function Body({ h, reload }: { h: Health; reload: () => void }) {
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [remind, setRemind] = useState<{ name: string; reportedId?: string } | null>(null);
  const run = async (p: PromiseLike<{ error: unknown }>, ok: string) => {
    const { error } = await p;
    setMsg(error ? { tone: 'danger', text: errorMessage(error) } : { tone: 'success', text: ok });
    if (!error) reload();
    return !error;
  };
  return (
    <Stack gap={space[4]}>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <Basics h={h} run={run} />
      <Tests trends={h.lab_trends} />
      <ListCard title="الأمراض المزمنة" empty="لا شيء مسجل."
        rows={h.conditions.map((c) => ({ key: c.id, title: c.name, sub: [c.since_year ? `منذ ${c.since_year}` : null, c.status === 'resolved' ? 'زال' : null].filter(Boolean).join(' · '),
          action: c.status === 'active' ? { label: 'زال', onPress: () => void run(supabase.rpc('set_condition_status', { p_condition_id: c.id, p_status: 'resolved' }), 'حُدّث') } : undefined }))}
        add={{ a: 'المرض (مثال: السكري)', b: 'منذ سنة', bLtr: true,
          onAdd: (a, b) => run(supabase.rpc('add_condition', { p_patient_id: h.patient.id, p_name: a, p_since_year: b ? Number(b) : undefined }), 'أُضيف') }} />
      <ListCard title="الأدوية المستمرة" empty="لا أدوية مستمرة مسجلة."
        rows={[
          ...h.prescribed.map((m, i) => ({ key: `p${i}`, title: m.name, sub: `من وصفة ${m.doctor}${m.until ? ` · حتى ${formatDate(m.until)}` : ''}`, ltr: true,
            extra: { label: 'تذكير', onPress: () => setRemind({ name: m.name }) } })),
          ...h.medications.map((m) => ({ key: m.id, title: m.name, sub: m.dose_text ?? '',
            extra: { label: 'تذكير', onPress: () => setRemind({ name: m.name, reportedId: m.id }) },
            action: { label: 'توقفت عنه', onPress: () => void run(supabase.rpc('stop_reported_medication', { p_medication_id: m.id }), 'حُدّث') } })),
        ]}
        add={{ a: 'دواء تأخذه باستمرار', b: 'الجرعة (مثال: قرص صباحاً)',
          onAdd: (a, b) => run(supabase.rpc('add_reported_medication', { p_patient_id: h.patient.id, p_name: a, p_dose_text: b || undefined }), 'أُضيف') }} />
      {remind && <OwnReminder patientId={h.patient.id} name={remind.name} reportedMedicationId={remind.reportedId}
                              onDone={() => { setRemind(null); setMsg({ tone: 'success', text: 'فُعّل التذكير' }); }} onCancel={() => setRemind(null)} />}
      <Button title="أدويتي والتذكيرات" variant="secondary" onPress={() => router.push('/meds')} />
      <ListCard title="الحساسية" empty="لا شيء مسجل."
        rows={h.allergies.map((x) => ({ key: x.id, title: x.substance, sub: x.reaction ?? '', danger: true }))}
        add={{ a: 'مادة أو دواء', b: 'ماذا يحدث',
          onAdd: (a, b) => run(supabase.rpc('add_allergy', { p_patient_id: h.patient.id, p_substance: a, p_reaction: b || undefined }), 'أُضيفت') }} />
      <Text variant="small" muted>يرى هذه البيانات أطباؤك المعالجون فقط، وتظهر لهم قبل الكشف.</Text>
    </Stack>
  );
}

function Basics({ h, run }: { h: Health; run: (p: PromiseLike<{ error: unknown }>, ok: string) => Promise<boolean> }) {
  const [edit, setEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ birth: h.patient.birth_date ?? '', height: h.profile.height_cm ? String(Number(h.profile.height_cm)) : '',
    weight: h.profile.weight_kg ? String(Number(h.profile.weight_kg)) : '', blood: h.profile.blood_type ?? '' });
  const age = h.patient.birth_year ? new Date().getFullYear() - h.patient.birth_year : null;
  const tile = (label: string, value: string) => (
    <View style={{ flex: 1, minWidth: 70, backgroundColor: color.surfaceSunken, borderRadius: radius.md, padding: space[3], gap: 2 }}>
      <Text variant="small" muted>{label}</Text><Text variant="h3"><Ltr>{value}</Ltr></Text>
    </View>
  );
  const save = async () => {
    if (f.birth && !/^\d{4}-\d{2}-\d{2}$/.test(f.birth)) return;
    setBusy(true);
    const ok = await run(supabase.rpc('save_health_profile', { p_patient_id: h.patient.id, p_birth_date: f.birth || undefined,
      p_height_cm: f.height ? Number(f.height) : undefined, p_weight_kg: f.weight ? Number(f.weight) : undefined, p_blood_type: f.blood || undefined,
      p_notes: h.profile.notes ?? undefined }), 'حُفظت بياناتك');
    setBusy(false);
    if (ok) setEdit(false);
  };
  return (
    <Card>
      <SectionTitle action={!edit ? <Button title="تعديل" small variant="secondary" icon={<Pencil size={14} color={color.primary} />} onPress={() => setEdit(true)} /> : undefined}>
        {h.patient.full_name}
      </SectionTitle>
      {!edit ? (
        <>
          <Row gap={space[2]} wrap>
            {tile('العمر', age != null ? String(age) : '—')}
            {tile('الطول سم', h.profile.height_cm ? String(Number(h.profile.height_cm)) : '—')}
            {tile('الوزن كغ', h.profile.weight_kg ? String(Number(h.profile.weight_kg)) : '—')}
            {tile('الفصيلة', h.profile.blood_type ?? '—')}
          </Row>
          {!h.profile.height_cm && !h.profile.weight_kg && <Alert tone="info">أكمل عمرك وطولك ووزنك حتى يطّلع عليها طبيبك قبل الكشف.</Alert>}
        </>
      ) : (
        <Stack gap={space[3]}>
          <Field label="تاريخ الميلاد (سنة-شهر-يوم)" ltr placeholder="1985-05-01" value={f.birth} onChangeText={(v) => setF({ ...f, birth: v })}
                 error={f.birth && !/^\d{4}-\d{2}-\d{2}$/.test(f.birth) ? 'اكتب التاريخ بهذا الشكل: 1985-05-01' : undefined} />
          <Row gap={space[3]}>
            <View style={{ flex: 1 }}><Field label="الطول (سم)" ltr keyboardType="decimal-pad" value={f.height} onChangeText={(v) => setF({ ...f, height: v })} /></View>
            <View style={{ flex: 1 }}><Field label="الوزن (كغ)" ltr keyboardType="decimal-pad" value={f.weight} onChangeText={(v) => setF({ ...f, weight: v })} /></View>
          </Row>
          <Text variant="label">فصيلة الدم</Text>
          <Row wrap gap={space[2]}>
            {BLOOD.map((b) => <Chip key={b} label={b} selected={f.blood === b} onPress={() => setF({ ...f, blood: f.blood === b ? '' : b })} />)}
          </Row>
          <Row gap={space[2]}><Button title="حفظ" loading={busy} onPress={() => void save()} /><Button title="إلغاء" variant="ghost" onPress={() => setEdit(false)} /></Row>
        </Stack>
      )}
    </Card>
  );
}

/** Every test as a card: current value against the reference range, the trend chart, the previous value and the PDF report. */
function Tests({ trends }: { trends: Trend[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const pdf = async (orderId: string, mode: 'print' | 'share') => {
    setBusy(orderId + mode); setErr(null);
    try { await labReportPdf(orderId, mode); } catch (e) { setErr(errorMessage(e)); }
    setBusy(null);
  };
  return (
    <Stack gap={space[3]}>
      <SectionTitle>تحاليلي</SectionTitle>
      {err && <Alert tone="danger">{err}</Alert>}
      {trends.length === 0 && <Card><EmptyState icon={<FlaskConical size={28} color={color.mutedText} />} title="لا توجد نتائج بعد" /></Card>}
      {trends.map((t) => {
        const [cur, prev] = t.points;
        const range = parseRange(t.reference_range);
        const dir = cur.value_numeric != null && prev?.value_numeric != null ? Math.sign(Number(cur.value_numeric) - Number(prev.value_numeric)) : null;
        const Arrow = dir === 1 ? ArrowUp : dir === -1 ? ArrowDown : Minus;
        return (
          <Card key={t.key}>
            <Row between>
              <Text variant="title" style={{ flex: 1 }}>{t.name}</Text>
              {cur.flag ? <Badge label={labFlag[cur.flag] ?? cur.flag} tone={cur.flag === 'critical' ? 'danger' : 'warning'} /> : null}
            </Row>
            <Row gap={space[3]} wrap>
              <Text variant="h2"><Ltr>{val(cur)}{t.unit ? ` ${t.unit}` : ''}</Ltr></Text>
              {prev && <Row gap={4}><Arrow size={16} color={color.mutedText} /><Text variant="small" muted>السابق <Ltr>{val(prev)}</Ltr> ({formatDate(prev.released_at)})</Text></Row>}
            </Row>
            {range && cur.value_numeric != null ? <RangeBar value={Number(cur.value_numeric)} range={range} />
              : <Text variant="small" muted>المرجع: {t.reference_range ?? '—'}</Text>}
            <TrendChart points={t.points} range={range} />
            <Text variant="small" muted>{formatDate(cur.released_at)} · {cur.lab}</Text>
            <Row gap={space[2]} wrap>
              <Button title="تقرير PDF" small icon={<FileText size={14} color={color.surface} />} loading={busy === cur.order_id + 'print'} onPress={() => void pdf(cur.order_id, 'print')} />
              <Button title="مشاركة" small variant="secondary" icon={<Share2 size={14} color={color.primary} />} loading={busy === cur.order_id + 'share'} onPress={() => void pdf(cur.order_id, 'share')} />
              {t.points.length > 1 && <Button title={`كل النتائج (${t.points.length})`} small variant="ghost" onPress={() => setOpen(open === t.key ? null : t.key)} />}
            </Row>
            {open === t.key && (
              <Stack gap={space[2]}>
                {t.points.map((p, i) => (
                  <Pressable key={i} accessibilityRole="link" onPress={() => router.push(`/lab/${p.order_id}`)}>
                    <Row between style={{ backgroundColor: color.surfaceSunken, borderRadius: radius.sm, padding: space[2] }}>
                      <Text variant="small"><Ltr>{val(p)}</Ltr>{p.flag ? ` · ${labFlag[p.flag] ?? p.flag}` : ''}</Text>
                      <Row gap={4}><Text variant="small" muted>{formatDate(p.released_at)} · التقرير</Text><ChevronLeft size={14} color={color.mutedText} /></Row>
                    </Row>
                  </Pressable>
                ))}
              </Stack>
            )}
          </Card>
        );
      })}
      {trends.length > 0 && <Text variant="small" muted>الشريط يبيّن موقع النتيجة من المجال المرجعي للمختبر، والرسم تطورها. مقارنة رقمية فقط وليست تفسيراً طبياً.</Text>}
    </Stack>
  );
}

function ListCard({ title, empty, rows, add }: {
  title: string; empty: string;
  rows: { key: string; title: string; sub?: string; ltr?: boolean; danger?: boolean; action?: { label: string; onPress: () => void }; extra?: { label: string; onPress: () => void } }[];
  add: { a: string; b: string; bLtr?: boolean; onAdd: (a: string, b: string) => Promise<boolean> };
}) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [adding, setAdding] = useState(false);
  return (
    <Card>
      <SectionTitle action={!adding ? <Button title="إضافة" small variant="secondary" icon={<Plus size={14} color={color.primary} />} onPress={() => setAdding(true)} /> : undefined}>{title}</SectionTitle>
      {rows.length === 0 && <Text variant="small" muted>{empty}</Text>}
      {rows.map((r) => (
        <Row key={r.key} between style={{ paddingVertical: 4 }}>
          <View style={{ flex: 1 }}>
            {r.danger ? <Badge label={r.title} tone="danger" /> : <Text variant="title" ltr={r.ltr}>{r.title}</Text>}
            {!!r.sub && <Text variant="small" muted>{r.sub}</Text>}
          </View>
          {r.extra && <Button title={r.extra.label} small variant="secondary" onPress={r.extra.onPress} />}
          {r.action && <Button title={r.action.label} small variant="ghost" onPress={r.action.onPress} />}
        </Row>
      ))}
      {adding && (
        <Stack gap={space[2]}>
          <Field label={add.a} value={a} onChangeText={setA} />
          <Field label={add.b} optional ltr={add.bLtr} keyboardType={add.bLtr ? 'number-pad' : 'default'} value={b} onChangeText={setB} />
          <Row gap={space[2]}>
            <Button title="حفظ" disabled={!a.trim()} onPress={() => void add.onAdd(a.trim(), b.trim()).then((ok) => { if (ok) { setA(''); setB(''); setAdding(false); } })} />
            <Button title="إلغاء" variant="ghost" onPress={() => setAdding(false)} />
          </Row>
        </Stack>
      )}
    </Card>
  );
}
