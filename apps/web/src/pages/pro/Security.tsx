import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { HeartPulse, ShieldCheck, Smartphone } from 'lucide-react';
import { errorMessage } from '@app/shared';
import { supabase, productName } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { Alert, Button, Ltr, SkeletonList, TextField } from '../../components/ui';

/**
 * Two-factor authentication (TOTP) for professional / admin accounts.
 *  - no verified factor → enroll (QR from Supabase Auth) + verify a code
 *  - verified factor but session at aal1 → challenge (enter code)
 * The server checks aal2 itself (private.mfa_ok); this page only gets you there.
 */
export function Security() {
  const { session, refreshAccess } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') ?? '/workspace';
  const [state, setState] = useState<'loading' | 'enroll' | 'challenge' | 'done'>('loading');
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    (async () => {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const verified = factors?.totp.find((f) => f.status === 'verified');
      if (verified) {
        setFactorId(verified.id);
        setState(aal?.currentLevel === 'aal2' ? 'done' : 'challenge');
        return;
      }
      // clean up abandoned enrollments, then start a new one
      for (const f of factors?.all ?? []) if (f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id });
      const { data, error: err } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `${productName} ${new Date().toISOString().slice(0, 10)}` });
      if (err) { setError(errorMessage(err)); return; }
      setFactorId(data.id); setQr(data.totp.qr_code); setSecret(data.totp.secret); setState('enroll');
    })();
  }, [session]);

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true); setError(null);
    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
    if (chErr) { setBusy(false); setError(errorMessage(chErr)); return; }
    const { error: vErr } = await supabase.auth.mfa.verify({ factorId, challengeId: ch.id, code: code.trim() });
    setBusy(false);
    if (vErr) { setError('الرمز غير صحيح أو انتهت صلاحيته. أدخل الرمز الحالي من التطبيق.'); return; }
    await refreshAccess();
    navigate(next, { replace: true });
  };

  return (
    <main className="auth-wrap">
      <div className="auth-card">
        <div className="brand"><span className="brand-mark"><HeartPulse size={18} aria-hidden /></span>{productName}</div>
        <h1 style={{ fontSize: 'var(--f-h2)' }} className="row"><ShieldCheck aria-hidden />المصادقة الثنائية</h1>
        {state === 'loading' && !error && <SkeletonList rows={2} />}
        {state === 'enroll' && (
          <>
            <p className="small">1) ثبّت تطبيق مصادقة مثل Google Authenticator أو Microsoft Authenticator. 2) امسح الرمز. 3) أدخل الرمز المكوّن من 6 أرقام.</p>
            {qr && <img src={qr} alt="رمز QR لإضافة الحساب إلى تطبيق المصادقة" style={{ width: 200, height: 200, alignSelf: 'center', background: '#fff' }} />}
            {secret && <p className="small muted">أو أدخل المفتاح يدوياً: <Ltr className="code-pill">{secret}</Ltr></p>}
          </>
        )}
        {state === 'challenge' && <p className="small row"><Smartphone size={16} aria-hidden />أدخل الرمز الحالي من تطبيق المصادقة لإكمال الدخول.</p>}
        {state === 'done' && <Alert tone="success">المصادقة الثنائية مفعّلة لهذه الجلسة.</Alert>}
        {(state === 'enroll' || state === 'challenge') && (
          <form className="stack" onSubmit={verify} noValidate>
            <TextField label="رمز التحقق" inputMode="numeric" autoComplete="one-time-code" ltr maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus />
            <Button type="submit" loading={busy} disabled={code.length !== 6}>{state === 'enroll' ? 'تفعيل' : 'تحقق'}</Button>
          </form>
        )}
        {error && <Alert tone="danger">{error}</Alert>}
        {state === 'done' && <Button onClick={() => navigate(next)}>متابعة</Button>}
        <Link to="/reset-password" className="small">تغيير كلمة المرور</Link>
      </div>
    </main>
  );
}
