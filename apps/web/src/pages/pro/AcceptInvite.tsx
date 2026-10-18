import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, HeartPulse } from 'lucide-react';
import { errorMessage, roleLabel, type MemberRole } from '@app/shared';
import { supabase, productName } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useWorkspace } from '../../lib/workspace';
import { Alert, Button, TextField } from '../../components/ui';

/**
 * Invitation acceptance: the invitee creates (or signs in to) their OWN
 * account with the invited email and sets their own password. The role and
 * facility come from the invitation on the server, not from this page.
 */
export function AcceptInvite() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const { session } = useAuth();
  const { reload } = useWorkspace();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<MemberRole | null>(null);

  const auth = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const res = mode === 'signup' ? await supabase.auth.signUp({ email, password }) : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (res.error) setError(errorMessage(res.error));
    else if (!res.data.session) setError('أكّد بريدك الإلكتروني من الرسالة المرسلة ثم عُد لهذا الرابط.');
  };

  const accept = async () => {
    setBusy(true); setError(null);
    const { data, error: err } = await supabase.rpc('accept_invitation', { p_token: token });
    setBusy(false);
    if (err) { setError(errorMessage(err)); return; }
    setAccepted((data as { role: MemberRole }).role);
    await reload();
  };

  return (
    <main className="auth-wrap">
      <div className="auth-card">
        <div className="brand"><span className="brand-mark"><HeartPulse size={18} aria-hidden /></span>{productName}</div>
        <h1 style={{ fontSize: 'var(--f-h2)' }}>قبول دعوة الانضمام</h1>
        {!token && <Alert tone="danger">رابط الدعوة غير مكتمل.</Alert>}
        {accepted ? (
          <>
            <Alert tone="success" title="تم الانضمام">أصبحت عضواً بدور: {roleLabel[accepted]}.</Alert>
            <Button icon={<CheckCircle2 size={18} />} onClick={() => navigate('/workspace')}>الذهاب إلى مساحة العمل</Button>
          </>
        ) : session ? (
          <>
            <p className="small">أنت مسجّل باسم <bdi dir="ltr">{session.user.email}</bdi>. يجب أن يطابق البريد المدعو.</p>
            {error && <Alert tone="danger">{error}</Alert>}
            <Button loading={busy} disabled={!token} onClick={accept}>قبول الدعوة</Button>
          </>
        ) : (
          <form className="stack" onSubmit={auth} noValidate>
            <div className="segmented" role="group" aria-label="نوع الحساب">
              <button type="button" aria-pressed={mode === 'signup'} onClick={() => setMode('signup')}>حساب جديد</button>
              <button type="button" aria-pressed={mode === 'signin'} onClick={() => setMode('signin')}>لدي حساب</button>
            </div>
            <TextField label="البريد الإلكتروني المدعو" type="email" ltr required value={email} onChange={(e) => setEmail(e.target.value)} />
            <TextField label="كلمة المرور" type="password" ltr required minLength={8} hint={mode === 'signup' ? 'اختر كلمة مرورك بنفسك (8 أحرف على الأقل)' : undefined}
                       value={password} onChange={(e) => setPassword(e.target.value)} />
            {error && <Alert tone="danger">{error}</Alert>}
            <Button type="submit" loading={busy}>{mode === 'signup' ? 'إنشاء الحساب' : 'دخول'}</Button>
          </form>
        )}
      </div>
    </main>
  );
}
