import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Printer } from 'lucide-react';
import { labReportHtml, type LabReport } from '@app/shared';
import { supabase } from '../lib/supabase';
import { unwrap, useAsync } from '../lib/useAsync';
import { Button, ErrorState, SkeletonList } from '../components/ui';

/** Printable lab report (A4 → printer or "Save as PDF"); released results only. */
export function PrintLab() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const r = useAsync(async () => (await unwrap(supabase.rpc('lab_report', { p_order_id: orderId! }))) as unknown as LabReport, [orderId]);
  return (
    <main className="p-main stack" style={{ maxWidth: 900 }}>
      <div className="row no-print">
        <Button variant="ghost" icon={<ArrowRight size={18} />} onClick={() => navigate(-1)}>رجوع</Button>
        <Button icon={<Printer size={18} />} onClick={() => window.print()} disabled={!r.data}>طباعة / حفظ PDF</Button>
      </div>
      {r.status === 'loading' && <SkeletonList />}
      {r.status === 'error' && <ErrorState error={r.error} onRetry={r.reload} />}
      {/* the HTML is built by labReportHtml, which escapes every value */}
      {r.data && <div className="print-area card" style={{ padding: 0 }} dangerouslySetInnerHTML={{ __html: labReportHtml(r.data) }} />}
      <style>{'@media print { @page { size: A4; margin: 12mm; } }'}</style>
    </main>
  );
}
