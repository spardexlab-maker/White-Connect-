import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Printer } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { unwrap, useAsync } from '../../lib/useAsync';
import { Alert, ErrorState, SkeletonList } from '../../components/ui';
import { RxDocument, type RxDoc } from '../../components/clinical/RxDocument';

/** The patient's copy of an approved prescription (can be taken to any pharmacy). */
export function PatientRx() {
  const { id } = useParams();
  const doc = useAsync(async () => (await unwrap(supabase.rpc('prescription_document', { p_prescription_id: id! }))) as unknown as RxDoc, [id]);
  return (
    <div className="stack">
      <div className="row-between no-print">
        <Link to="/patient/journey" className="btn btn-ghost btn-sm"><ArrowRight size={16} aria-hidden />رحلتي</Link>
        <button className="btn btn-secondary btn-sm" onClick={() => window.print()}><Printer size={16} aria-hidden />حفظ نسخة PDF</button>
      </div>
      {doc.status === 'loading' && <SkeletonList />}
      {doc.status === 'error' && <ErrorState error={doc.error} onRetry={doc.reload} />}
      {doc.data?.status === 'cancelled' && <Alert tone="danger">هذه الوصفة ملغاة من الطبيب.</Alert>}
      {doc.data && <div className="print-area"><RxDocument doc={doc.data} /></div>}
      <p className="small muted no-print">يمكنك أخذ هذه النسخة إلى أي صيدلية. لا تغيّر الجرعات دون استشارة الطبيب.</p>
    </div>
  );
}
