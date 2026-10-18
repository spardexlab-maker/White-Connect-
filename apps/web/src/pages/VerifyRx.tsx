import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import { formatDateTime } from '@app/shared';
import { supabase, productName } from '../lib/supabase';
import { unwrap, useAsync } from '../lib/useAsync';
import { ErrorState, SkeletonList } from '../components/ui';

interface V { valid: boolean; status: string; rx_number?: string; version_no?: number; approved_at?: string; practitioner?: string; facility?: string }
const statusText: Record<string, string> = { approved: 'نسخة سارية', superseded: 'نسخة قديمة — صدر إصدار أحدث', cancelled: 'وصفة ملغاة', expired: 'انتهت صلاحية رمز التحقق', unknown: 'رمز غير معروف' };

/** Public verification of a printed prescription QR (no patient data shown). */
export function VerifyRx() {
  const [params] = useSearchParams();
  const v = useAsync(async () => (await unwrap(supabase.rpc('verify_prescription', { p_token: params.get('token') ?? '' }))) as unknown as V, [params]);
  return (
    <main className="auth-wrap">
      <div className="auth-card">
        <strong>{productName} — التحقق من وصفة</strong>
        {v.status === 'loading' && <SkeletonList rows={2} />}
        {v.status === 'error' && <ErrorState error={v.error} />}
        {v.data && (
          <>
            <div className="row">{v.data.valid ? <CheckCircle2 color="var(--c-success)" /> : <XCircle color="var(--c-danger)" />}
              <h1 style={{ fontSize: 'var(--f-h3)' }}>{statusText[v.data.status] ?? v.data.status}</h1></div>
            {v.data.rx_number && (
              <dl className="summary-list">
                <dt>رقم الوصفة</dt><dd><bdi dir="ltr">{v.data.rx_number}</bdi> · إصدار {v.data.version_no}</dd>
                <dt>الطبيب</dt><dd>{v.data.practitioner}</dd>
                <dt>الجهة</dt><dd>{v.data.facility}</dd>
                {v.data.approved_at && <><dt>الاعتماد</dt><dd>{formatDateTime(v.data.approved_at)}</dd></>}
              </dl>
            )}
            <p className="small muted">التحقق يثبت صدور النسخة من المنصة فقط، ولا يعرض بيانات المريض، ولا يغني عن متطلبات الاعتماد المحلية.</p>
          </>
        )}
      </div>
    </main>
  );
}
