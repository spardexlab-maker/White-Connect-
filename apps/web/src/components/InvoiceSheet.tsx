import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Printer, Wallet } from 'lucide-react';
import { errorMessage, formatDateTime, formatMoney } from '@app/shared';
import { supabase } from '../lib/supabase';
import { unwrap, useAsync } from '../lib/useAsync';
import { newIdempotencyKey } from '../lib/idempotency';
import { Alert, Badge, Button, ErrorState, SelectField, Sheet, SkeletonList, TextField, useToast } from './ui';

interface Doc { invoice: { id: string; invoice_number: string; status: string; total_minor: number }; lines: { description: string; line_total_minor: number }[];
  payments: { amount_minor: number; method: string; at: string; note: string | null }[]; paid_minor: number; patient: { full_name: string } }

/** Fees for a visit or lab order: operational ledger, not legal accounting. */
export function InvoiceSheet({ appointmentId, labOrderId, onClose }: { appointmentId?: string; labOrderId?: string; onClose: () => void }) {
  const toast = useToast();
  const doc = useAsync(async () => {
    const inv = await unwrap(supabase.rpc('create_invoice', { p_appointment_id: appointmentId, p_lab_order_id: labOrderId }));
    return (await unwrap(supabase.rpc('invoice_document', { p_invoice_id: (inv as { id: string }).id }))) as unknown as Doc;
  }, [appointmentId, labOrderId]);
  const [method, setMethod] = useState('cash');
  const [refund, setRefund] = useState({ amount: '', note: '' });
  const [key, setKey] = useState(() => newIdempotencyKey('pay'));
  const due = doc.data ? doc.data.invoice.total_minor - doc.data.paid_minor : 0;
  const pay = async (amount: number, note?: string) => {
    const { error } = await supabase.rpc('record_invoice_payment', { p_invoice_id: doc.data!.invoice.id, p_amount_minor: amount, p_idempotency_key: key, p_method: method, p_note: note });
    setKey(newIdempotencyKey('pay'));
    if (error) { toast(errorMessage(error), 'danger'); return; }
    toast(amount > 0 ? 'سُجل الدفع' : 'سُجل الاسترداد', 'success'); setRefund({ amount: '', note: '' }); doc.reload();
  };
  return (
    <Sheet open onClose={onClose} title="الرسوم والإيصال"
           footer={doc.data ? <Link className="btn btn-secondary" to={`/print/receipt/${doc.data.invoice.id}`}><Printer size={18} aria-hidden />طباعة الإيصال</Link> : undefined}>
      {doc.status === 'loading' && <SkeletonList rows={3} />}
      {doc.status === 'error' && <ErrorState error={doc.error} onRetry={doc.reload} />}
      {doc.data && (
        <div className="stack">
          <div className="row-between"><strong>فاتورة <bdi dir="ltr">{doc.data.invoice.invoice_number}</bdi></strong>
            <Badge tone={doc.data.invoice.status === 'paid' ? 'success' : doc.data.invoice.status === 'void' ? 'neutral' : 'warning'}>{doc.data.invoice.status === 'paid' ? 'مدفوعة' : doc.data.invoice.status === 'void' ? 'ملغاة' : 'مستحقة'}</Badge></div>
          <span className="small">{doc.data.patient.full_name}</span>
          {doc.data.lines.map((l, i) => <div key={i} className="row-between small"><span>{l.description}</span><span>{formatMoney(l.line_total_minor)}</span></div>)}
          <hr className="divider" />
          <div className="row-between"><span>الإجمالي</span><strong>{formatMoney(doc.data.invoice.total_minor)}</strong></div>
          <div className="row-between small"><span>المدفوع</span><span>{formatMoney(doc.data.paid_minor)}</span></div>
          {doc.data.payments.map((p, i) => <span key={i} className="small muted">{formatDateTime(p.at)} — {p.amount_minor > 0 ? 'دفع' : 'استرداد'} {formatMoney(Math.abs(p.amount_minor))}{p.note ? ` (${p.note})` : ''}</span>)}
          {doc.data.invoice.total_minor === 0 && <Alert tone="info">لا يوجد سعر منشور لهذه الخدمة.</Alert>}
          {due > 0 && (
            <div className="row" style={{ alignItems: 'flex-end' }}>
              <div style={{ width: 140 }}><SelectField label="طريقة الدفع" value={method} onChange={(e) => setMethod(e.target.value)}><option value="cash">نقداً</option><option value="card">بطاقة</option><option value="other">أخرى</option></SelectField></div>
              <Button icon={<Wallet size={18} />} onClick={() => pay(due)}>تسجيل دفع {formatMoney(due)}</Button>
            </div>
          )}
          {doc.data.paid_minor > 0 && (
            <details>
              <summary className="small" style={{ cursor: 'pointer' }}>استرداد</summary>
              <div className="stack-sm" style={{ marginBlockStart: 8 }}>
                <TextField label="المبلغ (د.ع)" inputMode="numeric" ltr value={refund.amount} onChange={(e) => setRefund({ ...refund, amount: e.target.value.replace(/\D/g, '') })} />
                <TextField label="السبب" required value={refund.note} onChange={(e) => setRefund({ ...refund, note: e.target.value })} />
                <Button size="sm" variant="danger" disabled={!Number(refund.amount)} onClick={() => pay(-Number(refund.amount), refund.note)}>تسجيل الاسترداد</Button>
              </div>
            </details>
          )}
          <p className="small muted">دفتر رسوم تشغيلي وليس نظاماً محاسبياً قانونياً.</p>
        </div>
      )}
    </Sheet>
  );
}
