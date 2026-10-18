import { useState } from 'react';
import { AlertTriangle, PackagePlus, Plus, Search, SlidersHorizontal } from 'lucide-react';
import { errorMessage, formatDateShort, formatMoney } from '@app/shared';
import { supabase } from '../../../lib/supabase';
import { unwrap, useAsync } from '../../../lib/useAsync';
import { useWorkspace } from '../../../lib/workspace';
import { newIdempotencyKey } from '../../../lib/idempotency';
import { Badge, Button, ConfirmDialog, EmptyState, ErrorState, Ltr, PageHead, SelectField, Sheet, SkeletonList, TextField, useToast } from '../../../components/ui';

interface StockRow {
  product_id: string; name: string; medication: string | null; unit_name: string; units_per_pack: number; unit_price_minor: number;
  on_hand: number; reserved: number; available: number; expired_on_hand: number; nearest_expiry: string | null; reorder_level: number;
  low_stock: boolean; manual_availability: string | null; manual_availability_at: string | null;
  batches: { id: string; batch_no: string; expiry_date: string; on_hand: number; reserved: number; expired: boolean }[];
}
const manualLabel: Record<string, string> = { available: 'متوفر (يدوي)', limited: 'محدود (يدوي)', unavailable: 'غير متوفر (يدوي)' };

export function PharmacyStock() {
  const { current } = useWorkspace();
  const toast = useToast();
  const pharmacyId = current!.facility_id!;
  const [q, setQ] = useState('');
  const [receiveFor, setReceiveFor] = useState<StockRow | null>(null);
  const [adjust, setAdjust] = useState<{ row: StockRow; batch: StockRow['batches'][number] } | null>(null);
  const [newProduct, setNewProduct] = useState(false);
  const stock = useAsync(async () => (await unwrap(supabase.rpc('pharmacy_stock', { p_pharmacy_id: pharmacyId }))) as unknown as StockRow[], [pharmacyId]);
  const rows = (stock.data ?? []).filter((r) => !q.trim() || `${r.name} ${r.medication ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()));

  const setManual = async (r: StockRow, status: string) => {
    const { error } = await supabase.rpc('set_manual_availability', { p_product_id: r.product_id, p_status: (status || null) as string });
    if (error) toast(errorMessage(error), 'danger'); else stock.reload();
  };

  return (
    <div className="stack">
      <PageHead title="المخزون والدفعات" subtitle={current!.facility_name} actions={<Button icon={<Plus size={18} />} onClick={() => setNewProduct(true)}>منتج جديد</Button>} />
      <div className="input-icon" style={{ maxWidth: 360 }}>
        <Search size={18} aria-hidden /><label className="sr-only" htmlFor="sq">بحث</label>
        <input id="sq" className="input" placeholder="بحث بالاسم أو المادة الفعالة" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <section className="card card-flush">
        {stock.status === 'loading' && !stock.data && <SkeletonList />}
        {stock.status === 'error' && <ErrorState error={stock.error} onRetry={stock.reload} />}
        {stock.data && rows.length === 0 && <EmptyState icon={<PackagePlus />} title="لا توجد منتجات" action={<Button onClick={() => setNewProduct(true)}>إضافة منتج</Button>}>أضف المنتجات واربطها بالمادة الفعالة، ثم سجّل الاستلام بالدفعات وتواريخ الانتهاء.</EmptyState>}
        {!!rows.length && (
          <div className="table-wrap" role="region" aria-label="المخزون" tabIndex={0}>
            <table className="table">
              <thead><tr><th>المنتج</th><th>المتاح</th><th>محجوز</th><th>منتهي الصلاحية</th><th>أقرب انتهاء</th><th>السعر/وحدة</th><th>الدفعات</th><th><span className="sr-only">إجراءات</span></th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.product_id}>
                    <td><strong><bdi dir="auto">{r.name}</bdi></strong><div className="small muted"><bdi dir="ltr">{r.medication ?? 'غير مربوط بالمادة'}</bdi> · {r.units_per_pack} {r.unit_name}/عبوة</div></td>
                    <td className="num">{r.available} {r.unit_name}{r.low_stock && <div><Badge tone="warning" icon={<AlertTriangle aria-hidden />}>نقص</Badge></div>}</td>
                    <td className="num">{r.reserved}</td>
                    <td className="num">{r.expired_on_hand > 0 ? <Badge tone="danger">{r.expired_on_hand}</Badge> : '—'}</td>
                    <td className="small">{r.nearest_expiry ? formatDateShort(r.nearest_expiry + 'T12:00:00Z') : '—'}</td>
                    <td className="small">{formatMoney(r.unit_price_minor)}</td>
                    <td className="small">
                      {r.batches.map((b) => (
                        <button key={b.id} className="chip" style={{ marginBlockEnd: 4 }} onClick={() => setAdjust({ row: r, batch: b })} aria-label={`جرد الدفعة ${b.batch_no}`}>
                          <Ltr>{b.batch_no}</Ltr> · {b.on_hand}{b.expired ? ' · منتهية' : ''}
                        </button>
                      ))}
                      {r.batches.length === 0 && (
                        <select className="select" style={{ minHeight: 32, fontSize: 13 }} aria-label="توفر يدوي" value={r.manual_availability ?? ''} onChange={(e) => setManual(r, e.target.value)}>
                          <option value="">غير متتبع</option><option value="available">متوفر (يدوي)</option><option value="limited">محدود (يدوي)</option><option value="unavailable">غير متوفر (يدوي)</option>
                        </select>
                      )}
                      {r.manual_availability && r.batches.length === 0 && <div className="muted">{manualLabel[r.manual_availability]} — ليس كمية مؤكدة</div>}
                    </td>
                    <td><Button size="sm" variant="secondary" icon={<PackagePlus size={16} />} onClick={() => setReceiveFor(r)}>استلام</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {receiveFor && <ReceiveSheet row={receiveFor} onClose={() => setReceiveFor(null)} onDone={() => { setReceiveFor(null); stock.reload(); }} />}
      {adjust && <AdjustDialog {...adjust} onClose={() => setAdjust(null)} onDone={() => { setAdjust(null); stock.reload(); }} />}
      {newProduct && <ProductSheet pharmacyId={pharmacyId} onClose={() => setNewProduct(false)} onDone={() => { setNewProduct(false); stock.reload(); }} />}
    </div>
  );
}

function ReceiveSheet({ row, onClose, onDone }: { row: StockRow; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ batch: '', expiry: '', packs: '', cost: '', supplier: '' });
  const [busy, setBusy] = useState(false);
  const [key] = useState(() => newIdempotencyKey('recv'));
  const submit = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('receive_stock', { p_product_id: row.product_id, p_batch_no: f.batch, p_expiry_date: f.expiry, p_packs: Number(f.packs),
      p_unit_cost_minor: Number(f.cost) || 0, p_idempotency_key: key, p_supplier_name: f.supplier || undefined });
    setBusy(false);
    if (error) { toast(errorMessage(error), 'danger'); return; }
    toast('سُجل الاستلام', 'success'); onDone();
  };
  return (
    <Sheet open onClose={onClose} title={`استلام — ${row.name}`} footer={<Button block loading={busy} disabled={!f.batch || !f.expiry || !(Number(f.packs) > 0)} onClick={submit}>تسجيل الاستلام</Button>}>
      <div className="stack">
        <TextField label="رقم الدفعة" ltr value={f.batch} onChange={(e) => setF({ ...f, batch: e.target.value })} />
        <TextField label="تاريخ الانتهاء" type="date" ltr value={f.expiry} onChange={(e) => setF({ ...f, expiry: e.target.value })} />
        <TextField label={`عدد العبوات (العبوة = ${row.units_per_pack} ${row.unit_name})`} inputMode="numeric" ltr value={f.packs} onChange={(e) => setF({ ...f, packs: e.target.value.replace(/\D/g, '') })}
                   hint={Number(f.packs) > 0 ? `= ${Number(f.packs) * row.units_per_pack} ${row.unit_name}` : undefined} />
        <TextField label="تكلفة الوحدة (د.ع)" optional inputMode="numeric" ltr value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value.replace(/\D/g, '') })} />
        <TextField label="المورد" optional value={f.supplier} onChange={(e) => setF({ ...f, supplier: e.target.value })} />
      </div>
    </Sheet>
  );
}

function AdjustDialog({ row, batch, onClose, onDone }: { row: StockRow; batch: StockRow['batches'][number]; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [qty, setQty] = useState(String(batch.on_hand));
  const [reason, setReason] = useState('');
  const submit = async () => {
    const { error } = await supabase.rpc('adjust_stock', { p_batch_id: batch.id, p_counted_quantity: Number(qty), p_reason: reason });
    if (error) { toast(errorMessage(error), 'danger'); return; }
    toast('سُجل الجرد', 'success'); onDone();
  };
  return (
    <ConfirmDialog open title={`جرد الدفعة ${batch.batch_no} — ${row.name}`} confirmLabel="حفظ الجرد" onCancel={onClose} onConfirm={submit}>
      <p className="small">المسجل: {batch.on_hand} · محجوز: {batch.reserved}. تُسجل الفروقات كحركة مخزنية مع السبب.</p>
      <TextField label="الكمية المعدودة" inputMode="numeric" ltr value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))} />
      <TextField label="السبب" required value={reason} onChange={(e) => setReason(e.target.value)} />
    </ConfirmDialog>
  );
}

interface Med { medication_id: string; active_ingredient: string; strength: string; dosage_form: string; brand_name: string | null }
function ProductSheet({ pharmacyId, onClose, onDone }: { pharmacyId: string; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [meds, setMeds] = useState<Med[]>([]);
  const [f, setF] = useState({ medication_id: '', name: '', pack: '', unit: 'قرص', upp: '1', price: '', reorder: '0', barcode: '' });
  const search = async () => {
    const { data } = await supabase.rpc('search_medications', { p_query: q });
    setMeds((data as Med[]) ?? []);
  };
  const submit = async () => {
    const { error } = await supabase.rpc('upsert_pharmacy_product', { p_pharmacy_id: pharmacyId, p_name: f.name, p_unit_price_minor: Number(f.price) || 0,
      p_medication_id: f.medication_id || undefined, p_units_per_pack: Number(f.upp) || 1, p_unit_name: f.unit, p_pack_description: f.pack || undefined,
      p_barcode: f.barcode || undefined, p_reorder_level: Number(f.reorder) || 0 });
    if (error) { toast(errorMessage(error), 'danger'); return; }
    toast('أُضيف المنتج', 'success'); onDone();
  };
  return (
    <Sheet open onClose={onClose} title="منتج جديد" footer={<Button block disabled={!f.name.trim()} onClick={submit}>حفظ</Button>}>
      <div className="stack">
        <div className="row" style={{ alignItems: 'flex-end', flexWrap: 'nowrap' }}>
          <div className="grow"><TextField label="المادة الفعالة (من الدليل)" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <Button variant="secondary" onClick={search} disabled={q.trim().length < 2}>بحث</Button>
        </div>
        {meds.length > 0 && (
          <SelectField label="اختر المادة" value={f.medication_id} onChange={(e) => setF({ ...f, medication_id: e.target.value })}>
            <option value="">— بدون ربط —</option>
            {meds.map((m) => <option key={m.medication_id} value={m.medication_id}>{m.active_ingredient} {m.strength} {m.dosage_form}</option>)}
          </SelectField>
        )}
        <TextField label="اسم المنتج التجاري" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <TextField label="وصف العبوة" optional value={f.pack} onChange={(e) => setF({ ...f, pack: e.target.value })} placeholder="علبة 20 قرص" />
        <div className="rx-grid">
          <TextField label="وحدة الصرف" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} />
          <TextField label="وحدات في العبوة" inputMode="numeric" ltr value={f.upp} onChange={(e) => setF({ ...f, upp: e.target.value.replace(/\D/g, '') })} />
          <TextField label="سعر الوحدة (د.ع)" inputMode="numeric" ltr value={f.price} onChange={(e) => setF({ ...f, price: e.target.value.replace(/\D/g, '') })} />
          <TextField label="حد إعادة الطلب" inputMode="numeric" ltr value={f.reorder} onChange={(e) => setF({ ...f, reorder: e.target.value.replace(/\D/g, '') })} />
        </div>
        <TextField label="الباركود" optional ltr value={f.barcode} onChange={(e) => setF({ ...f, barcode: e.target.value })} />
        <p className="small muted"><SlidersHorizontal size={14} aria-hidden style={{ verticalAlign: '-2px' }} /> المادة الفعالة غير المنتج التجاري وغير العبوة؛ الربط بالمادة يُظهر التوفر للأطباء.</p>
      </div>
    </Sheet>
  );
}
