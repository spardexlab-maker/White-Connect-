import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Printer } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { unwrap, useAsync } from '../../lib/useAsync';
import { Alert, ErrorState, SkeletonList } from '../../components/ui';
import { RxDocument, type RxDoc } from '../../components/clinical/RxDocument';
import { ReminderSetup } from '../../components/clinical/ReminderSetup';

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
      {doc.data && doc.data.status === 'active' && (
        <section className="card stack no-print" aria-labelledby="rem-title">
          <h2 id="rem-title" className="section-title">بدأت الاستخدام؟ فعّل التذكيرات</h2>
          <p className="small muted">إذا صُرف الدواء من صيدلية خارج المنصة، أكّد بدء الاستخدام واختر أوقاتك.</p>
          {doc.data.items.map((i) => <ReminderSetup key={i.line_no} prescriptionId={id!} lineNo={i.line_no} displayName={i.display_name}
            frequencyText={i.frequency_text} asNeeded={i.as_needed} durationDays={i.duration_days} />)}
          <Link to="/patient/meds" className="small">عرض خطة الدواء</Link>
        </section>
      )}
    </div>
  );
}
