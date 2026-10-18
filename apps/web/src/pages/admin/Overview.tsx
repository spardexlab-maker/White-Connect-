import { Building2, MailOpen, ShieldAlert, UserCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { unwrap, useAsync } from '../../lib/useAsync';
import { Alert, ErrorState, PageHead, SkeletonList } from '../../components/ui';

interface Overview { organizations: Record<string, number> | null; facilities: Record<string, number> | null; pending_facilities: number; active_memberships: number; open_invitations: number; suspended_accounts: number }

/** Real operational counters only — the platform admin has no access to medical records (§3). */
export function AdminOverview() {
  const data = useAsync(async () => (await unwrap(supabase.rpc('platform_overview'))) as unknown as Overview, []);
  return (
    <div className="stack">
      <PageHead title="نظرة عامة على المنصة" subtitle="مؤشرات تشغيلية — بلا بيانات طبية" />
      {data.status === 'loading' && <SkeletonList />}
      {data.status === 'error' && <ErrorState error={data.error} onRetry={data.reload} />}
      {data.data && (
        <>
          <div className="kpi-strip">
            <div className="kpi"><Building2 size={22} aria-hidden /><div><div className="kpi-v num">{data.data.organizations?.active ?? 0}</div><div className="kpi-l">مجمعات فعّالة</div></div></div>
            <div className="kpi"><ShieldAlert size={22} aria-hidden /><div><div className="kpi-v num">{data.data.pending_facilities}</div><div className="kpi-l">جهات بانتظار التحقق</div></div></div>
            <div className="kpi"><UserCheck size={22} aria-hidden /><div><div className="kpi-v num">{data.data.active_memberships}</div><div className="kpi-l">عضويات فعّالة</div></div></div>
            <div className="kpi"><MailOpen size={22} aria-hidden /><div><div className="kpi-v num">{data.data.open_invitations}</div><div className="kpi-l">دعوات مفتوحة</div></div></div>
          </div>
          <Alert tone="info" title="حدود صلاحيات الإدارة">
            لا تمنح هذه اللوحة قراءة السجلات الطبية. أي وصول استثنائي مستقبلي يجب أن يكون مقيداً ومسبباً ومؤقتاً ومسجلاً (غير مفعّل في هذه النسخة).
          </Alert>
          <div className="card">
            <h2 className="section-title">الجهات حسب النوع</h2>
            <p className="small">عيادات: {data.data.facilities?.clinic ?? 0} · صيدليات: {data.data.facilities?.pharmacy ?? 0} · مختبرات: {data.data.facilities?.laboratory ?? 0} · حسابات موقوفة: {data.data.suspended_accounts}</p>
          </div>
        </>
      )}
    </div>
  );
}
