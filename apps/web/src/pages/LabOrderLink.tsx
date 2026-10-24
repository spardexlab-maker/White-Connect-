import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FlaskConical } from 'lucide-react';
import { productName } from '../lib/supabase';
import { useWorkspace } from '../lib/workspace';

/** Where the QR on an open lab order points: a lab member goes straight to «طلب برمز»; anyone else sees what to do. */
export function LabOrderLink() {
  const [params] = useSearchParams();
  const code = (params.get('code') ?? '').toUpperCase();
  const { workspaces } = useWorkspace();
  const navigate = useNavigate();
  const isLab = workspaces.some((w) => w.role === 'lab_technician' || w.role === 'lab_approver');
  useEffect(() => { if (isLab && code) navigate(`/workspace/lab/open?code=${encodeURIComponent(code)}`, { replace: true }); }, [isLab, code, navigate]);
  return (
    <main className="auth-wrap">
      <div className="auth-card stack">
        <strong className="row" style={{ gap: 8 }}><FlaskConical size={18} aria-hidden />{productName} — طلب تحاليل</strong>
        <span>رمز الطلب</span>
        <strong className="open-code" dir="ltr" style={{ fontSize: 28 }}>{code || '—'}</strong>
        <span className="small">للمختبر: ادخل حسابك في {productName} وافتح «طلب برمز (QR)» ثم أدخل هذا الرمز، فيُضاف الطلب عندك مباشرة.</span>
        <Link to="/login" className="btn btn-primary">دخول المختبر</Link>
      </div>
    </main>
  );
}
