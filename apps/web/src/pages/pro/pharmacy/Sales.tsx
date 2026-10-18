import { useState } from 'react';
import { Plus, Receipt, Undo2 } from 'lucide-react';
import { errorMessage, formatDateTime, formatMoney } from '@app/shared';
import { supabase } from '../../../lib/supabase';
import { unwrap, useAsync } from '../../../lib/useAsync';
import { useWorkspace } from '../../../lib/workspace';
import { newIdempotencyKey } from '../../../lib/idempotency';
import { Badge, Button, ConfirmDialog, EmptyState, ErrorState, Ltr, PageHead, SelectField, Sheet, SkeletonList, TextField, useToast } from '../../../components/ui';

interface Sale { id: string; sale_number: string; source: string; source_note: string | null; total_minor: number; created_at: string;
  sale_lines: { id: string; quantity: number; returned_quantity: number; unit_price_minor: number; line_total_minor: number; pharmacy_products: { name: string } | null }[];
  payments: { amount_minor: number }[] }
const sourceLabel: Record<string, string> = { e_prescription: 'وصفة إلكترونية', paper_prescription: 'وصفة ورقية', otc: 'بيع مباشر' };

export function PharmacySales() {
  const { current } = useWorkspace();
  const toast = useToast();
  const pharmacyId = current!.facility_id!;
  const [newSale, setNewSale] = useState(false);
  const [ret, setRet] = useState<Sale['sale_lines'][number] | null>(null);
  const [retQty, setRetQty] = useState('1');
  const [reason, setReason] = useState('');
  const sales = useAsync(async () => (await unwrap(supabase.from('sales')
    .select('id, sale_number, source, source_note, total_minor, created_at, sale_lines(id, quantity, returned_quantity, unit_price_minor, line_total_minor, pharmacy_products(name)), payments(amount_minor)')
    .eq('pharmacy_id', pharmacyId).order('created_at', { ascending: false }).limit(50))) as unknown as Sale[], [pharmacyId]);

  const doReturn = async () => {
    if (!ret) return;
    const { error } = await supabase.rpc('return_sale_line', { p_sale_line_id: ret.id, p_quantity: Number(retQty), p_reason: reason });
    if (error) { toast(errorMessage(error), 'danger'); return; }
    toast('سُجل المرتجع (يُعاد للمخزون إن لم تنتهِ صلاحيته)', 'success'); setRet(null); setReason(''); sales.reload();
  };
  const pay = async (s: Sale) => {
    const paid = s.payments.reduce((a, p) => a + p.amount_minor, 0);
    const { error } = await supabase.rpc('record_payment', { p_sale_id: s.id, p_amount_minor: s.total_minor - paid });
    if (error) toast(errorMessage(error), 'danger'); else sales.reload();
  };

  return (
    <div className="stack">
      <PageHead title="المبيعات والمرتجعات" subtitle={current!.facility_name} actions={<Button icon={<Plus size={18} />} onClick={() => setNewSale(true)}>بيع مباشر / وصفة ورقية</Button>} />
      <section className="card card-flush">
        {sales.status === 'loading' && !sales.data && <SkeletonList />}
        {sales.status === 'error' && <ErrorState error={sales.error} onRetry={sales.reload} />}
        {sales.data?.length === 0 && <EmptyState icon={<Receipt />} title="لا توجد مبيعات بعد" />}
        {!!sales.data?.length && (
          <div className="table-wrap" role="region" aria-label="المبيعات" tabIndex={0}>
            <table className="table">
              <thead><tr><th>العملية</th><th>المصدر</th><th>الأصناف</th><th>المبلغ</th><th>الدفع</th></tr></thead>
              <tbody>
                {sales.data.map((s) => {
                  const paid = s.payments.reduce((a, p) => a + p.amount_minor, 0);
                  return (
                    <tr key={s.id}>
                      <td><Ltr>{s.sale_number}</Ltr><div className="small muted">{formatDateTime(s.created_at)}</div></td>
                      <td className="small">{sourceLabel[s.source]}{s.source_note ? ` — ${s.source_note}` : ''}</td>
                      <td className="small">
                        {s.sale_lines.map((l) => (
                          <div key={l.id} className="row" style={{ gap: 6 }}>
                            <span><bdi dir="auto">{l.pharmacy_products?.name}</bdi> × {l.quantity}</span>
                            {l.returned_quantity > 0 && <Badge tone="warning">مرتجع {l.returned_quantity}</Badge>}
                            {l.returned_quantity < l.quantity && <button className="btn btn-ghost btn-sm" onClick={() => { setRet(l); setRetQty('1'); }}><Undo2 size={14} aria-hidden />مرتجع</button>}
                          </div>
                        ))}
                      </td>
                      <td>{formatMoney(s.total_minor)}</td>
                      <td>{paid >= s.total_minor ? <Badge tone="success">مدفوع</Badge> : <Button size="sm" variant="secondary" onClick={() => pay(s)}>تسجيل دفع {formatMoney(s.total_minor - paid)}</Button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="small muted">هذا سجل مبيعات تشغيلي وليس نظاماً محاسبياً قانونياً كاملاً.</p>
      {newSale && <DirectSaleSheet pharmacyId={pharmacyId} onClose={() => setNewSale(false)} onDone={() => { setNewSale(false); sales.reload(); }} />}
      <ConfirmDialog open={!!ret} title="تسجيل مرتجع" confirmLabel="حفظ المرتجع" onCancel={() => setRet(null)} onConfirm={doReturn}>
        <TextField label={`الكمية (الحد ${ret ? ret.quantity - ret.returned_quantity : 0})`} inputMode="numeric" ltr value={retQty} onChange={(e) => setRetQty(e.target.value.replace(/\D/g, ''))} />
        <TextField label="السبب" required value={reason} onChange={(e) => setReason(e.target.value)} />
      </ConfirmDialog>
    </div>
  );
}

interface StockRow { product_id: string; name: string; unit_name: string; available: number; unit_price_minor: number }
function DirectSaleSheet({ pharmacyId, onClose, onDone }: { pharmacyId: string; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const stock = useAsync(async () => (await unwrap(supabase.rpc('pharmacy_stock', { p_pharmacy_id: pharmacyId }))) as unknown as StockRow[], [pharmacyId]);
  const [lines, setLines] = useState<{ product_id: string; quantity: string }[]>([{ product_id: '', quantity: '1' }]);
  const [source, setSource] = useState<'otc' | 'paper_prescription'>('otc');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(() => newIdempotencyKey('sale'));
  const total = lines.reduce((s, l) => s + (stock.data?.find((p) => p.product_id === l.product_id)?.unit_price_minor ?? 0) * (Number(l.quantity) || 0), 0);
  const submit = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc('direct_sale', { p_pharmacy_id: pharmacyId, p_lines: lines.filter((l) => l.product_id).map((l) => ({ product_id: l.product_id, quantity: Number(l.quantity) })),
      p_source: source, p_idempotency_key: key, p_source_note: note || undefined });
    setBusy(false);
    if (error) { toast(errorMessage(error), 'danger'); setKey(newIdempotencyKey('sale')); return; }
    toast(`تمت العملية ${(data as { sale_number: string }).sale_number}`, 'success'); onDone();
  };
  return (
    <Sheet open onClose={onClose} title="بيع مباشر" footer={<Button block loading={busy} disabled={!lines.some((l) => l.product_id) || (source === 'paper_prescription' && note.trim().length < 3)} onClick={submit}>إتمام البيع — {formatMoney(total)}</Button>}>
      <div className="stack">
        <SelectField label="المصدر" value={source} onChange={(e) => setSource(e.target.value as typeof source)}>
          <option value="otc">بيع مباشر بدون وصفة</option><option value="paper_prescription">وصفة ورقية</option>
        </SelectField>
        {source === 'paper_prescription' && <TextField label="توثيق الوصفة الورقية" required value={note} onChange={(e) => setNote(e.target.value)} placeholder="اسم الطبيب، التاريخ، رقم الوصفة" />}
        {lines.map((l, i) => (
          <div key={i} className="row" style={{ alignItems: 'flex-end', flexWrap: 'nowrap' }}>
            <div className="grow"><SelectField label={`صنف ${i + 1}`} value={l.product_id} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, product_id: e.target.value } : x))}>
              <option value="">اختر</option>
              {stock.data?.map((p) => <option key={p.product_id} value={p.product_id} disabled={p.available <= 0}>{p.name} — متاح {p.available}</option>)}
            </SelectField></div>
            <div style={{ width: 90 }}><TextField label="الكمية" inputMode="numeric" ltr value={l.quantity} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, quantity: e.target.value.replace(/\D/g, '') } : x))} /></div>
          </div>
        ))}
        <Button variant="ghost" icon={<Plus size={16} />} onClick={() => setLines([...lines, { product_id: '', quantity: '1' }])}>صنف آخر</Button>
      </div>
    </Sheet>
  );
}
