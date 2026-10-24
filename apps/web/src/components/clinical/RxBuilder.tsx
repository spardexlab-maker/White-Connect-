import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, FilePen, Plus, Printer, Search, Send, Trash2 } from 'lucide-react';
import { errorMessage } from '@app/shared';
import { supabase } from '../../lib/supabase';
import { unwrap, useAsync } from '../../lib/useAsync';
import { newIdempotencyKey } from '../../lib/idempotency';
import { Alert, Badge, Button, ConfirmDialog, SelectField, Tabs, TextField, useToast } from '../ui';
import { RxDocument, type RxDoc, type RxItem } from './RxDocument';

interface Med { medication_id: string; active_ingredient: string; brand_name: string | null; strength: string; dosage_form: string; availability: string; availability_updated_at: string | null }
interface Row {
  key: string; medication_id: string | null; display_name: string; dose: string; dose_unit: string; route: string;
  frequency_text: string; interval_hours: string; duration_days: string; quantity: string; quantity_unit: string; instructions: string; as_needed: boolean; max_daily: string;
}
interface Pharmacy { pharmacy_id: string; name: string; branch: string; is_default: boolean }
export interface EncounterOrders {
  prescriptions: { id: string; rx_number: string; status: 'draft' | 'active' | 'cancelled'; current_version_no: number | null;
    draft: { version_id: string; version_no: number; items: (RxItem & { medication_id: string | null })[] } | null;
    approved_items: RxItem[] | null; dispatches: { pharmacy: string; status: string }[] }[];
  lab_orders: { id: string; order_number: string; status: string; lab: string; items: { name: string; status: string }[] }[];
}

const DOSE_UNITS = ['حبة', 'كبسولة', 'ملعقة صغيرة', 'مل', 'بخة', 'قطرة', 'أمبولة', 'كيس'];
/** times a day → hours between doses */
const TIMES_PER_DAY: [number, string][] = [[1, '24'], [2, '12'], [3, '8'], [4, '6'], [6, '4']];
const TIMES_TEXT: Record<string, string> = { '24': 'مرة واحدة يومياً', '12': 'مرتين يومياً', '8': '3 مرات يومياً', '6': '4 مرات يومياً', '4': '6 مرات يومياً' };
const emptyRow = (): Row => ({ key: crypto.randomUUID(), medication_id: null, display_name: '', dose: '', dose_unit: '', route: 'بالفم',
  frequency_text: '', interval_hours: '', duration_days: '', quantity: '', quantity_unit: '', instructions: '', as_needed: false, max_daily: '' });

function toRow(i: RxItem & { medication_id?: string | null }): Row {
  return { key: crypto.randomUUID(), medication_id: i.medication_id ?? null, display_name: i.display_name, dose: i.dose != null ? String(Number(i.dose)) : '',
    dose_unit: i.dose_unit ?? '', route: i.route ?? '', frequency_text: i.frequency_text ?? '', interval_hours: i.interval_hours ? String(i.interval_hours) : '', duration_days: i.duration_days ? String(i.duration_days) : '',
    quantity: i.quantity != null ? String(Number(i.quantity)) : '', quantity_unit: i.quantity_unit ?? '', instructions: i.instructions ?? '',
    as_needed: i.as_needed, max_daily: i.max_daily ?? '' };
}

/**
 * Prescription builder for the active session. The patient whose session
 * this is is passed in and the component is keyed by encounter, so the
 * next patient never inherits the previous prescription (§24).
 */
export function RxBuilder({ encounterId, facilityId, patientName, orders, onChanged, preview, diagnosisMissing }: {
  encounterId: string; facilityId: string; patientName: string; orders: EncounterOrders | null; onChanged: () => void; diagnosisMissing?: boolean;
  preview: Omit<RxDoc, 'items' | 'rx_number' | 'version_no'>;
}) {
  const toast = useToast();
  const pharmacies = useAsync(async () => (await unwrap(supabase.rpc('pharmacy_choices', { p_encounter_id: encounterId }))) as Pharmacy[], [encounterId]);
  const current = orders?.prescriptions.find((p) => p.status !== 'cancelled') ?? null;
  const editing = !current || !!current.draft;
  const [rows, setRows] = useState<Row[]>(() => current?.draft?.items.map(toRow) ?? [emptyRow()]);
  const [sendNow, setSendNow] = useState(false);                         // printing for the patient is always the default
  const [destination, setDestination] = useState<string>('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<'save' | 'approve' | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [mobileTab, setMobileTab] = useState<'edit' | 'preview'>('edit');
  const [idem] = useState(() => newIdempotencyKey('rx'));
  const dirty = useRef(false);

  useEffect(() => { if (current?.draft) setRows(current.draft.items.map(toRow)); }, [current?.draft?.version_id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const def = pharmacies.data?.find((p) => p.is_default); if (def) setDestination(def.pharmacy_id); }, [pharmacies.data]);

  const items = rows.filter((r) => r.display_name.trim());
  const isRevision = !!current && (current.current_version_no ?? 0) > 0;
  const dest = pharmacies.data?.find((p) => p.pharmacy_id === destination);
  const sendTo = sendNow && destination ? destination : '';

  const payload = () => items.map((r) => ({
    medication_id: r.medication_id, display_name: r.display_name, dose: r.dose, dose_unit: r.dose_unit, route: r.route,
    frequency_text: r.frequency_text, interval_hours: r.interval_hours, duration_days: r.duration_days, quantity: r.quantity, quantity_unit: r.quantity_unit,
    instructions: r.instructions, as_needed: r.as_needed, max_daily: r.max_daily,
  }));

  const saveDraft = async (): Promise<string | null> => {
    if (!items.length) { toast('أضف دواءً واحداً على الأقل', 'danger'); return null; }
    setBusy('save');
    const { data, error } = await supabase.rpc('save_prescription_draft', {
      p_encounter_id: encounterId, p_items: payload(), p_idempotency_key: idem, p_prescription_id: current?.id,
    });
    setBusy(null);
    if (error) { toast(errorMessage(error), 'danger'); return null; }
    dirty.current = false;
    onChanged();
    return (data as { prescription_id: string }).prescription_id;
  };

  const approve = async () => {
    const id = await saveDraft();
    if (!id) return;
    setBusy('approve');
    const { error } = await supabase.rpc('approve_prescription', {
      p_prescription_id: id, p_send_to_pharmacy_id: sendTo || undefined, p_revision_reason: isRevision ? reason : undefined,
    });
    setBusy(null);
    setConfirm(false);
    if (error) { toast(errorMessage(error), 'danger'); return; }
    toast(sendTo ? `اعتُمدت الوصفة وأُرسلت إلى ${dest?.name}` : 'اعتُمدت الوصفة — اطبعها وسلّمها للمريض', 'success');
    onChanged();
  };

  const startRevision = async () => {
    if (!current) return;
    const { error } = await supabase.rpc('revise_prescription', { p_prescription_id: current.id });
    if (error) toast(errorMessage(error), 'danger'); else onChanged();
  };

  const previewDoc: RxDoc = useMemo(() => ({
    ...preview, rx_number: current?.rx_number ?? '—', version_no: (current?.current_version_no ?? 0) + (editing ? 1 : 0),
    items: items.map((r, i) => ({ line_no: i + 1, display_name: r.display_name, dose: r.dose ? Number(r.dose) : null, dose_unit: r.dose_unit || null,
      route: r.route || null, frequency_text: r.frequency_text || null, interval_hours: r.interval_hours ? Number(r.interval_hours) : null, duration_days: r.duration_days ? Number(r.duration_days) : null,
      start_date: null, quantity: r.quantity ? Number(r.quantity) : null, quantity_unit: r.quantity_unit || null, instructions: r.instructions || null,
      as_needed: r.as_needed, max_daily: r.max_daily || null })),
  }), [preview, items, current, editing]);

  if (!editing && current) {
    const sentNames = current.dispatches.map((d) => d.pharmacy);
    const sendLater = async () => {
      if (!destination) return;
      setBusy('approve');
      const { error } = await supabase.rpc('send_prescription_to_pharmacy', { p_prescription_id: current.id, p_pharmacy_id: destination });
      setBusy(null);
      if (error) { toast(errorMessage(error), 'danger'); return; }
      toast(`أُرسلت الوصفة إلى ${dest?.name}`, 'success');
      onChanged();
    };
    return (
      <div className="stack">
        <Alert tone="success" title={`الوصفة ${current.rx_number} معتمدة — إصدار ${current.current_version_no}`}>
          اطبع الوصفة واختمها وسلّمها للمريض. {sentNames.length ? `أُرسلت أيضاً إلى: ${sentNames.join('، ')}.` : 'لم تُرسل لأي صيدلية.'}
        </Alert>
        <div className="row">
          <Link className="btn btn-primary btn-lg" to={`/print/rx/${current.id}?facility=${facilityId}`}><Printer size={18} aria-hidden />طباعة للمريض</Link>
          <Button variant="secondary" icon={<FilePen size={18} />} onClick={startRevision}>تعديل (إصدار جديد)</Button>
        </div>
        <section className="card stack-sm" style={{ background: 'var(--c-surface-sunken)' }} aria-label="إرسال لصيدلية">
          <strong>إرسال نسخة إلكترونية لصيدلية <span className="muted small">(اختياري)</span></strong>
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <SelectField label="الصيدلية" value={destination} onChange={(e) => setDestination(e.target.value)}>
                <option value="">— اختر صيدلية —</option>
                {pharmacies.data?.map((p) => <option key={p.pharmacy_id} value={p.pharmacy_id}>{p.name} — {p.branch}{p.is_default ? ' (صيدلية هذا الموقع)' : ''}{sentNames.includes(p.name) ? ' ✓ أُرسلت' : ''}</option>)}
              </SelectField>
            </div>
            <Button variant="secondary" icon={<Send size={18} />} disabled={!destination} loading={busy === 'approve'} onClick={() => void sendLater()}>إرسال</Button>
          </div>
        </section>
        <p className="small muted">الطباعة ليست إرسالاً والإرسال ليس صرفاً؛ إعادة الطباعة لا تغيّر أي عدّاد.</p>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="mobile-only"><Tabs label="الوصفة" value={mobileTab} onChange={setMobileTab} tabs={[{ id: 'edit', label: 'المحرر' }, { id: 'preview', label: 'المعاينة' }]} /></div>
      <div className="rx-builder">
        <div className="stack" data-hidden-mobile={mobileTab !== 'edit'}>
          {isRevision && <Alert tone="warning" title="تعديل وصفة مرسلة">سيُنشأ إصدار جديد وتُبلَّغ الصيدلية ويُبطل الإصدار السابق للصرف.</Alert>}
          {rows.map((r, idx) => (
            <RxRow key={r.key} row={r} index={idx} pharmacyId={sendTo}
                   onChange={(nr) => { dirty.current = true; setRows(rows.map((x) => x.key === r.key ? nr : x)); }}
                   onRemove={rows.length > 1 ? () => setRows(rows.filter((x) => x.key !== r.key)) : undefined} />
          ))}
          <Button variant="ghost" icon={<Plus size={16} />} onClick={() => setRows([...rows, emptyRow()])}>إضافة دواء</Button>

          <div className="card stack" style={{ background: 'var(--c-surface-sunken)' }}>
            <p className="small" style={{ margin: 0 }}><Printer size={16} aria-hidden style={{ verticalAlign: 'middle' }} /> بعد الاعتماد تُطبع الوصفة وتُختم وتُسلَّم للمريض.</p>
            <label className="row small" style={{ gap: 8 }}>
              <input type="checkbox" checked={sendNow} onChange={(e) => setSendNow(e.target.checked)} />
              إرسال نسخة إلكترونية لصيدلية أيضاً (اختياري)
            </label>
            {sendNow && (
              <SelectField label="الصيدلية" value={destination} onChange={(e) => setDestination(e.target.value)}>
                <option value="">— اختر صيدلية —</option>
                {pharmacies.data?.map((p) => <option key={p.pharmacy_id} value={p.pharmacy_id}>{p.name} — {p.branch}{p.is_default ? ' (صيدلية هذا الموقع)' : ''}</option>)}
              </SelectField>
            )}
            {isRevision && <TextField label="سبب التعديل" required value={reason} onChange={(e) => setReason(e.target.value)} />}
            {diagnosisMissing && <Alert tone="warning" title="اكتب التشخيص أولاً">لا تُعتمد الوصفة بدون تشخيص الحالة — اكتبه في خانة «التشخيص» باللوحة الجانبية.</Alert>}
            <div className="row">
              <Button variant="secondary" loading={busy === 'save'} onClick={() => void saveDraft().then((id) => id && toast('حُفظت المسودة', 'success'))}>حفظ مسودة</Button>
              <Button icon={sendTo ? <Send size={18} /> : <CheckCircle2 size={18} />} disabled={!items.length || diagnosisMissing || (isRevision && reason.trim().length < 5) || (sendNow && !destination)}
                      onClick={() => setConfirm(true)}>{sendTo ? 'اعتماد وإرسال' : 'اعتماد الوصفة'}</Button>
            </div>
          </div>
        </div>
        <div className="rx-preview" data-hidden-mobile={mobileTab !== 'preview'} aria-label="معاينة الطباعة">
          <RxDocument doc={previewDoc} draft />
        </div>
      </div>
      <ConfirmDialog open={confirm} title="تأكيد اعتماد الوصفة" confirmLabel={sendTo ? 'اعتماد وإرسال' : 'اعتماد'} loading={busy === 'approve'}
                     onCancel={() => setConfirm(false)} onConfirm={approve}>
        <p>المريض: <strong>{patientName}</strong></p>
        <p>عدد الأدوية: {items.length}</p>
        <p>تُطبع وتُسلَّم للمريض.{sendTo ? <> وتُرسل إلكترونياً أيضاً إلى: <strong>{dest?.name} — {dest?.branch}</strong></> : ' لن تُرسل لأي صيدلية (يمكن إرسالها لاحقاً).'}</p>
        <p className="small muted">بعد الاعتماد تُقفل هذه النسخة؛ أي تعديل لاحق يُنشئ إصداراً جديداً.</p>
      </ConfirmDialog>
    </div>
  );
}

function RxRow({ row, index, onChange, onRemove, pharmacyId }: { row: Row; index: number; pharmacyId: string; onChange: (r: Row) => void; onRemove?: () => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Med[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc('search_medications', { p_query: q, p_pharmacy_id: pharmacyId || undefined });
      setResults((data as Med[]) ?? []); setOpen(true);
    }, 200);
    return () => clearTimeout(t);
  }, [q, pharmacyId]);
  const set = (k: keyof Row, v: string | boolean) => onChange({ ...row, [k]: v });
  const listId = `meds-${row.key}`;
  return (
    <fieldset className="card stack-sm rx-row">
      <legend className="row-between" style={{ width: '100%' }}>
        <strong>دواء {index + 1}</strong>
        {onRemove && <button type="button" className="icon-btn" aria-label={`حذف الدواء ${index + 1}`} onClick={onRemove}><Trash2 size={18} /></button>}
      </legend>
      {row.display_name ? (
        <div className="row-between">
          <bdi dir="ltr" style={{ fontWeight: 700 }}>{row.display_name}</bdi>
          <Button size="sm" variant="ghost" onClick={() => { onChange({ ...row, medication_id: null, display_name: '' }); setQ(''); }}>تغيير</Button>
        </div>
      ) : (
        <div className="field" style={{ position: 'relative' }}>
          <label htmlFor={`q-${row.key}`}>بحث بالمادة الفعالة أو الاسم التجاري</label>
          <div className="input-icon">
            <Search size={18} aria-hidden />
            <input id={`q-${row.key}`} className="input" dir="auto" role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list"
                   value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => setTimeout(() => setOpen(false), 150)} />
          </div>
          {open && results.length > 0 && (
            <ul id={listId} role="listbox" className="combo-list">
              {results.map((m) => (
                <li key={m.medication_id} role="option" aria-selected={false}>
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => {
                    onChange({ ...row, medication_id: m.medication_id,
                      display_name: [m.active_ingredient, m.brand_name ? `(${m.brand_name})` : '', m.strength, m.dosage_form].filter(Boolean).join(' ') });
                    setOpen(false);
                  }}>
                    <bdi dir="ltr"><strong>{m.active_ingredient}</strong>{m.brand_name ? ` (${m.brand_name})` : ''} — {m.strength} · {m.dosage_form}</bdi>
                    <Badge tone="neutral">التوفر غير معروف</Badge>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <span className="hint">التوفر الفعلي يُعرض بعد تفعيل مخزون الصيدلية (المرحلة 4)؛ لا يُعرض كتوفر مؤكد.</span>
          <Button size="sm" variant="ghost" disabled={q.trim().length < 2} onClick={() => onChange({ ...row, display_name: q.trim(), medication_id: null })}>
            استخدام النص كما كُتب (خارج القائمة)
          </Button>
        </div>
      )}
      <div className="rx-grid">
        <div className="field">
          <label htmlFor={`amt-${row.key}`}>الكمية بكل جرعة</label>
          <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
            <input id={`amt-${row.key}`} className="input" inputMode="decimal" dir="ltr" style={{ width: 80 }} value={row.dose}
                   placeholder="1" onChange={(e) => set('dose', e.target.value)} />
            <select className="select" aria-label="الوحدة" value={row.dose_unit} onChange={(e) => set('dose_unit', e.target.value)}>
              <option value="">—</option>
              {DOSE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              {row.dose_unit && !DOSE_UNITS.includes(row.dose_unit) && <option value={row.dose_unit}>{row.dose_unit}</option>}
            </select>
          </div>
        </div>
        <SelectField label="كم مرة باليوم" value={row.interval_hours} disabled={row.as_needed}
                     onChange={(e) => {
                       const h = e.target.value;
                       // the printed wording follows the choice, unless the doctor wrote their own
                       const auto = !row.frequency_text || Object.values(TIMES_TEXT).includes(row.frequency_text) || /^كل \d+ ساعات$/.test(row.frequency_text);
                       onChange({ ...row, interval_hours: h, frequency_text: auto ? (h ? TIMES_TEXT[h] ?? '' : '') : row.frequency_text });
                     }}>
          <option value="">— اختر —</option>
          {TIMES_PER_DAY.map(([, h]) => <option key={h} value={h}>{TIMES_TEXT[h]} (كل {h} ساعة)</option>)}
        </SelectField>
        <TextField label="المدة (أيام)" inputMode="numeric" ltr value={row.duration_days} onChange={(e) => set('duration_days', e.target.value)} />
        <TextField label="كمية الصرف (عدد)" optional inputMode="decimal" ltr value={row.quantity} onChange={(e) => set('quantity', e.target.value)} placeholder="مثال: 1" />
        <TextField label="طريقة الاستعمال" optional value={row.route} onChange={(e) => set('route', e.target.value)} />
      </div>
      <TextField label="تعليمات" optional value={row.instructions} onChange={(e) => set('instructions', e.target.value)} />
      <label className="row small" style={{ gap: 8 }}><input type="checkbox" checked={row.as_needed} onChange={(e) => set('as_needed', e.target.checked)} />عند اللزوم</label>
      <p className="small muted">لا تُحسب الكمية ولا تُفسَّر التعليمات آلياً؛ تُطبع كما كتبتها.</p>
    </fieldset>
  );
}
