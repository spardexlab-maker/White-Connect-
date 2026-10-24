import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { HeartPulse, LogIn } from 'lucide-react';
import { errorMessage } from '@app/shared';
import { supabase, productName } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { Alert, Button, TextField } from '../../components/ui';

/** Unified professional sign-in (email/ID + password). No self-service role selection. */
export function ProLogin() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (session) navigate(params.get('next') ?? '/workspace', { replace: true }); }, [session, navigate, params]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (err) setError(errorMessage(err));
  };

  return (
    <main className="auth-wrap">
      <form className="auth-card" onSubmit={submit} noValidate aria-labelledby="login-title">
        <div className="brand"><span className="brand-mark"><HeartPulse size={18} aria-hidden /></span>{productName}</div>
        <div className="stack-sm">
          <h1 id="login-title" style={{ fontSize: 'var(--f-h2)' }}>دخول المهنيين</h1>
          <p className="muted small">للأطباء والسكرتارية والصيدليات والمختبرات وإدارة المنشآت. الحسابات تُنشأ بدعوة من الإدارة فقط.</p>
          <p className="small">طبيب وتريد تنضم للمنصة؟ <Link to="/join">املأ استمارة الانضمام</Link></p>
        </div>
        <TextField label="البريد الإلكتروني أو معرف الدخول" type="email" autoComplete="username" ltr required value={email} onChange={(e) => setEmail(e.target.value)} />
        <TextField label="كلمة المرور" type="password" autoComplete="current-password" ltr required value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <Alert tone="danger">{error}</Alert>}
        <Button type="submit" loading={busy} block icon={<LogIn size={18} />}>دخول</Button>
        <p className="small muted">الأدوار الحساسة تتطلب المصادقة الثنائية (MFA) حسب إعداد المنصة.</p>
        <Link to="/patient" className="small">أنا مريض — الذهاب إلى صفحة الحجز</Link>
      </form>
    </main>
  );
}
