import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, KeyRound } from 'lucide-react';
import { errorMessage } from '@app/shared';
import { productName, supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Alert, Button, SkeletonList, TextField } from '../components/ui';

/** Choose a new password: opened from the reset email link, or while signed in (e.g. with Google). */
export function ResetPassword() {
  const { session, loading } = useAuth();
  const [params] = useSearchParams();
  const next = params.get('next');
  const back = next && /^\/(patient|workspace)\b/.test(next) ? next : '/workspace';   // patients come back to «حسابي»
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  // accounts with an authenticator must confirm a code first: the server only changes the password of a 2-step (aal2) session
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  useEffect(() => {
    if (!session) return;
    void (async () => {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
        const { data: f } = await supabase.auth.mfa.listFactors();
        setFactorId(f?.totp.find((x) => x.status === 'verified')?.id ?? null);
      } else setFactorId(null);
    })();
  }, [session]);
  const weak = pw.length > 0 && (pw.length < 10 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    if (factorId) {
      const { error: mfaErr } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
      if (mfaErr) { setBusy(false); setError('رمز تطبيق المصادقة غير صحيح — خذ الرمز الحالي من تطبيق المصادقة (يتغير كل 30 ثانية).'); return; }
      setFactorId(null);
    }
    const { error: err } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (err) setError(errorMessage(err)); else setDone(true);
  };
  return (
    <main className="auth-wrap">
      <form className="auth-card" onSubmit={submit} noValidate>
        <strong className="row" style={{ gap: 8 }}><KeyRound size={18} aria-hidden />{productName} — كلمة مرور جديدة</strong>
        {loading && <SkeletonList rows={2} />}
        {!loading && !session && (
          <Alert tone="warning">الرابط منتهي أو غير صالح. ارجع إلى <Link to={back.startsWith('/patient') ? '/patient/account' : '/login'}>صفحة الدخول</Link> واضغط «نسيت كلمة المرور؟» من جديد، أو ادخل بحساب Google.</Alert>
        )}
        {session && !done && (
          <>
            <span className="small muted">الحساب: <bdi dir="ltr">{session.user.email}</bdi></span>
            <TextField label="كلمة المرور الجديدة" type="password" autoComplete="new-password" ltr value={pw} onChange={(e) => setPw(e.target.value)}
                       error={weak ? '10 أحرف على الأقل، وفيها حرف ورقم' : undefined} />
            <TextField label="أعد كتابتها" type="password" autoComplete="new-password" ltr value={pw2} onChange={(e) => setPw2(e.target.value)}
                       error={pw2 && pw2 !== pw ? 'غير متطابقتين' : undefined} />
            {factorId && (
              <TextField label="رمز تطبيق المصادقة (6 أرقام)" hint="حسابك محمي بالمصادقة الثنائية — افتح تطبيق المصادقة واكتب الرمز الحالي." inputMode="numeric"
                         autoComplete="one-time-code" ltr maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
            )}
            {error && <Alert tone="danger">{error}</Alert>}
            <Button type="submit" block loading={busy} disabled={!pw || weak || pw !== pw2 || (!!factorId && code.length !== 6)}>حفظ كلمة المرور</Button>
          </>
        )}
        {done && (
          <>
            <div className="row" style={{ gap: 8 }}><CheckCircle2 color="var(--c-success)" aria-hidden /><strong>تم حفظ كلمة المرور الجديدة</strong></div>
            <span className="small">صار تكدر تدخل بالبريد وكلمة المرور، أو بحساب Google — الاثنين لنفس الحساب.</span>
            <Link to={back} className="btn btn-primary btn-block">متابعة</Link>
          </>
        )}
      </form>
    </main>
  );
}
