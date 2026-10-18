import { useEffect, useState } from 'react';
import { HelpCircle, PackageCheck, PackageX, ShoppingBag, Wallet } from 'lucide-react';
import { errorMessage, formatDateTime, formatMoney } from '@app/shared';
import { supabase } from '../../../lib/supabase';
import { unwrap, useAsync } from '../../../lib/useAsync';
import { newIdempotencyKey } from '../../../lib/idempotency';
import { Alert, Badge, Button, ConfirmDialog, SelectField, TextField, TextareaField, useToast } from '../../../components/ui';

interface Line {
  line_no: number; display_name: string; prescribed_quantity: number | null; quantity_unit: string | null; dispensed: number; reserved: number; reserved_product_id: string | null;
  notes: { kind: string; note: string | null; at: string }[];
  products: { product_id: string; name: string; unit_name: string; unit_price_minor: number; available: number; manual_availability: string | null; manual_availability_at: string | null }[];
}

/**
 * Preparation (reservation) and dispensing are separate actions with
 * separate buttons. The pharmacist never edits the prescription: a line
 * can only be marked unavailable or sent back for clarification.
 */
export function DispensePanel({ dispatchId, status, onChanged }: { dispatchId: string; status: string; onChanged: () => void }) {
  const toast = useToast();
  const lines = useAsync(async () => (await unwrap(supabase.rpc('dispatch_lines', { p_dispatch_id: dispatchId }))) as unknown as Line[], [dispatchId]);
  const [pick, setPick] = useState<Record<number, { product_id: string; quantity: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [sale, setSale] = useState<{ sale_id: string; sale_number: string; total_minor: number } | null>(null);
  const [note, setNote] = useState<{ line: number; kind: 'not_available' | 'clarification_requested' } | null>(null);
  const [noteText, setNoteText] = useState('');
  const [idem, setIdem] = useState(() => newIdempotencyKey('disp'));

  useEffect(() => {
    if (!lines.data) return;
    const init: typeof pick = {};
    for (const l of lines.data) {
      const remaining = l.prescribed_quantity != null ? Math.max(0, Number(l.prescribed_quantity) - l.dispensed) : 0;
      // a prepared line keeps exactly what was reserved
      if (l.reserved > 0 && l.reserved_product_id) { init[l.line_no] = { product_id: l.reserved_product_id, quantity: String(l.reserved) }; continue; }
      const best = l.products.find((p) => p.available > 0) ?? l.products[0];
      init[l.line_no] = { product_id: best?.product_id ?? '', quantity: best ? String(Math.min(remaining, best.available)) : '0' };
    }
    setPick(init);
  }, [lines.data]);

  const chosen = () => Object.entries(pick).filter(([, v]) => v.product_id && Number(v.quantity) > 0)
    .map(([line_no, v]) => ({ line_no: Number(line_no), product_id: v.product_id, quantity: Number(v.quantity) }));
  const total = (lines.data ?? []).reduce((sum, l) => {
    const v = pick[l.line_no]; const p = l.products.find((x) => x.product_id === v?.product_id);
    return sum + (p && v ? p.unit_price_minor * (Number(v.quantity) || 0) : 0);
  }, 0);
  const closed = ['dispensed', 'cancelled'].includes(status);

  const prepare = async () => {
    setBusy('prepare');
    const { error } = await supabase.rpc('prepare_dispatch', { p_dispatch_id: dispatchId, p_lines: chosen() });
    setBusy(null);
    if (error) { toast(errorMessage(error), 'danger'); return; }
    toast('تم حجز الكميات للتحضير', 'success'); lines.reload(); onChanged();
  };
  const dispense = async () => {
    setBusy('dispense');
    const { data, error } = await supabase.rpc('dispense_prescription', { p_dispatch_id: dispatchId, p_lines: chosen(), p_idempotency_key: idem });
    setBusy(null); setConfirm(false);
    if (error) { toast(errorMessage(error), 'danger'); setIdem(newIdempotencyKey('disp')); lines.reload(); return; }
    setSale(data as typeof sale); setIdem(newIdempotencyKey('disp'));
    toast((data as { complete: boolean }).complete ? 'صُرفت الوصفة بالكامل' : 'صرف جزئي — بقيت كميات', 'success');
    lines.reload(); onChanged();
  };
  const pay = async () => {
    if (!sale) return;
    const { error } = await supabase.rpc('record_payment', { p_sale_id: sale.sale_id, p_amount_minor: sale.total_minor });
    if (error) toast(errorMessage(error), 'danger'); else { toast('سُجل الدفع', 'success'); setSale(null); }
  };
  const saveNote = async () => {
    if (!note) return;
    const { error } = await supabase.rpc('dispatch_line_note', { p_dispatch_id: dispatchId, p_line_no: note.line, p_kind: note.kind, p_note: noteText || undefined });
    if (error) { toast(errorMessage(error), 'danger'); return; }
    toast(note.kind === 'not_available' ? 'سُجل عدم التوفر' : 'أُرسل طلب التوضيح للطبيب', 'success');
    setNote(null); setNoteText(''); lines.reload(); onChanged();
  };

  return (
    <section className="card stack" aria-labelledby="disp-title">
      <h3 id="disp-title" className="section-title">التحضير والصرف</h3>
      {lines.data?.map((l) => {
        const remaining = l.prescribed_quantity != null ? Math.max(0, Number(l.prescribed_quantity) - l.dispensed) : null;
        const v = pick[l.line_no];
        const prod = l.products.find((p) => p.product_id === v?.product_id);
        return (
          <fieldset key={l.line_no} className="stack-sm" style={{ border: '1px solid var(--c-border)', borderRadius: 'var(--r-md)', padding: 'var(--s-3)' }}>
            <legend><bdi dir="ltr"><strong>{l.line_no}. {l.display_name}</strong></bdi></legend>
            <div className="row small" style={{ gap: 'var(--s-3)' }}>
              <span>المطلوب: <strong className="num">{l.prescribed_quantity ?? 'غير محدد'}</strong> {l.quantity_unit ?? ''}</span>
              <span>المصروف: <strong className="num">{l.dispensed}</strong></span>
              {remaining != null && <span>المتبقي: <strong className="num">{remaining}</strong></span>}
              {l.reserved > 0 && <Badge tone="warning">محجوز {l.reserved}</Badge>}
            </div>
            {l.notes.map((n, i) => <span key={i} className="small" style={{ color: 'var(--c-warning)' }}>{n.kind === 'not_available' ? 'غير متوفر' : n.kind === 'clarification_requested' ? 'طُلب توضيح' : 'ملاحظة'}: {n.note ?? '—'} · {formatDateTime(n.at)}</span>)}
            {!closed && remaining !== 0 && (
              <>
                {l.products.length === 0
                  ? <Alert tone="warning">لا يوجد منتج مطابق للمادة في مخزون هذه الصيدلية.</Alert>
                  : (
                    <div className="row" style={{ alignItems: 'flex-end' }}>
                      <div className="grow"><SelectField label="المنتج المصروف" value={v?.product_id ?? ''} onChange={(e) => setPick({ ...pick, [l.line_no]: { ...v, product_id: e.target.value } })}>
                        {l.products.map((p) => <option key={p.product_id} value={p.product_id}>{p.name} — متاح {p.available} {p.unit_name}</option>)}
                      </SelectField></div>
                      <div style={{ width: 110 }}><TextField label="الكمية" inputMode="numeric" ltr value={v?.quantity ?? ''} onChange={(e) => setPick({ ...pick, [l.line_no]: { ...v, quantity: e.target.value.replace(/\D/g, '') } })} /></div>
                    </div>
                  )}
                {prod && prod.available < (Number(v?.quantity) || 0) && <Alert tone="danger">الكمية أكبر من المتاح ({prod.available}). سيُرفض الصرف — استخدم صرفاً جزئياً أو سجّل عدم التوفر.</Alert>}
                <div className="row">
                  <Button size="sm" variant="ghost" icon={<PackageX size={16} />} onClick={() => setNote({ line: l.line_no, kind: 'not_available' })}>غير متوفر</Button>
                  <Button size="sm" variant="ghost" icon={<HelpCircle size={16} />} onClick={() => setNote({ line: l.line_no, kind: 'clarification_requested' })}>طلب توضيح من الطبيب</Button>
                </div>
              </>
            )}
          </fieldset>
        );
      })}
      {!closed && (
        <div className="row-between" style={{ borderBlockStart: '1px solid var(--c-border)', paddingBlockStart: 'var(--s-3)' }}>
          <span>الإجمالي: <strong>{formatMoney(total)}</strong></span>
          <div className="row">
            <Button variant="secondary" icon={<PackageCheck size={18} />} loading={busy === 'prepare'} disabled={!chosen().length} onClick={prepare}>تحضير (حجز الكمية)</Button>
            <Button variant="accent" icon={<ShoppingBag size={18} />} disabled={!chosen().length} onClick={() => setConfirm(true)}>صرف</Button>
          </div>
        </div>
      )}
      <p className="small muted">البدائل لا تُصرف تلقائياً؛ أي بديل يحتاج اعتماداً من الطبيب. التحقق النهائي من التوفر يتم عند الصرف.</p>
      {sale && (
        <Alert tone="success" title={`عملية بيع ${sale.sale_number}`} action={<Button size="sm" icon={<Wallet size={16} />} onClick={pay}>تسجيل الدفع نقداً</Button>}>
          المبلغ: {formatMoney(sale.total_minor)}
        </Alert>
      )}
      <ConfirmDialog open={confirm} title="تأكيد الصرف" confirmLabel="صرف الآن" loading={busy === 'dispense'} onCancel={() => setConfirm(false)} onConfirm={dispense}>
        {chosen().map((c) => {
          const l = lines.data?.find((x) => x.line_no === c.line_no); const p = l?.products.find((x) => x.product_id === c.product_id);
          return <p key={c.line_no} className="small"><bdi dir="ltr">{p?.name}</bdi> × {c.quantity} {p?.unit_name}</p>;
        })}
        <p>الإجمالي: <strong>{formatMoney(total)}</strong>. يُخصم المخزون من الدفعات الأقرب انتهاءً (غير المنتهية).</p>
      </ConfirmDialog>
      <ConfirmDialog open={!!note} title={note?.kind === 'not_available' ? 'تسجيل عدم التوفر' : 'طلب توضيح من الطبيب'} confirmLabel="حفظ" onCancel={() => setNote(null)} onConfirm={saveNote}>
        <TextareaField label="ملاحظة" optional value={noteText} onChange={(e) => setNoteText(e.target.value)} />
      </ConfirmDialog>
    </section>
  );
}
