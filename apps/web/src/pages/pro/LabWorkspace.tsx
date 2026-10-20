import { useCallback, useEffect, useMemo, useState } from 'react';
import { Barcode, CheckCircle2, FlaskConical, Inbox, PencilLine, Plus, Search, Send, TestTube2, XCircle } from 'lucide-react';
import { errorMessage, formatDateTime, formatMoney, labStatus, type LabStatus } from '@app/shared';
import { supabase } from '../../lib/supabase';
import { unwrap, useAsync } from '../../lib/useAsync';
import { useWorkspace } from '../../lib/workspace';
import { newIdempotencyKey } from '../../lib/idempotency';
import { Alert, Badge, Button, ConfirmDialog, EmptyState, ErrorState, Ltr, PageHead, SelectField, Sheet, SkeletonList, TextField, TextareaField, useToast } from '../../components/ui';
import { LabResultView, type LabDetail, type LabResult } from '../../components/clinical/LabResultView';
import { Attachments } from '../../components/clinical/Attachments';
import { InvoiceSheet } from '../../components/InvoiceSheet';

interface Row { order_id: string; order_number: string; status: LabStatus; source: string; created_at: string; patient_name: string; patient_code: string;
  ordering_doctor: string | null; ordering_facility: string | null; item_count: number; released_count: number; latest_barcode: string | null }
const STAGES: { id: string; label: string; statuses: LabStatus[] | null }[] = [
  { id: 'all', label: 'الكل', statuses: null },
  { id: 'collect', label: 'بانتظار السحب', statuses: ['ordered', 'scheduled', 'checked_in', 'sample_rejected'] },
  { id: 'process', label: 'قيد المعالجة', statuses: ['sample_collected', 'processing'] },
  { id: 'review', label: 'بانتظار الاعتماد', statuses: ['pending_review'] },
  { id: 'released', label: 'منشورة', statuses: ['released'] },
];

export function LabWorkspace() {
  const { current } = useWorkspace();
  const labId = current!.facility_id!;
  // one person can run a small lab: every lab member records, follows up and releases
  const isApprover = current!.role === 'lab_technician' || current!.role === 'lab_approver';
  const [stage, setStage] = useState('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [direct, setDirect] = useState(false);
  const list = useAsync(async () => (await unwrap(supabase.rpc('lab_worklist', { p_lab_facility_id: labId }))) as Row[], [labId]);
  const reload = useCallback(() => list.reload(), [list.reload]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const ch = supabase.channel(`lab:${labId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'lab_orders', filter: `lab_facility_id=eq.${labId}` }, reload).subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [labId, reload]);

  const rows = useMemo(() => {
    const st = STAGES.find((s) => s.id === stage)?.statuses;
    const needle = q.trim().toLowerCase();
    return (list.data ?? []).filter((r) => (!st || st.includes(r.status))
      && (!needle || [r.order_number, r.latest_barcode ?? '', r.patient_name, r.patient_code].some((x) => x.toLowerCase().includes(needle))));
  }, [list.data, stage, q]);
  const count = (s: (typeof STAGES)[number]) => (list.data ?? []).filter((r) => !s.statuses || s.statuses.includes(r.status)).length;

  return (
    <div className="stack">
      <PageHead title="طلبات المختبر" subtitle={`${current!.facility_name} · موظف المختبر`}
                actions={<Button icon={<Plus size={18} />} onClick={() => setDirect(true)}>مراجع مباشر</Button>} />
      <div className="row-between">
        <div className="chips" role="group" aria-label="مراحل العمل">
          {STAGES.map((s) => <button key={s.id} className="chip" aria-pressed={stage === s.id} onClick={() => setStage(s.id)}>{s.label} ({count(s)})</button>)}
        </div>
        <div className="input-icon" style={{ minWidth: 260 }}>
          <Search size={18} aria-hidden />
          <label className="sr-only" htmlFor="labq">بحث برقم الطلب أو العينة أو المريض</label>
          <input id="labq" className="input" placeholder="رقم الطلب / الباركود / المريض" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <section className="card card-flush">
        {list.status === 'loading' && !list.data && <SkeletonList rows={4} />}
        {list.status === 'error' && <ErrorState error={list.error} onRetry={reload} />}
        {list.data && rows.length === 0 && <EmptyState icon={<Inbox />} title="لا توجد طلبات في هذه المرحلة" />}
        {!!rows.length && (
          <div className="table-wrap" role="region" aria-label="الطلبات" tabIndex={0}>
            <table className="table">
              <thead><tr><th>الطلب</th><th>المريض</th><th>المصدر</th><th>الفحوصات</th><th>الحالة</th><th><span className="sr-only">فتح</span></th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.order_id}>
                    <td><Ltr>{r.order_number}</Ltr><div className="small muted">{formatDateTime(r.created_at)}</div>{r.latest_barcode && <div className="small"><Barcode size={12} aria-hidden /> <Ltr>{r.latest_barcode}</Ltr></div>}</td>
                    <td>{r.patient_name}<div className="small muted"><Ltr>{r.patient_code}</Ltr></div></td>
                    <td className="small">{r.source === 'referral' ? <>إحالة: {r.ordering_doctor}<div className="muted">{r.ordering_facility}</div></> : 'زيارة مباشرة'}</td>
                    <td className="small num">{r.released_count}/{r.item_count} منشورة</td>
                    <td><Badge tone={labStatus[r.status].tone}>{labStatus[r.status].label}</Badge></td>
                    <td><Button size="sm" variant="secondary" onClick={() => setOpen(r.order_id)}>فتح</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {open && <OrderSheet orderId={open} isApprover={isApprover} onClose={() => { setOpen(null); reload(); }} onChanged={reload} />}
      {direct && <DirectVisitSheet labId={labId} onClose={() => setDirect(false)} onCreated={(id) => { setDirect(false); reload(); setOpen(id); }} />}
    </div>
  );
}

type ResultForm = { value: string; unit: string; range: string; flag: string; notes: string };

/**
 * One lab member runs the order in two steps: receive the patient (check-in +
 * sample), then complete it with typed values and/or an uploaded result file —
 * one action publishes it to the patient and the ordering doctor.
 */
function OrderSheet({ orderId, isApprover, onClose, onChanged }: { orderId: string; isApprover: boolean; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const d = useAsync(async () => (await unwrap(supabase.rpc('lab_order_detail', { p_order_id: orderId }))) as unknown as LabDetail, [orderId]);
  const [reject, setReject] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [correcting, setCorrecting] = useState<LabResult | null>(null);
  const [fees, setFees] = useState(false);
  const [busy, setBusy] = useState<'receive' | 'save' | 'complete' | null>(null);
  const [files, setFiles] = useState(0);
  const [forms, setForms] = useState<Record<string, ResultForm>>({});

  useEffect(() => {
    if (!d.data) return;
    setForms((prev) => {
      const next = { ...prev };
      for (const it of d.data!.items) {
        if (next[it.id]) continue;
        const dr = it.results.find((r) => r.status === 'draft');
        next[it.id] = { value: dr ? String(dr.value_numeric ?? dr.value_text ?? '') : '', unit: dr?.unit ?? it.catalog.unit ?? '',
          range: dr?.reference_range ?? it.catalog.reference_range_text ?? '', flag: dr?.lab_flag ?? '', notes: dr?.notes ?? '' };
      }
      return next;
    });
  }, [d.data]);

  if (!d.data) return <Sheet open size="lg" onClose={onClose} title="طلب مختبر">{d.status === 'error' ? <ErrorState error={d.error} onRetry={d.reload} /> : <SkeletonList />}</Sheet>;
  const o = d.data;
  const collected = o.specimens?.find((s) => s.status === 'collected');
  const received = !!collected && !['ordered', 'scheduled', 'checked_in', 'sample_rejected'].includes(o.order.status);
  const pending = o.items.filter((i) => !['released', 'cancelled'].includes(i.status));
  const hasValue = (id: string) => !!forms[id]?.value.trim() || !!o.items.find((i) => i.id === id)?.results.some((r) => r.status === 'draft');
  const ready = pending.length > 0 && (files > 0 || pending.every((i) => hasValue(i.id)));
  const done = () => { d.reload(); onChanged(); };
  const set = (id: string, patch: Partial<ResultForm>) => setForms({ ...forms, [id]: { ...forms[id], ...patch } });

  const receive = async () => {
    setBusy('receive');
    if (['ordered', 'scheduled'].includes(o.order.status)) {
      const r = await supabase.rpc('lab_check_in', { p_order_id: o.order.id });
      if (r.error) { setBusy(null); toast(errorMessage(r.error), 'danger'); return; }
    }
    const { error } = await supabase.rpc('collect_specimen', { p_order_id: o.order.id, p_specimen_type: o.items[0]?.catalog.specimen_type ?? 'عينة' });
    setBusy(null);
    if (error) toast(errorMessage(error), 'danger'); else { toast('استُقبل المراجع وسُجلت العينة', 'success'); done(); }
  };
  const payload = () => pending.map((i) => ({ item_id: i.id, ...forms[i.id] }));
  const saveOnly = async () => {
    setBusy('save');
    for (const i of pending) {
      const f = forms[i.id];
      if (!f?.value.trim()) continue;
      const numeric = /^-?\d+(\.\d+)?$/.test(f.value.trim());
      const { error } = await supabase.rpc('save_lab_result_draft', {
        p_order_item_id: i.id, p_value_numeric: numeric ? Number(f.value) : undefined, p_value_text: numeric ? undefined : f.value,
        p_unit: f.unit || undefined, p_reference_range: f.range || undefined, p_lab_flag: f.flag || undefined, p_notes: f.notes || undefined });
      if (error) { setBusy(null); toast(errorMessage(error), 'danger'); return; }
    }
    setBusy(null); toast('حُفظت القيم (غير منشورة بعد)', 'success'); done();
  };
  const complete = async () => {
    setBusy('complete');
    const { error } = await supabase.rpc('complete_lab_order', { p_order_id: o.order.id, p_results: payload() as never });
    setBusy(null); setConfirm(false);
    if (error) toast(errorMessage(error), 'danger'); else { toast('اكتمل التحليل ونُشرت النتيجة للمريض والطبيب', 'success'); done(); }
  };

  return (
    <Sheet open size="lg" onClose={onClose} title={`طلب ${o.order.order_number}`}>
      <div className="stack">
        {/* identity of patient + specimen always visible when publishing (§26-5) */}
        <div className="card stack-sm" style={{ background: 'var(--c-surface-sunken)' }}>
          <strong>{o.patient.full_name}</strong>
          <span className="small"><Ltr>{o.patient.public_code}</Ltr>{o.patient.birth_year ? ` · مواليد ${o.patient.birth_year}` : ''}{o.patient.sex ? ` · ${o.patient.sex === 'female' ? 'أنثى' : 'ذكر'}` : ''}
            {o.ordering_doctor ? ` · الطبيب: ${o.ordering_doctor}` : ' · مراجع مباشر'}</span>
          <span className="small">الفحوصات: {o.items.map((i) => i.name).join('، ')}</span>
          {o.order.clinical_note && <span className="small">سبب الطلب: {o.order.clinical_note}</span>}
        </div>

        {o.order.status !== 'released' && (
          <section className="card stack-sm" aria-labelledby="step-receive">
            <h3 id="step-receive" className="section-title">١. استقبال المراجع</h3>
            {received ? (
              <div className="row-between">
                <span className="small"><CheckCircle2 size={16} aria-hidden style={{ verticalAlign: '-3px', color: 'var(--c-success)' }} /> تم الاستقبال · العينة <Ltr>{collected!.barcode}</Ltr> · {formatDateTime(collected!.collected_at)}</span>
                <Button size="sm" variant="ghost" icon={<XCircle size={16} />} onClick={() => setReject(collected!.id)}>رفض العينة</Button>
              </div>
            ) : (
              <>
                <p className="small muted">عند حضور المراجع: اضغط ليُسجَّل الحضور وتُنشأ العينة برقم وباركود.</p>
                <Button icon={<TestTube2 size={18} />} loading={busy === 'receive'} onClick={() => void receive()}>استقبال المراجع وبدء الفحص</Button>
              </>
            )}
          </section>
        )}

        {pending.length > 0 && (
          <section className="card stack" aria-labelledby="step-result">
            <h3 id="step-result" className="section-title">٢. النتيجة</h3>
            <p className="small muted">اكتب قيمة كل تحليل، أو ارفع ملف النتيجة (PDF أو صورة)، أو الاثنين. بعدها «إكمال التحليل».</p>
            {pending.map((it) => {
              const f = forms[it.id] ?? { value: '', unit: '', range: '', flag: '', notes: '' };
              return (
                <fieldset key={it.id} className="stack-sm lab-result-row">
                  <legend className="row-between" style={{ width: '100%' }}><strong>{it.name}</strong>
                    {it.results.some((r) => r.status === 'draft') ? <Badge tone="neutral">محفوظة — غير منشورة</Badge> : null}</legend>
                  <div className="rx-grid">
                    <TextField label="القيمة" optional={files > 0} ltr value={f.value} onChange={(e) => set(it.id, { value: e.target.value })} />
                    <TextField label="الوحدة" ltr value={f.unit} onChange={(e) => set(it.id, { unit: e.target.value })} />
                    <TextField label="المجال المرجعي" value={f.range} onChange={(e) => set(it.id, { range: e.target.value })} />
                    <SelectField label="وسم المختبر" value={f.flag} onChange={(e) => set(it.id, { flag: e.target.value })}>
                      <option value="">—</option><option value="low">منخفض</option><option value="high">مرتفع</option><option value="abnormal">غير طبيعي</option><option value="critical">حرج (سياسة المختبر)</option>
                    </SelectField>
                  </div>
                  <TextField label="ملاحظة" optional value={f.notes} onChange={(e) => set(it.id, { notes: e.target.value })} />
                </fieldset>
              );
            })}
            <Attachments kind="lab_result" refId={o.order.id} canUpload onCount={setFiles} />
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <Button variant="ghost" size="sm" loading={busy === 'save'} disabled={!received} onClick={() => void saveOnly()}>حفظ بدون نشر</Button>
              <Button variant="accent" icon={<Send size={18} />} disabled={!ready} onClick={() => setConfirm(true)}>إكمال التحليل ونشر النتيجة</Button>
            </div>
            {!ready && <span className="small muted">يتفعّل الزر عندما تُكتب كل القيم أو يُرفع ملف النتيجة.</span>}
          </section>
        )}

        {o.items.some((i) => i.results.some((r) => r.status === 'released')) && (
          <section className="stack-sm">
            {o.items.map((it) => {
              const rel = it.results.find((r) => r.status === 'released');
              return rel ? (
                <div key={it.id} className="row-between small">
                  <span>{it.name}: <strong className="num">{rel.value_numeric ?? rel.value_text}</strong> {rel.unit ?? ''} {rel.lab_flag ? `(${rel.lab_flag})` : ''}</span>
                  {isApprover && <Button size="sm" variant="ghost" icon={<PencilLine size={14} />} onClick={() => setCorrecting(rel)}>تصحيح</Button>}
                </div>
              ) : null;
            })}
          </section>
        )}
        {o.order.status === 'released' && <LabResultView d={o} />}
        <div className="row"><Button variant="ghost" size="sm" onClick={() => setFees(true)}>الرسوم والإيصال</Button></div>
      </div>

      <ConfirmDialog open={!!reject} title="رفض العينة" confirmLabel="رفض وطلب سحب جديد" tone="danger" onCancel={() => setReject(null)}
                     onConfirm={async () => {
                       const { error } = await supabase.rpc('reject_specimen', { p_specimen_id: reject!, p_reason: reason });
                       if (error) { toast(errorMessage(error), 'danger'); return; }
                       toast('رُفضت العينة؛ يلزم سحب جديد', 'success'); setReject(null); setReason(''); done();
                     }}>
        <TextareaField label="السبب" required value={reason} onChange={(e) => setReason(e.target.value)} />
      </ConfirmDialog>
      <ConfirmDialog open={confirm} title="إكمال التحليل ونشر النتيجة" confirmLabel="إكمال ونشر" loading={busy === 'complete'} onCancel={() => setConfirm(false)} onConfirm={() => void complete()}>
        <p>المريض: <strong>{o.patient.full_name}</strong> (<Ltr>{o.patient.public_code}</Ltr>){collected && <> · العينة <Ltr>{collected.barcode}</Ltr></>}</p>
        <p>الفحوصات: {pending.map((i) => i.name).join('، ')}</p>
        {files > 0 && <p>الملفات المرفقة: {files}</p>}
        <p>تصل النتيجة إلى: المريض{o.ordering_doctor ? <> والطبيب <strong>{o.ordering_doctor}</strong></> : ''}.</p>
        <p className="small muted">بعد النشر لا تُعدّل النتيجة إلا بتصحيح يحتفظ بالأصل والسبب.</p>
      </ConfirmDialog>
      {fees && <InvoiceSheet labOrderId={o.order.id} onClose={() => setFees(false)} />}
      {correcting && <CorrectDialog result={correcting} onClose={() => setCorrecting(null)} onDone={() => { setCorrecting(null); done(); }} />}
    </Sheet>
  );
}

function CorrectDialog({ result, onClose, onDone }: { result: LabResult; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ value: String(result.value_numeric ?? result.value_text ?? ''), flag: result.lab_flag ?? '', reason: '', notes: result.notes ?? '' });
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    const numeric = /^-?\d+(\.\d+)?$/.test(f.value.trim());
    const { error } = await supabase.rpc('correct_lab_result', { p_result_id: result.id, p_reason: f.reason,
      p_value_numeric: numeric ? Number(f.value) : undefined, p_value_text: numeric ? undefined : f.value, p_lab_flag: f.flag || undefined, p_notes: f.notes || undefined });
    setBusy(false);
    if (error) { toast(errorMessage(error), 'danger'); return; }
    toast('نُشر إصدار مصحح وأُبلغ المريض والطبيب', 'success'); onDone();
  };
  return (
    <ConfirmDialog open title="تصحيح نتيجة منشورة" confirmLabel="نشر التصحيح" loading={busy} onCancel={onClose} onConfirm={submit}>
      <p className="small">يُحتفظ بالنتيجة الأصلية ويُضاف إصدار جديد مع السبب.</p>
      <TextField label="القيمة الصحيحة" ltr value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} />
      <SelectField label="وسم المختبر" value={f.flag} onChange={(e) => setF({ ...f, flag: e.target.value })}>
        <option value="">—</option><option value="low">منخفض</option><option value="high">مرتفع</option><option value="abnormal">غير طبيعي</option><option value="critical">حرج</option>
      </SelectField>
      <TextareaField label="سبب التصحيح" required value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
    </ConfirmDialog>
  );
}

interface Candidate { patient_id: string; public_code: string; full_name: string; birth_year: number | null; phone_masked: string | null; known_here: boolean }
interface Test { id: string; name: string; specimen_type: string; price_minor: number | null; preparation_note: string | null }

function DirectVisitSheet({ labId, onClose, onCreated }: { labId: string; onClose: () => void; onCreated: (orderId: string) => void }) {
  const toast = useToast();
  const tests = useAsync(async () => (await unwrap(supabase.from('lab_test_catalog').select('id, name, specimen_type, price_minor, preparation_note').eq('lab_facility_id', labId).eq('is_active', true).order('name'))) as Test[], [labId]);
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [query, setQuery] = useState('');
  const [cands, setCands] = useState<Candidate[] | null>(null);
  const [picked, setPicked] = useState<Candidate | null>(null);
  const [verification, setVerification] = useState('');
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [idem] = useState(() => newIdempotencyKey('labdirect'));

  const search = async () => {
    const { data, error } = await supabase.rpc('lookup_patients', { p_facility_id: labId, p_query: query });
    if (error) { toast(errorMessage(error), 'danger'); return; }
    setCands(data as Candidate[]); setPicked(null);
  };
  const submit = async () => {
    setBusy(true);
    let patientId = picked?.patient_id;
    if (mode === 'new') {
      const { data, error } = await supabase.rpc('create_provisional_patient', { p_facility_id: labId, p_full_name: name });
      if (error) { setBusy(false); toast(errorMessage(error), 'danger'); return; }
      patientId = (data as { id: string }).id;
    } else if (picked && !picked.known_here) {
      const { error } = await supabase.rpc('attach_patient_to_facility', { p_facility_id: labId, p_patient_id: picked.patient_id, p_verification_note: verification });
      if (error) { setBusy(false); toast(errorMessage(error), 'danger'); return; }
    }
    const { data, error } = await supabase.rpc('lab_register_direct', { p_lab_facility_id: labId, p_patient_id: patientId!, p_test_ids: selected, p_idempotency_key: idem });
    setBusy(false);
    if (error) { toast(errorMessage(error), 'danger'); return; }
    toast('سُجل المراجع وطلب الفحوصات', 'success');
    onCreated((data as { id: string }).id);
  };
  const ready = selected.length > 0 && (mode === 'new' ? name.trim().length > 0 : !!picked && (picked.known_here || verification.trim().length >= 3));

  return (
    <Sheet open size="lg" onClose={onClose} title="مراجع مباشر (بدون إحالة)" footer={<Button block icon={<FlaskConical size={18} />} disabled={!ready} loading={busy} onClick={submit}>تسجيل الطلب</Button>}>
      <div className="stack">
        <div className="segmented" role="group" aria-label="نوع المراجع">
          <button aria-pressed={mode === 'existing'} onClick={() => setMode('existing')}>مراجع موجود</button>
          <button aria-pressed={mode === 'new'} onClick={() => setMode('new')}>سجل جديد</button>
        </div>
        {mode === 'existing' ? (
          <div className="stack-sm">
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <div className="grow"><TextField label="الهاتف أو المعرّف أو رمز QR" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
              <Button variant="secondary" style={{ alignSelf: 'flex-end' }} onClick={search} disabled={query.trim().length < 3}>بحث</Button>
            </div>
            {cands?.length === 0 && <Alert tone="info">لا نتائج — أنشئ سجلاً جديداً.</Alert>}
            {(cands?.length ?? 0) > 1 && <Alert tone="warning">عدة مرشحين — تحقق من الهوية؛ لا يُختار أول نتيجة تلقائياً.</Alert>}
            {cands?.map((c) => (
              <button key={c.patient_id} className="lookup-result" aria-pressed={picked?.patient_id === c.patient_id} onClick={() => setPicked(c)} style={{ textAlign: 'start', cursor: 'pointer' }}>
                <span className="grow"><strong>{c.full_name}</strong><br /><span className="small muted"><Ltr>{c.public_code}</Ltr>{c.birth_year ? ` · ${c.birth_year}` : ''}{c.phone_masked && <> · <Ltr>{c.phone_masked}</Ltr></>}</span></span>
                {c.known_here ? <Badge tone="success">مسجل هنا</Badge> : <Badge tone="warning">يحتاج تحقق</Badge>}
              </button>
            ))}
            {picked && !picked.known_here && <TextareaField label="طريقة التحقق من الهوية" required value={verification} onChange={(e) => setVerification(e.target.value)} />}
          </div>
        ) : <TextField label="الاسم" required value={name} onChange={(e) => setName(e.target.value)} hint="سجل مؤقت قابل للربط لاحقاً بحساب بعد التحقق." />}
        <div className="radio-cards" role="group" aria-label="الفحوصات">
          {tests.data?.map((t) => (
            <label key={t.id} className="radio-card">
              <input type="checkbox" checked={selected.includes(t.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, t.id] : selected.filter((x) => x !== t.id))} />
              <strong>{t.name}</strong><span className="small muted">{t.specimen_type} · {formatMoney(t.price_minor)}</span>
              {t.preparation_note && <span className="small" style={{ color: 'var(--c-warning)' }}>{t.preparation_note}</span>}
            </label>
          ))}
        </div>
        <p className="small muted"><CheckCircle2 size={14} aria-hidden style={{ verticalAlign: '-2px' }} /> نتائج الزيارة المباشرة تظهر للمريض أولاً، ويمكنه مشاركتها لاحقاً مع طبيب يختاره.</p>
      </div>
    </Sheet>
  );
}
