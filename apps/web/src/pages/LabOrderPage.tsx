import { useParams, Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { unwrap, useAsync } from '../lib/useAsync';
import { ErrorState, SkeletonList } from '../components/ui';
import { LabResultView, type LabDetail } from '../components/clinical/LabResultView';

/** Released results for the ordering doctor or the patient (server decides visibility). */
export function LabOrderPage({ back }: { back: string }) {
  const { orderId } = useParams();
  const d = useAsync(async () => (await unwrap(supabase.rpc('lab_order_detail', { p_order_id: orderId! }))) as unknown as LabDetail, [orderId]);
  return (
    <div className="stack">
      <Link to={back} className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }}><ArrowRight size={16} aria-hidden />رجوع</Link>
      <div className="card">
        {d.status === 'loading' && <SkeletonList />}
        {d.status === 'error' && <ErrorState error={d.error} onRetry={d.reload} />}
        {d.data && <LabResultView d={d.data} />}
      </div>
    </div>
  );
}
