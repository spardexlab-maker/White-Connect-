import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { Briefcase, KeyRound, Trash2, LogIn, LogOut, Maximize2, MessageCircle, QrCode, RefreshCw, UserPlus, UserRound } from 'lucide-react';
import { errorMessage, fieldErrors, iraqiLocal, patientRegistrationSchema, toIraqiE164 } from '@app/shared';
import { supabase } from '../../lib/supabase';
import { unwrap, useAsync } from '../../lib/useAsync';
import { useAuth } from '../../lib/auth';
import { useWorkspace } from '../../lib/workspace';
import { BirthDateSelect } from '../../components/BirthDateSelect';
import { OtpVerify } from '../../components/OtpVerify';
import { Alert, Button, ConfirmDialog, EmptyState, ErrorState, Ltr, SelectField, SkeletonList, Tabs, TextField, useToast } from '../../components/ui';

/* ------------------------------------------------------------------ */
export function SignInPrompt({ title }: { title: string }) {
  return (
    <div className="stack">
      <h1 style={{ fontSize: 'var(--f-h2)' }}>{title}</h1>
      <div className="card">
        <EmptyState icon={<UserRound />} title="سجّل الدخول للمتابعة"
                    action={<Link to={`/patient/account?next=${encodeURIComponent(location.pathname)}`} className="btn btn-primary"><LogIn size={18} aria-hidden />الدخول أو إنشاء حساب</Link>}>
          البحث والاطلاع على الأطباء متاح دون حساب. الحجوزات والرحلة الطبية تحتاج حساباً لحماية بياناتك.
        </EmptyState>
      </div>
    </div>
  );
}

/** Ask for a number, send the code; `mode` sign-in starts a session, link adds the number to this account. */
function usePhoneCode(mode: 'signin' | 'link') {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  useEffect(() => { if (!wait) return; const t = window.setTimeout(() => setWait(wait - 1), 1000); return () => window.clearTimeout(t); }, [wait]);
  const send = async (raw: string) => {
    const e164 = toIraqiE164(raw);
    if (!e164) { setError(errorMessage({ message: 'app:phone_invalid' })); return; }
    setBusy(true); setError(null);
    const { error } = mode === 'signin' ? await supabase.auth.signInWithOtp({ phone: e164 }) : await supabase.auth.updateUser({ phone: e164 });
    setBusy(false);
    if (error) { setError(errorMessage(error)); return; }
    setSentTo(e164); setWait(60);
  };
  const verify = async (code: string) => {
    if (!sentTo) return 'no number';
    const { error } = await supabase.auth.verifyOtp({ phone: sentTo, token: code, type: mode === 'signin' ? 'sms' : 'phone_change' });
    return error ? errorMessage(error) : null;
  };
  return { sentTo, setSentTo, busy, error, setError, wait, send, verify };
}

function PhoneForm({ label, button, busy, error, onSend, onTyping, secondary }: {
  label: string; button: string; busy: boolean; error: string | null; onSend: (phone: string) => void; onTyping: () => void; secondary?: boolean;
}) {
  const [phone, setPhone] = useState('');
  return (
    <form className="stack" noValidate onSubmit={(e) => { e.preventDefault(); onSend(phone); }}>
      <TextField label={label} type="tel" inputMode="tel" autoComplete="tel" ltr placeholder="0770 123 4567"
                 hint="نبعث لك رمز دخول على واتساب" value={phone} onChange={(e) => { setPhone(e.target.value); onTyping(); }} />
      {error && <Alert tone="danger">{error}</Alert>}
      <Button type="submit" variant={secondary ? 'secondary' : 'primary'} loading={busy} disabled={phone.replace(/\D/g, '').length < 10} icon={<MessageCircle size={18} />}>{button}</Button>
    </form>
  );
}

/** Phone number → 6-digit code on WhatsApp (the send-sms hook delivers it). `hold` keeps this screen up until the check mark has played. */
function PhoneSignIn({ hold, onCodeScreen }: { hold: (on: boolean) => void; onCodeScreen: (on: boolean) => void }) {
  const c = usePhoneCode('signin');
  useEffect(() => onCodeScreen(!!c.sentTo), [c.sentTo, onCodeScreen]);
  if (!c.sentTo) return (
    <>
      <PhoneForm label="رقم الموبايل" button="أرسل الرمز على واتساب" secondary busy={c.busy} error={c.error} onSend={(p) => void c.send(p)} onTyping={() => c.setError(null)} />
      <p className="otp-consent">نستعمل رقمك فقط لتسجيل دخولك وإرسال رمز التحقق على واتساب. بالمتابعة توافق على <Link to="/terms">شروط الاستخدام</Link> و<Link to="/privacy">سياسة الخصوصية</Link>.</p>
    </>
  );
  return (
    <OtpVerify phone={c.sentTo} resendIn={c.wait} onResend={() => void c.send(c.sentTo!)} onChangeNumber={() => c.setSentTo(null)}
               submit={async (code) => { hold(true); const err = await c.verify(code); if (err) hold(false); return err; }}
               onDone={() => hold(false)} />
  );
}

/** Add (or change) the number this account signs in with — verified by a WhatsApp code, then it is the same account by phone. */
function PhoneLink() {
  const { session } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const c = usePhoneCode('link');
  const current = session?.user.phone ? `+${session.user.phone.replace(/^\+/, '')}` : null;
  return (
    <section className="card stack-sm" aria-labelledby="phone-link-h">
      <div className="row-between">
        <h2 id="phone-link-h" className="section-title row"><MessageCircle size={20} aria-hidden />الدخول برقم الموبايل</h2>
        {current && !open && <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>تغيير الرقم</Button>}
      </div>
      {current && !open && <p className="small">مربوط بالرقم <Ltr>{iraqiLocal(current)}</Ltr> — تكدر تدخل بيه برمز على واتساب.</p>}
      {!current && !open && (
        <>
          <p className="small muted">اربط رقمك حتى تدخل لنفس هذا الحساب برمز على واتساب، بدون كلمة مرور.</p>
          <Button variant="secondary" icon={<MessageCircle size={18} />} onClick={() => setOpen(true)}>ربط رقم الموبايل</Button>
        </>
      )}
      {open && !c.sentTo && (
        <>
          <PhoneForm label={current ? 'الرقم الجديد' : 'رقم الموبايل'} button="أرسل رمز التأكيد على واتساب" busy={c.busy} error={c.error}
                     onSend={(p) => void c.send(p)} onTyping={() => c.setError(null)} />
          <Button variant="ghost" size="sm" onClick={() => { setOpen(false); c.setError(null); }}>إلغاء</Button>
        </>
      )}
      {open && c.sentTo && (
        <OtpVerify phone={c.sentTo} resendIn={c.wait} onResend={() => void c.send(c.sentTo!)} onChangeNumber={() => c.setSentTo(null)}
                   submit={async (code) => { const err = await c.verify(code); if (!err) await supabase.auth.refreshSession(); return err; }}
                   onDone={() => { setOpen(false); c.setSentTo(null); toast('رُبط الرقم بحسابك — تكدر تدخل بيه من هسه', 'success'); }} />
      )}
    </section>
  );
}

function AuthForms({ hold }: { hold: (on: boolean) => void }) {
  const [more, setMore] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [codeScreen, setCodeScreen] = useState(false);

  const google = async () => {
    setGoogleBusy(true); setError(null);
    // comes back to this page; RegisterSelf then asks for the patient profile on first sign-in
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/patient/account${window.location.search}`, queryParams: { prompt: 'select_account' } },
    });
    if (error) { setGoogleBusy(false); setError(errorMessage(error)); }
  };

  // the email link signs them in and opens /reset-password, then back to «حسابي»
  const sendReset = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError('اكتب بريدك الإلكتروني أولاً، بعدين دوس «نسيت كلمة المرور؟».'); return; }
    setBusy(true); setError(null); setInfo(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password?next=/patient/account` });
    setBusy(false);
    if (error) setError(errorMessage(error)); else setInfo('أرسلنا رابطاً إلى بريدك — افتحه واختر كلمة مرور جديدة. (تحقق من الرسائل غير المرغوبة إن لم يصل.)');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null); setInfo(null);
    const res = mode === 'signin'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (res.error) { setError(errorMessage(res.error)); return; }
    if (mode === 'signup' && !res.data.session) setInfo('تم إنشاء الحساب. افتح رسالة التأكيد في بريدك ثم سجّل الدخول.');
  };

  return (
    <div className="card stack auth-card" style={{ maxWidth: 480 }}>
      {/* Google first: free for us and one tap for most people; WhatsApp codes cost per message */}
      {!codeScreen && (
        <>
          <button type="button" className="btn btn-google" onClick={google} disabled={googleBusy} aria-busy={googleBusy}>
            <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
              <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17z" />
              <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z" />
              <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.2-8.5 2.2-6.2 0-11.5-4.1-13.4-9.8l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
            </svg>
            {googleBusy ? 'جارٍ التحويل إلى Google…' : 'المتابعة باستخدام Google'}
          </button>
          {error && !more && <Alert tone="danger">{error}</Alert>}
          <div className="or-sep"><span>أو برقم الموبايل</span></div>
        </>
      )}
      <PhoneSignIn hold={hold} onCodeScreen={setCodeScreen} />
      {!more && !codeScreen && <button type="button" className="auth-more" aria-expanded={false} onClick={() => setMore(true)}>الدخول بالبريد الإلكتروني</button>}
      {more && (
        <>
          <div className="or-sep"><span>أو بالبريد الإلكتروني</span></div>
          <Tabs label="الدخول" value={mode} onChange={(m) => { setMode(m); setError(null); }}
                tabs={[{ id: 'signin', label: 'تسجيل الدخول' }, { id: 'signup', label: 'حساب جديد' }]} />
          <form className="stack" onSubmit={submit} noValidate role="tabpanel" id={`panel-${mode}`} aria-labelledby={`tab-${mode}`}>
            <TextField label="البريد الإلكتروني" type="email" autoComplete="email" ltr required value={email} onChange={(e) => setEmail(e.target.value)} />
            <TextField label="كلمة المرور" type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} ltr required minLength={8}
                       hint={mode === 'signup' ? '8 أحرف على الأقل' : undefined} value={password} onChange={(e) => setPassword(e.target.value)} />
            {error && <Alert tone="danger">{error}</Alert>}
            {info && <Alert tone="success">{info}</Alert>}
            <Button type="submit" loading={busy} icon={mode === 'signin' ? <LogIn size={18} /> : <UserPlus size={18} />}>
              {mode === 'signin' ? 'دخول' : 'إنشاء الحساب'}
            </Button>
            {mode === 'signin' && <Button type="button" variant="ghost" size="sm" onClick={() => void sendReset()}>نسيت كلمة المرور؟</Button>}
          </form>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
function RegisterSelf({ onDone }: { onDone: () => void }) {
  const { session } = useAuth();
  const googleName = (session?.user.user_metadata?.full_name ?? session?.user.user_metadata?.name ?? '') as string;
  const [form, setForm] = useState({ fullName: googleName, sex: '', birthDate: '', phone: iraqiLocal(session?.user.phone).replace(/\s/g, '') });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = patientRegistrationSchema.safeParse({ ...form, sex: form.sex || undefined });
    setErrors(fieldErrors(parsed));
    if (!parsed.success) return;
    setBusy(true); setServerError(null);
    const { error } = await supabase.rpc('register_self_patient', {
      p_full_name: form.fullName, p_sex: (form.sex || undefined) as 'male' | 'female' | undefined,
      p_birth_date: form.birthDate || undefined, p_phone: form.phone || undefined,
    });
    setBusy(false);
    if (error) { setServerError(errorMessage(error)); return; }
    onDone();
  };

  return (
    <form className="card stack" onSubmit={submit} noValidate style={{ maxWidth: 560 }}>
      <h2 className="section-title">أكمل ملفك كمريض</h2>
      <p className="small muted">الاسم فقط مطلوب. بقية البيانات اختيارية ويمكن إضافتها لاحقاً عند الحاجة لخدمة معينة.</p>
      <TextField label="الاسم الكامل" required value={form.fullName} error={errors.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
      <SelectField label="الجنس" optional value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })}>
        <option value="">—</option><option value="female">أنثى</option><option value="male">ذكر</option>
      </SelectField>
      <BirthDateSelect optional value={form.birthDate} error={errors.birthDate} onChange={(v) => setForm({ ...form, birthDate: v })} />
      <TextField label="رقم الهاتف" optional type="tel" ltr inputMode="tel" value={form.phone} error={errors.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                 hint="لا يُستخدم الهاتف لدمج الملفات تلقائياً." />
      {serverError && <Alert tone="danger">{serverError}</Alert>}
      <Button type="submit" loading={busy}>حفظ الملف</Button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
interface Card { patient_id: string; public_code: string; full_name: string; qr_token: string }

function PatientCard({ patientId, relationship }: { patientId: string; relationship: string }) {
  const toast = useToast();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [large, setLarge] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const card = useAsync(async () => (await unwrap(supabase.rpc('my_patient_card', { p_patient_id: patientId }))) as unknown as Card, [patientId]);

  useEffect(() => {
    if (card.data && canvas.current) {
      // the QR carries ONLY the random token — no name, phone or health data
      void QRCode.toCanvas(canvas.current, card.data.qr_token, { width: large ? 360 : 220, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#152536', light: '#FFFFFF' } });
    }
  }, [card.data, large]);

  const rotate = async () => {
    const { error } = await supabase.rpc('rotate_patient_qr', { p_patient_id: patientId });
    setConfirmRotate(false);
    if (error) { toast(errorMessage(error), 'danger'); return; }
    toast('تم إصدار رمز جديد وإبطال القديم', 'success');
    card.reload();
  };

  const makeLinkCode = async () => {
    const { data, error } = await supabase.rpc('create_account_link_code');
    if (error) { toast(errorMessage(error), 'danger'); return; }
    setLinkCode(data as string);
  };

  if (card.status === 'loading') return <div className="card"><SkeletonList rows={2} /></div>;
  if (card.status === 'error') return <div className="card"><ErrorState error={card.error} onRetry={card.reload} /></div>;

  return (
    <section className="card stack" aria-labelledby={`card-${patientId}`}>
      <div className="row-between">
        <h2 id={`card-${patientId}`} className="section-title">{card.data.full_name}{relationship === 'guardian' && <span className="muted small"> (تابع)</span>}</h2>
        <span className="label-text">معرّف المريض: <Ltr>{card.data.public_code}</Ltr></span>
      </div>
      <div className="qr-card">
        <canvas ref={canvas} role="img" aria-label="رمز QR للتعريف في العيادة" />
        <span className="code-pill">{card.data.public_code}</span>
        <p className="small muted">أظهر هذه البطاقة في الاستقبال للتعريف. الرمز وسيلة تعريف فقط ولا يمنح أحداً إذناً بقراءة سجلك.</p>
      </div>
      <div className="row" style={{ justifyContent: 'center' }}>
        <Button variant="secondary" size="sm" icon={<Maximize2 size={16} />} onClick={() => setLarge((v) => !v)}>{large ? 'حجم عادي' : 'عرض كبير للمسح'}</Button>
        <Button variant="ghost" size="sm" icon={<RefreshCw size={16} />} onClick={() => setConfirmRotate(true)}>تغيير الرمز</Button>
        {relationship === 'self' && <Button variant="ghost" size="sm" icon={<KeyRound size={16} />} onClick={makeLinkCode}>رمز ربط سجل العيادة</Button>}
      </div>
      {linkCode && (
        <Alert tone="info" title="رمز الربط (صالح 15 دقيقة)">
          <span className="code-pill" style={{ display: 'inline-block', marginBlock: 6 }}>{linkCode}</span><br />
          أعطِ هذا الرمز لموظف الاستقبال بعد التحقق من هويتك ليتم ربط سجلك القديم في العيادة بحسابك مع حفظ التاريخ.
        </Alert>
      )}
      <ConfirmDialog open={confirmRotate} title="تغيير رمز QR؟" confirmLabel="إصدار رمز جديد" onCancel={() => setConfirmRotate(false)} onConfirm={rotate}>
        سيتوقف الرمز الحالي (وأي بطاقة مطبوعة به) عن العمل فوراً.
      </ConfirmDialog>
    </section>
  );
}

/** «احذف حسابي» — closes the account for good; the medical record stays with the clinics. */
function DeleteAccount() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const close = () => { setOpen(false); setTyped(''); setError(null); };
  const remove = async () => {
    if (typed.trim() !== 'حذف') { setError('اكتب كلمة «حذف» للتأكيد.'); return; }
    setBusy(true); setError(null);
    const { error } = await supabase.functions.invoke('delete-account', { body: { confirm: 'DELETE' } });
    if (error) {
      const code = await (error as { context?: Response }).context?.json?.().then((b: { error?: string }) => b.error).catch(() => null);
      setBusy(false);
      setError(errorMessage({ message: `app:${code ?? 'delete_failed'}` }));
      return;
    }
    await signOut();
    toast('حُذف حسابك. نتمنى لك دوام الصحة.', 'success');
    navigate('/patient', { replace: true });
  };
  return (
    <section className="card stack-sm" aria-labelledby="delete-h">
      <h2 id="delete-h" className="section-title row"><Trash2 size={20} aria-hidden />حذف الحساب</h2>
      <p className="small muted">يحذف حسابك وطرق دخولك (الرقم والبريد وGoogle) ويوقف التذكيرات والإشعارات. <Link to="/account-deletion">شنو يصير ببياناتي؟</Link></p>
      <div><Button variant="danger" size="sm" icon={<Trash2 size={16} />} onClick={() => setOpen(true)}>احذف حسابي</Button></div>
      <ConfirmDialog open={open} title="حذف الحساب نهائياً؟" confirmLabel="احذف حسابي" tone="danger" loading={busy} onCancel={close} onConfirm={() => void remove()}>
        <p>ما تكدر ترجع الحساب بعد الحذف. حجوزاتك القادمة تُلغى، والتذكيرات تتوقف.</p>
        <p className="small muted">السجل الطبي (الزيارات والوصفات والتحاليل) يبقى محفوظاً عند الجهات اللي عالجتك كما يفرض القانون، بس ما يرتبط بأي حساب.</p>
        <TextField label="للتأكيد اكتب: حذف" value={typed} onChange={(e) => { setTyped(e.target.value); setError(null); }} />
        {error && <Alert tone="danger">{error}</Alert>}
      </ConfirmDialog>
    </section>
  );
}

/* ------------------------------------------------------------------ */
export function Account() {
  const { session, access, refreshAccess, signOut, loading } = useAuth();
  const { workspaces } = useWorkspace();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = params.get('next');
  const [holding, setHolding] = useState(false);   // the WhatsApp check mark plays before the signed-in page appears

  useEffect(() => {
    if (session && access?.patient_ids?.length && next) navigate(next, { replace: true });
  }, [session, access, next, navigate]);

  useEffect(() => {
    if (location.hash === '#card') document.getElementById('cards')?.scrollIntoView();
  }, [access]);

  if (loading) return <SkeletonList />;
  if (!session || holding) {
    return (
      <div className="stack">
        <h1 style={{ fontSize: 'var(--f-h2)' }}>حسابي</h1>
        <AuthForms hold={setHolding} />
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="row-between">
        <div>
          <h1 style={{ fontSize: 'var(--f-h2)' }}>حسابي</h1>
          <span className="muted small"><Ltr>{session.user.email || iraqiLocal(session.user.phone)}</Ltr></span>
        </div>
        <div className="row">
          {workspaces.length > 0 && <Link to="/workspace" className="btn btn-secondary btn-sm"><Briefcase size={16} aria-hidden />مساحة العمل المهنية</Link>}
          <Button variant="ghost" size="sm" icon={<LogOut size={16} />} onClick={() => void signOut()}>خروج</Button>
        </div>
      </div>

      {access && access.patient_ids.length === 0 && <RegisterSelf onDone={() => void refreshAccess()} />}

      {access && access.patient_ids.length > 0 && <PhoneLink />}

      {access && access.patient_ids.length > 0 && (
        <div id="cards" className="stack">
          <h2 className="section-title row"><QrCode size={20} aria-hidden />بطاقة التعريف</h2>
          {access.patient_ids.map((p) => <PatientCard key={p.patient_id} patientId={p.patient_id} relationship={p.relationship} />)}
        </div>
      )}

      {workspaces.length === 0 && <DeleteAccount />}
      <p className="small muted legal-links"><Link to="/privacy">سياسة الخصوصية</Link> · <Link to="/terms">شروط الاستخدام</Link></p>
    </div>
  );
}
