import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { LogIn, UserPlus } from 'lucide-react-native';
import { errorMessage, fieldErrors, patientRegistrationSchema } from '@app/shared';
import { supabase } from '../lib/supabase';
import { signInWithGoogle } from '../lib/googleAuth';
import { BirthDateField } from './BirthDateField';
import { Alert, Button, Chip, Field, Row, Segmented, Stack, Text } from './ui';
import { color } from '../theme';

/** Email + password sign-in / sign-up (SMS OTP needs a paid provider — not enabled yet). */
export function AuthForm() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);

  const submit = async () => {
    setBusy(true); setError(null); setInfo(null);
    const creds = { email: email.trim(), password };
    const res = mode === 'signin' ? await supabase.auth.signInWithPassword(creds) : await supabase.auth.signUp(creds);
    setBusy(false);
    if (res.error) { setError(errorMessage(res.error)); return; }
    if (mode === 'signup' && !res.data.session) setInfo('تم إنشاء الحساب. افتح رسالة التأكيد في بريدك ثم سجّل الدخول.');
  };

  const google = async () => {
    setGoogleBusy(true); setError(null); setInfo(null);
    try { await signInWithGoogle(); } catch (e) { setError(errorMessage(e)); } finally { setGoogleBusy(false); }
  };

  return (
    <Stack>
      <GoogleButton loading={googleBusy} onPress={google} />
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
      <Text variant="small" muted>الدخول برقم الهاتف ورمز SMS يتطلب ربط مزود رسائل؛ لم يُفعّل في هذه البيئة بعد.</Text>
    </Stack>
  );
}

/** «المتابعة باستخدام Google» — Google's own white button style. */
function GoogleButton({ loading, onPress }: { loading: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={loading} accessibilityRole="button" accessibilityLabel="المتابعة باستخدام Google"
               style={({ pressed }) => ({ minHeight: 50, borderRadius: 12, borderWidth: 1, borderColor: '#DADCE0', backgroundColor: pressed ? '#F8F9FA' : '#fff',
                                          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 })}>
      {loading ? <ActivityIndicator color={color.primary} /> : (
        <Svg width={20} height={20} viewBox="0 0 48 48">
          <Path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
          <Path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17z" />
          <Path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z" />
          <Path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.2-8.5 2.2-6.2 0-11.5-4.1-13.4-9.8l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
        </Svg>
      )}
      <Text weight="semibold" style={{ color: '#1F1F1F' }}>المتابعة باستخدام Google</Text>
    </Pressable>
  );
}

/** Patient profile for the signed-in account — only the name is required. */
export function RegisterSelf({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({ fullName: '', sex: '', birthDate: '', phone: '' });
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
