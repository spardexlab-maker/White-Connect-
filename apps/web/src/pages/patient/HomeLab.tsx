import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, Home, MapPin, Phone, Plus } from 'lucide-react';
import { errorMessage, formatDate, formatDateTime, formatMoney, homeLabStatus, homeLabStep, homeLabSteps, homeLabWindowLabel, homeLabWindows,
  patientLabStatus, localDateKey, addDays, type HomeLabStatus, type LabStatus } from '@app/shared';
import { supabase } from '../../lib/supabase';
import { unwrap, useAsync } from '../../lib/useAsync';
import { useAuth } from '../../lib/auth';
import { Alert, Badge, Button, EmptyState, ErrorState, Ltr, SelectField, SkeletonList, TextField, TextareaField, useToast } from '../../components/ui';
import { SignInPrompt } from './Account';

interface Lab { id: string; name: string; phone: string | null; area: string | null; address: string | null; city: string | null;
  fee_minor: number | null; note: string | null; tests: { id: string; name: string; price_minor: number | null; preparation_note: string | null }[] }
interface Req { id: string; request_number: string; status: HomeLabStatus; lab: string; lab_phone: string | null; tests: string | null; address: string;
  preferred_date: string; preferred_window: string; scheduled_at: string | null; collector_name: string | null; status_reason: string | null;
  lab_order_id: string | null; lab_order_status: LabStatus | null; patient_name: string; events: { status: string; at: string; note: string | null }[] | null }

/** «تحليل منزلي»: ask a lab to take the sample at home, then follow the visit step by step. */
export function HomeLab() {
  const { session, access } = useAuth();
  const toast = useToast();
  const [params] = useSearchParams();
  const [form, setForm] = useState(params.has('lab') || params.has('order'));
  const list = useAsync(async () => (session ? ((await unwrap(supabase.rpc('my_home_lab_requests'))) as unknown as Req[]) : []), [session?.user.id]);
  if (!session) return <SignInPrompt title="تحليل منزلي" />;
  const cancel = async (id: string) => {
    const { error } = await supabase.rpc('cancel_home_lab_request', { p_request_id: id });
    if (error) toast(errorMessage(error), 'danger'); else { toast('أُلغي الطلب', 'success'); list.reload(); }
  };
  return (
    <div className="stack">
      <div className="row-between">
        <h1 style={{ fontSize: 'var(--f-h2)' }}>تحليل منزلي</h1>
        {!form && <Button icon={<Plus size={18} />} onClick={() => setForm(true)}>طلب سحب منزلي</Button>}
      </div>
      {form && <NewRequest defaultPatient={(access?.patient_ids?.find((x) => x.relationship === 'self') ?? access?.patient_ids?.[0])?.patient_id ?? null}
                           presetLab={params.get('lab')} presetOrder={params.get('order')}
                           onDone={() => { setForm(false); list.reload(); }} onCancel={() => setForm(false)} />}
      {list.status === 'loading' && !list.data && <SkeletonList rows={2} />}
      {list.status === 'error' && <ErrorState error={list.error} onRetry={list.reload} />}
      {list.data?.length === 0 && !form && (
        <div className="card"><EmptyState icon={<Home />} title="ما عندك طلبات">اطلب من مختبر يجي لبيتك ويسحب العينة، وتابع الزيارة خطوة بخطوة من هنا.</EmptyState></div>
      )}
      {list.data?.map((r) => <RequestCard key={r.id} r={r} onCancel={() => void cancel(r.id)} />)}
    </div>
  );
}

function RequestCard({ r, onCancel }: { r: Req; onCancel: () => void }) {
  const step = homeLabStep(r.status);
  const ended = r.status === 'rejected' || r.status === 'cancelled';
  return (
    <section className="card stack-sm">
      <div className="row-between">
        <strong>{r.lab}</strong>
        <Badge tone={homeLabStatus[r.status].tone}>{homeLabStatus[r.status].label}</Badge>
      </div>
      <span className="small">{r.tests}</span>
      <span className="small muted">{r.patient_name} · <Ltr>{r.request_number}</Ltr></span>
      {!ended && (
        <ol className="hl-steps" aria-label="مراحل الطلب">
          {homeLabSteps.map((s, i) => (
            <li key={s} className={i < step ? 'done' : i === step ? 'now' : ''}>
              <span className="hl-dot">{i < step ? <Check size={12} aria-hidden /> : i + 1}</span>
              <span className="small">{homeLabStatus[s].label}</span>
            </li>
          ))}
        </ol>
      )}
      <Alert tone={ended ? 'warning' : r.status === 'collected' ? 'success' : 'info'}>
        {homeLabStatus[r.status].patient}
        {r.status === 'scheduled' && r.scheduled_at ? `: ${formatDateTime(r.scheduled_at)}${r.collector_name ? ` — ${r.collector_name}` : ''}` : ''}
        {r.status === 'requested' ? ` (يفضّل ${formatDate(r.preferred_date + 'T12:00:00Z')} ${homeLabWindowLabel(r.preferred_window)})` : ''}
        {r.status_reason ? ` — ${r.status_reason}` : ''}
      </Alert>
      <div className="row" style={{ gap: 'var(--s-2)' }}>
        {r.lab_order_id && (
          <Link className="btn btn-secondary btn-sm" to={`/patient/labs/${r.lab_order_id}`}>
            {r.lab_order_status === 'released' ? 'عرض النتيجة' : `حالة التحليل: ${r.lab_order_status ? patientLabStatus[r.lab_order_status].label : '—'}`}
          </Link>
        )}
        {r.lab_phone && <a className="btn btn-ghost btn-sm" href={`tel:${r.lab_phone}`}><Phone size={14} aria-hidden />اتصل بالمختبر</a>}
        {(r.status === 'requested' || r.status === 'scheduled') && <Button size="sm" variant="ghost" onClick={onCancel}>إلغاء الطلب</Button>}
      </div>
    </section>
  );
}

function NewRequest({ defaultPatient, presetLab, presetOrder, onDone, onCancel }: {
  defaultPatient: string | null; presetLab: string | null; presetOrder: string | null; onDone: () => void; onCancel: () => void;
}) {
  const toast = useToast();
  const labs = useAsync(async () => (await unwrap(supabase.rpc('home_collection_labs'))) as unknown as Lab[], []);
  const people = useAsync(async () => ((await unwrap(supabase.from('patients').select('id, full_name'))) ?? []) as { id: string; full_name: string }[], []);
  const today = localDateKey(new Date(), 'Asia/Baghdad');
  const [patientId, setPatientId] = useState(defaultPatient ?? '');
  const [labId, setLabId] = useState(presetLab ?? '');
  const [tests, setTests] = useState<string[]>([]);
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [date, setDate] = useState(addDays(today, 1));
  const [win, setWin] = useState<string>('morning');
  const [notes, setNotes] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!patientId && people.data?.[0]) setPatientId(people.data[0].id); }, [people.data, patientId]);
  useEffect(() => { if (!labId && labs.data?.length === 1) setLabId(labs.data[0].id); }, [labs.data, labId]);
  const lab = useMemo(() => labs.data?.find((l) => l.id === labId) ?? null, [labs.data, labId]);
  const total = (lab?.tests.filter((t) => tests.includes(t.id)).reduce((s, t) => s + (t.price_minor ?? 0), 0) ?? 0) + (lab?.fee_minor ?? 0);
  const locate = () => navigator.geolocation?.getCurrentPosition((p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
    () => toast('تعذّر تحديد موقعك — اكتب العنوان بالتفصيل.', 'danger'));
  const submit = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('request_home_lab', {
      p_patient_id: patientId, p_lab_facility_id: labId, p_test_ids: presetOrder ? [] : tests, p_address: address, p_phone: phone,
      p_date: date, p_window: win, p_notes: notes || undefined, p_latitude: coords?.lat, p_longitude: coords?.lng, p_lab_order_id: presetOrder ?? undefined,
    });
    setBusy(false);
    if (error) { toast(errorMessage(error), 'danger'); return; }
    toast('وصل طلبك للمختبر — يوصلك إشعار لما يحدد الموعد', 'success'); onDone();
  };
  return (
    <section className="card stack">
      <strong>طلب سحب عينة من البيت</strong>
      {labs.status === 'loading' && <SkeletonList rows={2} />}
      {labs.data?.length === 0 && <Alert tone="info">ماكو مختبر يقدّم السحب المنزلي حالياً. نبلّغك أول ما يتوفر.</Alert>}
      {(people.data?.length ?? 0) > 1 && (
        <SelectField label="لمن التحليل؟" value={patientId} onChange={(e) => setPatientId(e.target.value)}>
          {people.data!.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </SelectField>
      )}
      {!!labs.data?.length && (
        <SelectField label="المختبر" value={labId} onChange={(e) => { setLabId(e.target.value); setTests([]); }} disabled={!!presetOrder}>
          <option value="">— اختر المختبر —</option>
          {labs.data.map((l) => <option key={l.id} value={l.id}>{l.name}{l.area ? ` — ${l.area}` : ''}</option>)}
        </SelectField>
      )}
      {lab?.note && <span className="small muted">{lab.note}</span>}
      {lab && !presetOrder && (
        <div className="stack-sm">
          <strong className="small">التحاليل المطلوبة</strong>
          <div className="row" style={{ gap: 6 }}>
            {lab.tests.map((t) => (
              <button key={t.id} type="button" className="chip" aria-pressed={tests.includes(t.id)}
                      onClick={() => setTests(tests.includes(t.id) ? tests.filter((x) => x !== t.id) : [...tests, t.id])}>
                {t.name}{t.price_minor != null ? ` · ${formatMoney(t.price_minor)}` : ''}
              </button>
            ))}
          </div>
          {lab.tests.filter((t) => tests.includes(t.id) && t.preparation_note).map((t) => <span key={t.id} className="small" style={{ color: 'var(--c-warning)' }}>{t.name}: {t.preparation_note}</span>)}
        </div>
      )}
      {presetOrder && <Alert tone="info">نفس التحاليل اللي طلبها طبيبك.</Alert>}
      <TextareaField label="العنوان بالتفصيل" hint="المنطقة، الشارع، رقم الدار، أقرب نقطة دالة" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
      <div className="row" style={{ gap: 6 }}>
        <Button size="sm" variant="ghost" icon={<MapPin size={14} />} onClick={locate}>{coords ? 'تم تحديد موقعك ✓' : 'أرسل موقعي الحالي'}</Button>
      </div>
      <TextField label="رقم الهاتف للتواصل" type="tel" ltr value={phone} onChange={(e) => setPhone(e.target.value)} />
      <div className="row" style={{ gap: 'var(--s-2)' }}>
        <TextField label="اليوم" type="date" ltr min={today} max={addDays(today, 30)} value={date} onChange={(e) => setDate(e.target.value)} />
        <SelectField label="الوقت المفضّل" value={win} onChange={(e) => setWin(e.target.value)}>
          {homeLabWindows.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
        </SelectField>
      </div>
      <TextareaField label="ملاحظات" optional rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      {lab && (tests.length > 0 || presetOrder) && total > 0 && (
        <span className="small">المجموع التقريبي: <strong>{formatMoney(total)}</strong>{lab.fee_minor ? ` (منها أجور الزيارة ${formatMoney(lab.fee_minor)})` : ''} — يُدفع للمختبر.</span>
      )}
      <div className="row" style={{ gap: 'var(--s-2)' }}>
        <Button loading={busy} disabled={!labId || !patientId || (!presetOrder && !tests.length) || address.trim().length < 5 || phone.trim().length < 7}
                onClick={() => void submit()}>إرسال الطلب</Button>
        <Button variant="ghost" onClick={onCancel}>إلغاء</Button>
      </div>
    </section>
  );
}
