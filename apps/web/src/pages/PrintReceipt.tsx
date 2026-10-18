import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Printer } from 'lucide-react';
import { formatDateTime, formatMoney } from '@app/shared';
import { supabase, productName } from '../lib/supabase';
import { unwrap, useAsync } from '../lib/useAsync';
import { Button, ErrorState, SkeletonList } from '../components/ui';

interface Doc { invoice: { invoice_number: string; status: string; total_minor: number; created_at: string }; facility: { name: string; branch: string; address: string | null; phone: string | null };
  patient: { full_name: string; public_code: string }; lines: { description: string; quantity: number; line_total_minor: number }[];
  payments: { amount_minor: number; method: string; at: string }[]; paid_minor: number }

export function PrintReceipt() {
  const { id } = useParams();
  const navigate = useNavigate();
  const d = useAsync(async () => (await unwrap(supabase.rpc('invoice_document', { p_invoice_id: id! }))) as unknown as Doc, [id]);
  return (
    <main className="p-main stack" style={{ maxWidth: 520 }}>
      <div className="row no-print">
        <Button variant="ghost" icon={<ArrowRight size={18} />} onClick={() => navigate(-1)}>رجوع</Button>
        <Button icon={<Printer size={18} />} onClick={() => window.print()} disabled={!d.data}>طباعة</Button>
      </div>
      {d.status === 'loading' && <SkeletonList />}
      {d.status === 'error' && <ErrorState error={d.error} />}
      {d.data && (
        <div className="print-area">
          <article className="rx-doc" style={{ maxWidth: '80mm' }}>
            <header className="rx-head"><div><strong>{d.data.facility.name}</strong><div className="small">{d.data.facility.branch}</div>{d.data.facility.phone && <div className="small"><bdi dir="ltr">{d.data.facility.phone}</bdi></div>}</div></header>
            <div className="small">إيصال رسوم <bdi dir="ltr">{d.data.invoice.invoice_number}</bdi> · {formatDateTime(d.data.invoice.created_at)}</div>
            <div className="small">{d.data.patient.full_name} · <bdi dir="ltr">{d.data.patient.public_code}</bdi></div>
            {d.data.lines.map((l, i) => <div key={i} className="row-between small"><span>{l.description}</span><span>{formatMoney(l.line_total_minor)}</span></div>)}
            <div className="row-between"><strong>الإجمالي</strong><strong>{formatMoney(d.data.invoice.total_minor)}</strong></div>
            <div className="row-between small"><span>المدفوع</span><span>{formatMoney(d.data.paid_minor)}</span></div>
            <div className="row-between small"><span>المتبقي</span><span>{formatMoney(d.data.invoice.total_minor - d.data.paid_minor)}</span></div>
            <div className="rx-brand small muted">{productName} — إيصال تشغيلي</div>
          </article>
        </div>
      )}
    </main>
  );
}
