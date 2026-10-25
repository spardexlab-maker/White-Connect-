import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { LogIn, MessageCircle, UserPlus } from 'lucide-react-native';
import { errorMessage, fieldErrors, iraqiLocal, patientRegistrationSchema, toIraqiE164 } from '@app/shared';
import { supabase, webUrl } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { OtpVerify } from './OtpVerify';
import { signInWithGoogle } from '../lib/googleAuth';
import { BirthDateField } from './BirthDateField';
import { Alert, Button, Chip, Field, Row, Segmented, Stack, Text } from './ui';
import { color } from '../theme';

// While the WhatsApp check mark plays, screens keep showing the sign-in form (the session
// arrives first); `useAuthHold` lets them wait for it.
let held = false;
const holdSubs = new Set<() => void>();
const setHeld = (v: boolean) => { held = v; holdSubs.forEach((f) => f()); };
export function useAuthHold(): boolean {
  const [, bump] = useState(0);
  useEffect(() => { const f = () => bump((n) => n + 1); holdSubs.add(f); return () => { holdSubs.delete(f); }; }, []);
  return held;
}

/** Ask for a number and send the code; sign-in starts a session, link adds the number to this account. */
function usePhoneCode(mode: 'signin' | 'link') {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  useEffect(() => { if (!wait) return; const t = setTimeout(() => setWait(wait - 1), 1000); return () => clearTimeout(t); }, [wait]);
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
    <Stack>
      <Field label={label} ltr keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" placeholder="0770 123 4567"
             hint="نبعث لك رمز دخول على واتساب" value={phone} onChangeText={(t) => { setPhone(t); onTyping(); }} onSubmitEditing={() => onSend(phone)} />
      {error && <Alert tone="danger">{error}</Alert>}
      <Button title={button} variant={secondary ? 'secondary' : 'primary'} loading={busy} disabled={phone.replace(/\D/g, '').length < 10} onPress={() => onSend(phone)}
              icon={<MessageCircle size={18} color={secondary ? color.primary : color.surface} />} />
    </Stack>
  );
}

/** Phone number → 6-digit code on WhatsApp (the send-sms hook delivers it). */
function PhoneSignIn({ onCodeScreen }: { onCodeScreen: (on: boolean) => void }) {
  const c = usePhoneCode('signin');
  useEffect(() => onCodeScreen(!!c.sentTo), [c.sentTo, onCodeScreen]);
  if (!c.sentTo) return (
    <Stack gap={6}>
      <PhoneForm label="رقم الموبايل" button="أرسل الرمز على واتساب" secondary busy={c.busy} error={c.error} onSend={(p) => void c.send(p)} onTyping={() => c.setError(null)} />
      <Text variant="small" muted>نستعمل رقمك فقط لتسجيل دخولك وإرسال رمز التحقق على واتساب. بالمتابعة توافق على شروط الاستخدام وسياسة الخصوصية (أسفل الصفحة).</Text>
    </Stack>
  );
  return (
    <OtpVerify phone={c.sentTo} resendIn={c.wait} onResend={() => void c.send(c.sentTo!)} onChangeNumber={() => c.setSentTo(null)}
               submit={async (code) => { setHeld(true); const err = await c.verify(code); if (err) setHeld(false); return err; }}
               onDone={() => setHeld(false)} />
  );
}

/** Add (or change) the number this account signs in with — verified by a WhatsApp code to the new number. */
export function PhoneLink() {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const c = usePhoneCode('link');
  const current = session?.user.phone ? `+${session.user.phone.replace(/^\+/, '')}` : null;
  return (
    <Stack>
      <Row between>
        <Text variant="title" style={{ flex: 1 }}>الدخول برقم الموبايل</Text>
        {current && !open && <Button title="تغيير الرقم" variant="ghost" small onPress={() => { setOpen(true); setMsg(null); }} />}
      </Row>
      {msg && <Alert tone="success">{msg}</Alert>}
      {current && !open && <Text variant="small">مربوط بالرقم {'\u2066'}{iraqiLocal(current)}{'\u2069'} — تكدر تدخل بيه برمز على واتساب.</Text>}
      {!current && !open && (
        <>
          <Text variant="small" muted>اربط رقمك حتى تدخل لنفس هذا الحساب برمز على واتساب، بدون كلمة مرور.</Text>
          <Button title="ربط رقم الموبايل" variant="secondary" icon={<MessageCircle size={18} color={color.primary} />} onPress={() => { setOpen(true); setMsg(null); }} />
        </>
      )}
      {open && !c.sentTo && (
        <>
          <PhoneForm label={current ? 'الرقم الجديد' : 'رقم الموبايل'} button="أرسل رمز التأكيد على واتساب" busy={c.busy} error={c.error}
                     onSend={(p) => void c.send(p)} onTyping={() => c.setError(null)} />
          <Button title="إلغاء" variant="ghost" small onPress={() => { setOpen(false); c.setError(null); }} />
        </>
      )}
      {open && c.sentTo && (
        <OtpVerify phone={c.sentTo} resendIn={c.wait} onResend={() => void c.send(c.sentTo!)} onChangeNumber={() => c.setSentTo(null)}
                   submit={async (code) => { const err = await c.verify(code); if (!err) await supabase.auth.refreshSession(); return err; }}
                   onDone={() => { setOpen(false); c.setSentTo(null); setMsg('رُبط الرقم بحسابك — تكدر تدخل بيه من هسه'); }} />
      )}
    </Stack>
  );
}

/** Google first (free for us, one tap), then a WhatsApp code; email + password under «الدخول بالبريد الإلكتروني». */
export function AuthForm() {
  const [more, setMore] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [codeScreen, setCodeScreen] = useState(false);

  const submit = async () => {
    setBusy(true); setError(null); setInfo(null);
    const creds = { email: email.trim(), password };
    const res = mode === 'signin' ? await supabase.auth.signInWithPassword(creds) : await supabase.auth.signUp(creds);
    setBusy(false);
    if (res.error) { setError(errorMessage(res.error)); return; }
    if (mode === 'signup' && !res.data.session) setInfo('تم إنشاء الحساب. افتح رسالة التأكيد في بريدك ثم سجّل الدخول.');
  };

  // the email link opens the website to choose a new password, then the app signs in with it
  const sendReset = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError('اكتب بريدك الإلكتروني أولاً، بعدين دوس «نسيت كلمة المرور؟».'); return; }
    setBusy(true); setError(null); setInfo(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${webUrl}/reset-password?next=/patient/account` });
    setBusy(false);
    if (error) setError(errorMessage(error)); else setInfo('أرسلنا رابطاً إلى بريدك — افتحه واختر كلمة مرور جديدة، وبعدها ادخل هنا بكلمة المرور الجديدة.');
  };

  const google = async () => {
    setGoogleBusy(true); setError(null); setInfo(null);
    try { await signInWithGoogle(); } catch (e) { setError(errorMessage(e)); } finally { setGoogleBusy(false); }
  };

  return (
    <Stack>
      {!codeScreen && <>
      <GoogleButton loading={googleBusy} onPress={google} />
      {error && !more && <Alert tone="danger">{error}</Alert>}
      <Row gap={8} style={{ alignItems: 'center' }}>
        <View style={{ flex: 1, height: 1, backgroundColor: color.border }} />
        <Text variant="small" muted>أو برقم الموبايل</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: color.border }} />
      </Row>
      </>}
      <PhoneSignIn onCodeScreen={setCodeScreen} />
      {!more && !codeScreen && <Button title="الدخول بالبريد الإلكتروني" variant="ghost" onPress={() => setMore(true)} />}
      {more && <>
      <Row gap={8} style={{ alignItems: 'center' }}>
        <View style={{ flex: 1, height: 1, backgroundColor: color.border }} />
        <Text variant="small" muted>أو بالبريد الإلكتروني</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: color.border }} />
      </Row>
      <Segmented value={mode} onChange={(m) => { setMode(m); setError(null); }}
                 options={[{ id: 'signin', label: 'تسجيل الدخول' }, { id: 'signup', label: 'حساب جديد' }]} />
      <Field label="البريد الإلكتروني" ltr keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress"
             value={email} onChangeText={setEmail} />
      <Field label="كلمة المرور" ltr secureTextEntry autoCapitalize="none" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
             textContentType={mode === 'signin' ? 'password' : 'newPassword'} hint={mode === 'signup' ? '8 أحرف على الأقل' : undefined}
             value={password} onChangeText={setPassword} onSubmitEditing={submit} />
      {error && <Alert tone="danger">{error}</Alert>}
      {info && <Alert tone="success">{info}</Alert>}
      <Button title={mode === 'signin' ? 'دخول' : 'إنشاء الحساب'} loading={busy} disabled={!email || password.length < 8} onPress={submit}
              icon={mode === 'signin' ? <LogIn size={18} color={color.surface} /> : <UserPlus size={18} color={color.surface} />} />
      {mode === 'signin' && <Button title="نسيت كلمة المرور؟" variant="ghost" small onPress={() => void sendReset()} />}
      </>}
    </Stack>
  );
}

/** «المتابعة باستخدام Google» — Google's own white button style. */
function GoogleButton({ loading, onPress }: { loading: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={loading} accessibilityRole="button" accessibilityLabel="المتابعة باستخدام Google"
               style={({ pressed }) => ({ minHeight: 56, borderRadius: 12, borderWidth: 1.5, borderColor: '#DADCE0', elevation: 2, shadowColor: '#0F172A', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, backgroundColor: pressed ? '#F8F9FA' : '#fff',
                                          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 })}>
      {loading ? <ActivityIndicator color={color.primary} /> : (
        <Svg width={20} height={20} viewBox="0 0 48 48">
          <Path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
          <Path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17z" />
          <Path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z" />
          <Path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.2-8.5 2.2-6.2 0-11.5-4.1-13.4-9.8l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
        </Svg>
      )}
      <Text weight="semibold" style={{ color: '#1F1F1F', fontSize: 16 }}>المتابعة باستخدام Google</Text>
    </Pressable>
  );
}

/** Patient profile for the signed-in account — only the name is required. */
export function RegisterSelf({ onDone }: { onDone: () => void }) {
  const { session } = useAuth();
  const [form, setForm] = useState({ fullName: '', sex: '', birthDate: '', phone: iraqiLocal(session?.user.phone).replace(/\s/g, '') });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  // signed in with Google: start from the name on the Google account
  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      const n = (data.user?.user_metadata?.full_name ?? data.user?.user_metadata?.name) as string | undefined;
      if (n) setForm((f) => (f.fullName ? f : { ...f, fullName: n }));
    });
  }, []);

  const submit = async () => {
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
    <Stack>
      <Text variant="title">أكمل ملفك كمريض</Text>
      <Text variant="small" muted>الاسم فقط مطلوب. بقية البيانات اختيارية ويمكن إضافتها لاحقاً.</Text>
      <Field label="الاسم الكامل" value={form.fullName} error={errors.fullName} onChangeText={(v) => setForm({ ...form, fullName: v })} autoComplete="name" />
      <Stack gap={6}>
        <Text variant="label">الجنس <Text variant="label" muted>(اختياري)</Text></Text>
        <Row>
          <Chip label="أنثى" selected={form.sex === 'female'} onPress={() => setForm({ ...form, sex: form.sex === 'female' ? '' : 'female' })} />
          <Chip label="ذكر" selected={form.sex === 'male'} onPress={() => setForm({ ...form, sex: form.sex === 'male' ? '' : 'male' })} />
        </Row>
      </Stack>
      <BirthDateField optional value={form.birthDate} onChange={(v) => setForm({ ...form, birthDate: v })} />
      {errors.birthDate ? <Text variant="small" style={{ color: color.danger }}>{errors.birthDate}</Text> : null}
      <Field label="رقم الهاتف" optional ltr keyboardType="phone-pad" value={form.phone} error={errors.phone} autoComplete="tel"
             onChangeText={(v) => setForm({ ...form, phone: v })} hint="لا يُستخدم الهاتف لدمج الملفات تلقائياً." />
      {serverError && <Alert tone="danger">{serverError}</Alert>}
      <Button title="حفظ الملف" loading={busy} onPress={submit} />
    </Stack>
  );
}
