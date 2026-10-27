import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { LogIn } from 'lucide-react';
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

  const [forgot, setForgot] = useState(false);
  const [sent, setSent] = useState(false);
  const google = async () => {
    setError(null);
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google', options: { redirectTo: `${window.location.origin}/login${window.location.search}`, queryParams: { prompt: 'select_account' } },
    });
    if (err) setError(errorMessage(err));
  };
  // the email link signs the user in and opens /reset-password to choose a new one
  const sendReset = async () => {
    setBusy(true); setError(null);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
    setBusy(false);
    if (err) setError(errorMessage(err)); else setSent(true);
  };

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
        <div className="brand"><img className="brand-logo" src="/logo-symbol.png" alt="" width={34} height={34} />{productName}</div>
        <div className="stack-sm">
          <h1 id="login-title" style={{ fontSize: 'var(--f-h2)' }}>دخول المهنيين</h1>
          <p className="muted small">للأطباء والسكرتارية والصيدليات والمختبرات وإدارة المنشآت. الحسابات تُنشأ بدعوة من الإدارة فقط.</p>
          <p className="small">طبيب وتريد تنضم للمنصة؟ <Link to="/join">املأ استمارة الانضمام</Link></p>
        </div>
        <TextField label="البريد الإلكتروني أو معرف الدخول" type="email" autoComplete="username" ltr required value={email} onChange={(e) => setEmail(e.target.value)} />
        {!forgot && <TextField label="كلمة المرور" type="password" autoComplete="current-password" ltr required value={password} onChange={(e) => setPassword(e.target.value)} />}
        {error && <Alert tone="danger">{error}</Alert>}
        {forgot ? (
          sent
            ? <Alert tone="success">أرسلنا رابطاً إلى بريدك — افتحه واختر كلمة مرور جديدة. (تحقق من الرسائل غير المرغوبة إن لم يصل.)</Alert>
            : <Button loading={busy} block disabled={!/^\S+@\S+\.\S+$/.test(email.trim())} onClick={() => void sendReset()}>أرسل رابط تعيين كلمة المرور</Button>
        ) : <Button type="submit" loading={busy} block icon={<LogIn size={18} />}>دخول</Button>}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setForgot(!forgot); setSent(false); setError(null); }}>
          {forgot ? 'رجوع للدخول بكلمة المرور' : 'نسيت كلمة المرور؟'}
        </button>
        <div className="or-sep"><span>أو</span></div>
        <button type="button" className="btn btn-google btn-block" onClick={() => void google()}>
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
          الدخول بحساب Google
        </button>
        <p className="small muted">الأدوار الحساسة تتطلب المصادقة الثنائية (MFA) حسب إعداد المنصة.</p>
        <Link to="/videos" className="small">شاهد فيديوهات شرح أبيض للأطباء والمختبرات والصيدليات</Link>
        <Link to="/patient" className="small">أنا مريض — الذهاب إلى صفحة الحجز</Link>
      </form>
    </main>
  );
}
