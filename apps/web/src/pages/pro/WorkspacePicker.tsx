import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { HeartPulse, LogOut, ShieldCheck, UserRound } from 'lucide-react';
import { productName } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useWorkspace } from '../../lib/workspace';
import { areaPath, WorkspaceList } from '../../layouts/WorkspaceLayout';
import { Alert, Button, ErrorState, SkeletonList } from '../../components/ui';

/** After sign-in: one membership → straight to its board; several → explicit choice (§21). */
export function WorkspacePicker() {
  const { access, signOut } = useAuth();
  const { workspaces, loading, error, select, reload } = useWorkspace();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && access && workspaces.length === 1 && !access.is_platform_admin && !access.patient_ids.length) {
      select(workspaces[0].membership_id);
      navigate(areaPath(workspaces[0]), { replace: true });
    }
  }, [loading, workspaces, access, select, navigate]);

  return (
    <main className="auth-wrap">
      <div className="auth-card" style={{ width: 'min(560px, 100%)' }}>
        <div className="brand"><span className="brand-mark"><HeartPulse size={18} aria-hidden /></span>{productName}</div>
        <h1 style={{ fontSize: 'var(--f-h2)' }}>اختر مساحة العمل</h1>
        {loading && <SkeletonList rows={2} />}
        {!!error && <ErrorState error={error} onRetry={() => void reload()} />}
        {!loading && workspaces.length > 0 && (
          <WorkspaceList workspaces={workspaces} onPick={(w) => { select(w.membership_id); navigate(areaPath(w)); }} />
        )}
        {access?.is_platform_admin && (
          <Link to="/platform-admin" className="btn btn-secondary"><ShieldCheck size={18} aria-hidden />إدارة المنصة</Link>
        )}
        {access?.platform_admin_needs_mfa && (
          <Link to="/security?next=/platform-admin" className="btn btn-secondary"><ShieldCheck size={18} aria-hidden />إدارة المنصة (تتطلب المصادقة الثنائية)</Link>
        )}
        {access && access.patient_ids.length > 0 && (
          <Link to="/patient" className="btn btn-ghost"><UserRound size={18} aria-hidden />مساحتي الشخصية كمريض</Link>
        )}
        {!loading && !error && workspaces.length === 0 && !access?.is_platform_admin && (
          <Alert tone="info" title="لا توجد عضوية فعّالة لهذا الحساب">
            إن كنت موظفاً، اطلب من مدير منشأتك إرسال دعوة إلى بريدك أو مراجعة حالة حسابك.
          </Alert>
        )}
        <Button variant="ghost" icon={<LogOut size={16} />} onClick={async () => { await signOut(); navigate('/login'); }}>تسجيل الخروج</Button>
      </div>
    </main>
  );
}
