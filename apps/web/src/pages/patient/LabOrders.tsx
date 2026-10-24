import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FlaskConical, PenLine, Plus, Trash2 } from 'lucide-react';
import { errorMessage, formatDate, localDateKey } from '@app/shared';
import { supabase } from '../../lib/supabase';
import { unwrap, useAsync } from '../../lib/useAsync';
import { useAuth } from '../../lib/auth';
import { Alert, Button, EmptyState, ErrorState, SelectField, SkeletonList, TextField, useToast } from '../../components/ui';
import { OpenOrderCard, loadMasterTests, type MasterTest, type OpenOrder } from '../../components/clinical/OpenLabOrder';
import { SignInPrompt } from './Account';

interface Entry { id: string; name: string; value_numeric: number | null; value_text: string | null; unit: string | null; taken_on: string; lab_name: string | null }

/** «طلبات التحاليل»: the doctor's open orders with their code / QR, and results the patient enters from a lab off the platform. */
export function PatientLabOrders() {
  const { session, access } = useAuth();
  const toast = useToast();
  const patientId = (access?.patient_ids?.find((x) => x.relationship === 'self') ?? access?.patient_ids?.[0])?.patient_id ?? null;
  const orders = useAsync(async () => (session ? ((await unwrap(supabase.rpc('my_open_lab_orders'))) as unknown as OpenOrder[]) : []), [session?.user.id]);
  const entries = useAsync(async () => (session
    ? ((await unwrap(supabase.from('patient_lab_entries').select('id, name, value_numeric, value_text, unit, taken_on, lab_name').order('taken_on', { ascending: false }).limit(50))) ?? []) as Entry[]
    : []), [session?.user.id]);
  const master = useAsync(loadMasterTests, []);
  const [entering, setEntering] = useState<{ order?: OpenOrder; item?: OpenOrder['items'][number] } | null>(null);
  if (!session) return <SignInPrompt title="طلبات التحاليل" />;
  const reload = () => { orders.reload(); entries.reload(); };
  const remove = async (id: string) => {
    const { error } = await supabase.rpc('delete_self_lab_result', { p_entry_id: id });
    if (error) toast(errorMessage(error), 'danger'); else { toast('حُذفت النتيجة', 'success'); reload(); }
  };
  return (
    <div className="stack">
      <div className="row-between">
        <h1 style={{ fontSize: 'var(--f-h2)' }}>طلبات التحاليل</h1>
        {!entering && <Button variant="secondary" icon={<Plus size={18} />} onClick={() => setEntering({})}>أضف نتيجة تحليل</Button>}
      </div>
      <span className="small muted">اعرض الرمز أو الـ QR في أي مختبر يستخدم التطبيق فيُضاف الطلب عنده وتصلك النتيجة. إذا سويت التحليل بمختبر ثاني، أدخل النتيجة بنفسك وتطلع بصحتي ويشوفها طبيبك.</span>
      {entering && patientId && (
        <SelfResultForm patientId={patientId} master={master.data ?? []} order={entering.order} item={entering.item}
                        onDone={() => { setEntering(null); reload(); }} onCancel={() => setEntering(null)} />
      )}
      {orders.status === 'loading' && !orders.data && <SkeletonList rows={2} />}
      {orders.status === 'error' && <ErrorState error={orders.error} onRetry={orders.reload} />}
      {orders.data?.length === 0 && (
        <div className="card"><EmptyState icon={<FlaskConical />} title="ما عندك طلبات تحاليل">لما يطلب طبيبك تحاليل بدون مختبر محدد، يظهر الطلب هنا مع رمزه.</EmptyState></div>
      )}
      {orders.data?.map((o) => (
        <OpenOrderCard key={o.id} o={o}>
          {!o.expired && !o.cancelled && o.items.filter((i) => i.status === 'open').map((i) => (
            <Button key={i.id} size="sm" variant="ghost" icon={<PenLine size={14} />} onClick={() => setEntering({ order: o, item: i })}>أدخل نتيجة {i.name}</Button>
          ))}
        </OpenOrderCard>
      ))}
      {!!entries.data?.length && (
        <section className="card stack-sm">
          <h3 className="section-title">نتائج أدخلتها</h3>
          {entries.data.map((e) => (
            <div key={e.id} className="row-between small">
              <span><strong>{e.name}</strong> <span dir="ltr">{e.value_numeric ?? e.value_text} {e.unit ?? ''}</span></span>
              <span className="row" style={{ gap: 6 }}>
                <span className="muted">{formatDate(e.taken_on)}{e.lab_name ? ` · ${e.lab_name}` : ''}</span>
                <button className="btn btn-ghost btn-sm" aria-label={`حذف ${e.name}`} onClick={() => void remove(e.id)}><Trash2 size={14} aria-hidden /></button>
              </span>
            </div>
          ))}
          <Link className="small" to="/patient/health">شوف الرسوم والمقارنة في «صحتي»</Link>
        </section>
      )}
    </div>
  );
}

function SelfResultForm({ patientId, master, order, item, onDone, onCancel }: {
  patientId: string; master: MasterTest[]; order?: OpenOrder; item?: OpenOrder['items'][number]; onDone: () => void; onCancel: () => void;
}) {
  const toast = useToast();
  const [masterId, setMasterId] = useState(item?.master_id ?? '');
  const m = master.find((t) => t.id === masterId);
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('');
  const [range, setRange] = useState('');
  const [date, setDate] = useState(localDateKey(new Date()));
  const [lab, setLab] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('add_self_lab_result', {
      p_patient_id: order?.patient_id ?? patientId, p_name: item?.name ?? (m?.name_ar || name), p_value: value, p_taken_on: date,
      p_unit: unit || undefined, p_reference_range: range || undefined, p_lab_name: lab || undefined,
      p_master_id: masterId || undefined, p_open_item_id: item?.id,
    });
    setBusy(false);
    if (error) { toast(errorMessage(error), 'danger'); return; }
    toast('حُفظت النتيجة — تطلع بصحتي مع الرسم والمقارنة', 'success');
    onDone();
  };
  return (
    <section className="card stack-sm">
      <h3 className="section-title">{item ? `نتيجة ${item.name}` : 'أضف نتيجة تحليل'}</h3>
      {!item?.master_id && (
        <SelectField label="التحليل" value={masterId} onChange={(e) => setMasterId(e.target.value)}>
          <option value="">— تحليل غير موجود بالقائمة —</option>
          {master.map((t) => <option key={t.id} value={t.id}>{t.name_ar}{t.name_en ? ` (${t.name_en})` : ''}</option>)}
        </SelectField>
      )}
      {!item && !masterId && <TextField label="اسم التحليل" value={name} onChange={(e) => setName(e.target.value)} />}
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <div className="grow"><TextField label="النتيجة" ltr inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} /></div>
        <div className="grow"><TextField label="الوحدة" optional ltr placeholder={m?.unit ?? item?.unit ?? ''} value={unit} onChange={(e) => setUnit(e.target.value)} /></div>
        <div className="grow"><TextField label="المجال الطبيعي" optional ltr placeholder={m?.reference_range ?? item?.reference_range ?? '70-100'}
                                         hint="من ورقة المختبر، وإذا تركته نستخدم المجال المعتمد" value={range} onChange={(e) => setRange(e.target.value)} /></div>
      </div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <div className="grow"><TextField label="تاريخ التحليل" type="date" ltr value={date} max={localDateKey(new Date())} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="grow"><TextField label="اسم المختبر" optional value={lab} onChange={(e) => setLab(e.target.value)} /></div>
      </div>
      <Alert tone="info">النتيجة تتعلّم «أدخلها المريض» حتى يعرف طبيبك مصدرها.</Alert>
      <div className="row" style={{ gap: 8 }}>
        <Button loading={busy} disabled={!value.trim() || !date || (!item && !masterId && name.trim().length < 2)} onClick={() => void submit()}>حفظ النتيجة</Button>
        <Button variant="ghost" onClick={onCancel}>إلغاء</Button>
      </div>
    </section>
  );
}
