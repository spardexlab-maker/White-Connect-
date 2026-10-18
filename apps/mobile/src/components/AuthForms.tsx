import { useState } from 'react';
import { LogIn, UserPlus } from 'lucide-react-native';
import { errorMessage, fieldErrors, patientRegistrationSchema } from '@app/shared';
import { supabase } from '../lib/supabase';
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

  const submit = async () => {
    setBusy(true); setError(null); setInfo(null);
    const creds = { email: email.trim(), password };
    const res = mode === 'signin' ? await supabase.auth.signInWithPassword(creds) : await supabase.auth.signUp(creds);
    setBusy(false);
    if (res.error) { setError(errorMessage(res.error)); return; }
    if (mode === 'signup' && !res.data.session) setInfo('تم إنشاء الحساب. افتح رسالة التأكيد في بريدك ثم سجّل الدخول.');
  };

  return (
    <Stack>
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

/** Patient profile for the signed-in account — only the name is required. */
export function RegisterSelf({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({ fullName: '', sex: '', birthDate: '', phone: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

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
      <Field label="تاريخ الميلاد" optional ltr placeholder="YYYY-MM-DD" value={form.birthDate} error={errors.birthDate} keyboardType="numbers-and-punctuation"
             onChangeText={(v) => setForm({ ...form, birthDate: v })} />
      <Field label="رقم الهاتف" optional ltr keyboardType="phone-pad" value={form.phone} error={errors.phone} autoComplete="tel"
             onChangeText={(v) => setForm({ ...form, phone: v })} hint="لا يُستخدم الهاتف لدمج الملفات تلقائياً." />
      {serverError && <Alert tone="danger">{serverError}</Alert>}
      <Button title="حفظ الملف" loading={busy} onPress={submit} />
    </Stack>
  );
}
