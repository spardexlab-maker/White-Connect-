import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { FlaskConical, Plus, Printer, X } from 'lucide-react';
import { errorMessage, formatDate, formatDateTime, patientLabStatus, type LabStatus } from '@app/shared';
import { productName, supabase } from '../../lib/supabase';
import { unwrap, useAsync } from '../../lib/useAsync';
import { Alert, Badge, Button, Ltr, TextField, useToast } from '../ui';

export interface MasterTest { id: string; code: string; name_ar: string; name_en: string | null; category: string | null; unit: string | null; reference_range: string | null }
export interface OpenOrder {
  id: string; code: string; created_at: string; expires_at: string; note: string | null; expired: boolean; cancelled: boolean;
  doctor: string; clinic: string; patient_name: string; patient_id: string; public_code: string;
  items: { id: string; name: string; master_id: string | null; code: string | null; unit: string | null; reference_range: string | null;
    status: 'open' | 'at_lab' | 'self_entered' | 'cancelled'; lab: string | null; lab_order_id: string | null; lab_order_status: LabStatus | null }[];
}

export const loadMasterTests = async () =>
  ((await unwrap(supabase.from('lab_test_master').select('id, code, name_ar, name_en, category, unit, reference_range').eq('is_active', true).order('sort_order'))) ?? []) as MasterTest[];

/** The link inside the QR: a lab's scanner or phone camera opens the order by its code. */
export const openOrderLink = (code: string) => `${window.location.origin}/lab-order?code=${code}`;

/** The order card: big code + QR, the tests and where each one is; prints as a paper order. */
export function OpenOrderCard({ o, children }: { o: OpenOrder; children?: React.ReactNode }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => { if (canvas.current) void QRCode.toCanvas(canvas.current, openOrderLink(o.code), { width: 132, margin: 1 }); }, [o.code]);
  const dead = o.expired || o.cancelled;
  return (
    <section className="card stack-sm open-order print-area">
      <div className="row-between" style={{ alignItems: 'flex-start' }}>
        <div className="stack-sm" style={{ gap: 2 }}>
          <span className="small muted">{productName} — طلب تحاليل (لأي مختبر)</span>
          <strong style={{ fontSize: 'var(--f-h3)' }}>{o.doctor} <span className="small muted">— {o.clinic}</span></strong>
          <span className="small">المريض: {o.patient_name} · <Ltr>{o.public_code}</Ltr></span>
          <span className="small muted">صدر {formatDateTime(o.created_at)} · {dead ? <b style={{ color: 'var(--c-danger)' }}>{o.cancelled ? 'ملغى' : 'منتهي الصلاحية'}</b> : <>صالح حتى {formatDate(o.expires_at)}</>}</span>
        </div>
        <div className="stack-sm" style={{ alignItems: 'center', gap: 4, opacity: dead ? 0.35 : 1 }}>
          <canvas ref={canvas} aria-label={`رمز الطلب ${o.code}`} />
          <strong className="open-code" dir="ltr">{o.code}</strong>
        </div>
      </div>
      <ul className="open-items">
        {o.items.map((i) => (
          <li key={i.id}>
            <span>{i.name}{i.code ? <span className="small muted"> · <Ltr>{i.code}</Ltr></span> : null}</span>
            {i.status === 'open' && <Badge tone={dead ? 'neutral' : 'warning'}>{dead ? 'لم يُجرَ' : 'لم يُجرَ بعد'}</Badge>}
            {i.status === 'at_lab' && <Badge tone="info">{i.lab}{i.lab_order_status ? ` — ${patientLabStatus[i.lab_order_status].label}` : ''}</Badge>}
            {i.status === 'self_entered' && <Badge tone="accent">أدخلها المريض</Badge>}
          </li>
        ))}
      </ul>
      {o.note && <span className="small">ملاحظة الطبيب: {o.note}</span>}
      <span className="small muted">يُعرض الرمز في أي مختبر يستخدم {productName} فيُضاف الطلب مباشرة. في مختبر آخر: سلّم هذه الورقة، وأدخل النتيجة بنفسك من التطبيق.</span>
      <div className="row no-print" style={{ gap: 6 }}>
        <Button size="sm" variant="secondary" icon={<Printer size={16} />} onClick={() => window.print()}>طباعة الطلب</Button>
        {children}
      </div>
    </section>
  );
}

/** The doctor picks tests from the catalogue (or types one) and gets a code for the patient. */
export function OpenLabOrderForm({ encounterId, onCreated }: { encounterId: string; onCreated: () => void }) {
  const toast = useToast();
  const master = useAsync(loadMasterTests, []);
  const [picked, setPicked] = useState<string[]>([]);
  const [free, setFree] = useState<string[]>([]);
  const [freeText, setFreeText] = useState('');
  const [q, setQ] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const groups = useMemo(() => {
    const list = (master.data ?? []).filter((t) => !q.trim() || `${t.name_ar} ${t.name_en ?? ''} ${t.code}`.toLowerCase().includes(q.trim().toLowerCase()));
    const by = new Map<string, MasterTest[]>();
    list.forEach((t) => by.set(t.category ?? 'أخرى', [...(by.get(t.category ?? 'أخرى') ?? []), t]));
    return [...by.entries()];
  }, [master.data, q]);
  const submit = async () => {
    setBusy(true);
    const items = [...picked.map((id) => ({ master_id: id })), ...free.map((name) => ({ name }))];
    const { error } = await supabase.rpc('create_open_lab_order', { p_encounter_id: encounterId, p_items: items, p_note: note || undefined });
    setBusy(false);
    if (error) { toast(errorMessage(error), 'danger'); return; }
    toast('صدر طلب التحاليل — ظهر في هاتف المريض مع رمزه', 'success');
    setPicked([]); setFree([]); setNote(''); onCreated();
  };
  return (
    <div className="card stack">
      <h3 className="section-title">طلب تحاليل لأي مختبر</h3>
      <span className="small muted">يصدر برمز وQR يظهر في هاتف المريض (صالح 7 أيام). أي مختبر على المنصة يُدخل الرمز فيُضاف الطلب عنده، والنتيجة تصلك.</span>
      <TextField label="ابحث في التحاليل" value={q} onChange={(e) => setQ(e.target.value)} placeholder="سكر، CBC، فيتامين…" />
      {groups.map(([cat, tests]) => (
        <div key={cat} className="stack-sm" style={{ gap: 6 }}>
          <strong className="small">{cat}</strong>
          <div className="row" style={{ gap: 6 }}>
            {tests.map((t) => (
              <button key={t.id} type="button" className="chip" aria-pressed={picked.includes(t.id)}
                      onClick={() => setPicked(picked.includes(t.id) ? picked.filter((x) => x !== t.id) : [...picked, t.id])}>{t.name_ar}</button>
            ))}
          </div>
        </div>
      ))}
      <div className="row" style={{ gap: 6, alignItems: 'flex-end' }}>
        <div className="grow"><TextField label="تحليل غير موجود بالقائمة" optional value={freeText} onChange={(e) => setFreeText(e.target.value)} /></div>
        <Button variant="secondary" icon={<Plus size={16} />} disabled={freeText.trim().length < 2}
                onClick={() => { setFree([...free, freeText.trim()]); setFreeText(''); }}>إضافة</Button>
      </div>
      {free.length > 0 && (
        <div className="row" style={{ gap: 6 }}>
          {free.map((n, i) => <button key={i} type="button" className="chip" aria-pressed onClick={() => setFree(free.filter((_, j) => j !== i))}>{n} <X size={12} aria-hidden /></button>)}
        </div>
      )}
      <TextField label="ملاحظة للمختبر" optional hint="مثلاً: صائم 8 ساعات" value={note} onChange={(e) => setNote(e.target.value)} />
      {(picked.length + free.length) > 0 && <Alert tone="info">{picked.length + free.length} تحليل في الطلب</Alert>}
      <Button icon={<FlaskConical size={18} />} disabled={!(picked.length + free.length)} loading={busy} onClick={() => void submit()}>إصدار الطلب للمريض</Button>
    </div>
  );
}
