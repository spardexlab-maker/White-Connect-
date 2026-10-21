import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { Briefcase, KeyRound, LogIn, LogOut, Maximize2, QrCode, RefreshCw, UserPlus, UserRound } from 'lucide-react';
import { errorMessage, fieldErrors, patientRegistrationSchema } from '@app/shared';
import { supabase } from '../../lib/supabase';
import { unwrap, useAsync } from '../../lib/useAsync';
import { useAuth } from '../../lib/auth';
import { useWorkspace } from '../../lib/workspace';
import { BirthDateSelect } from '../../components/BirthDateSelect';
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

function AuthForms() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);

  const google = async () => {
    setGoogleBusy(true); setError(null);
    // comes back to this page; RegisterSelf then asks for the patient profile on first sign-in
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/patient/account${window.location.search}`, queryParams: { prompt: 'select_account' } },
    });
    if (error) { setGoogleBusy(false); setError(errorMessage(error)); }
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
    <div className="card stack" style={{ maxWidth: 480 }}>
      <button type="button" className="btn btn-google" onClick={google} disabled={googleBusy} aria-busy={googleBusy}>
        <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
          <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17z" />
          <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z" />
          <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.2-8.5 2.2-6.2 0-11.5-4.1-13.4-9.8l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
        </svg>
        {googleBusy ? 'جارٍ التحويل إلى Google…' : 'المتابعة باستخدام Google'}
      </button>
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
        <p className="small muted">الدخول برقم الهاتف ورمز SMS يتطلب ربط مزود رسائل مدفوع؛ لم يُفعّل في هذه البيئة بعد.</p>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */
function RegisterSelf({ onDone }: { onDone: () => void }) {
  const { session } = useAuth();
  const googleName = (session?.user.user_metadata?.full_name ?? session?.user.user_metadata?.name ?? '') as string;
  const [form, setForm] = useState({ fullName: googleName, sex: '', birthDate: '', phone: '' });
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

/* ------------------------------------------------------------------ */
export function Account() {
  const { session, access, refreshAccess, signOut, loading } = useAuth();
  const { workspaces } = useWorkspace();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = params.get('next');

  useEffect(() => {
    if (session && access?.patient_ids?.length && next) navigate(next, { replace: true });
  }, [session, access, next, navigate]);

  useEffect(() => {
    if (location.hash === '#card') document.getElementById('cards')?.scrollIntoView();
  }, [access]);

  if (loading) return <SkeletonList />;
  if (!session) {
    return (
      <div className="stack">
        <h1 style={{ fontSize: 'var(--f-h2)' }}>حسابي</h1>
        <AuthForms />
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="row-between">
        <div>
          <h1 style={{ fontSize: 'var(--f-h2)' }}>حسابي</h1>
          <span className="muted small"><Ltr>{session.user.email}</Ltr></span>
        </div>
        <div className="row">
          {workspaces.length > 0 && <Link to="/workspace" className="btn btn-secondary btn-sm"><Briefcase size={16} aria-hidden />مساحة العمل المهنية</Link>}
          <Button variant="ghost" size="sm" icon={<LogOut size={16} />} onClick={() => void signOut()}>خروج</Button>
        </div>
      </div>

      {access && access.patient_ids.length === 0 && <RegisterSelf onDone={() => void refreshAccess()} />}

      {access && access.patient_ids.length > 0 && (
        <div id="cards" className="stack">
          <h2 className="section-title row"><QrCode size={20} aria-hidden />بطاقة التعريف</h2>
          {access.patient_ids.map((p) => <PatientCard key={p.patient_id} patientId={p.patient_id} relationship={p.relationship} />)}
        </div>
      )}
    </div>
  );
}
