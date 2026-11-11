import { useEffect, useState } from 'react';
import { Alert as Confirm, Linking, Platform, Switch } from 'react-native';
import { Briefcase, LogOut, QrCode } from 'lucide-react-native';
import { errorMessage, iraqiLocal } from '@app/shared';
import { useAuth } from '../../src/lib/auth';
import { supabase, webUrl } from '../../src/lib/supabase';
import { useAsync } from '../../src/lib/useAsync';
import { disableReminders, enableReminders, remindersEnabled } from '../../src/lib/reminders';
import { reportLocalReminders } from '../../src/lib/push';
import { resyncDoses } from '../../src/lib/doseActions';
import { AuthForm, PhoneLink, RegisterSelf, useAuthHold } from '../../src/components/AuthForms';
import { PatientCard } from '../../src/components/PatientCard';
import { DeleteAccount, LegalLinks } from '../../src/components/DeleteAccount';
import { UpdateCheckRow } from '../../src/components/UpdatePrompt';
import { Alert, Button, Card, Loading, Ltr, Row, Screen, SectionTitle, Stack, Text } from '../../src/components/ui';
import { color } from '../../src/theme';

export default function Account() {
  const { session, access, refreshAccess, signOut, loading } = useAuth();
  const workspaces = useAsync(async () => {
    if (!session) return 0;
    const { data } = await supabase.rpc('my_workspaces');
    return Array.isArray(data) ? data.length : 0;
  }, [session?.user.id]);
  const holding = useAuthHold();   // the WhatsApp check mark plays before the signed-in page appears
  const [leaving, setLeaving] = useState(false);
  // one stray tap must not sign the person out (it also clears this phone's medicine reminders)
  const leave = () => {
    const go = async () => {
      setLeaving(true);
      try { await signOut(); } catch (e) { Confirm.alert('ما كدرنا نسجل الخروج', `${errorMessage(e)}\nتأكد من الإنترنت وحاول مرة ثانية.`); } finally { setLeaving(false); }
    };
    if (Platform.OS === 'web') { void go(); return; }
    Confirm.alert('تسجيل الخروج؟', 'تنحذف تذكيرات الدواء من هذا الهاتف، وترجع لما تسجل دخول مرة ثانية.', [
      { text: 'تراجع', style: 'cancel' }, { text: 'خروج', style: 'destructive', onPress: () => void go() },
    ]);
  };
  if (loading) return <Screen><Loading /></Screen>;
  if (!session || holding) {
    return (
      <Screen>
        <Card><AuthForm /></Card>
        <Text variant="small" muted>البحث والاطلاع على الأطباء متاح دون حساب. الحجوزات والرحلة الطبية تحتاج حساباً لحماية بياناتك.</Text>
        <Card><UpdateCheckRow /></Card>
        <LegalLinks />
      </Screen>
    );
  }

  const isStaff = !!access?.is_platform_admin || (workspaces.data ?? 0) > 0;
  return (
    <Screen refreshing={false} onRefresh={() => void refreshAccess()}>
      <Card>
        <Row between>
          <Stack gap={2} style={{ flex: 1 }}>
            <Text variant="label" muted>الحساب</Text>
            <Text variant="small" weight="medium"><Ltr>{session.user.email || iraqiLocal(session.user.phone)}</Ltr></Text>
          </Stack>
          <Button title="خروج" variant="ghost" small loading={leaving} icon={<LogOut size={16} color={color.primary} />} onPress={leave} />
        </Row>
      </Card>

      {!access && <Card><Loading /></Card>}
      {access && access.patient_ids.length === 0 && <Card><RegisterSelf onDone={() => void refreshAccess()} /></Card>}
      {access && access.patient_ids.length > 0 && <Card><PhoneLink /></Card>}
      {access && access.patient_ids.length > 0 && (
        <Stack>
          <SectionTitle action={<QrCode size={20} color={color.mutedText} />}>بطاقة التعريف</SectionTitle>
          {access.patient_ids.map((p) => <PatientCard key={p.patient_id} patientId={p.patient_id} relationship={p.relationship} />)}
        </Stack>
      )}

      <ReminderToggle />
      {Platform.OS === 'android' && <Card><UpdateCheckRow /></Card>}

      {isStaff && (
        <Card>
          <Text variant="title">مساحة العمل المهنية</Text>
          <Text variant="small" muted>أدوات الأطباء والاستقبال والصيدلية والمختبر تعمل من بوابة الويب (تدعم المصادقة الثنائية).</Text>
          <Button title="فتح بوابة المهنيين" variant="secondary" icon={<Briefcase size={16} color={color.primary} />} onPress={() => void Linking.openURL(`${webUrl}/login`)} />
        </Card>
      )}
      {!isStaff && <Card><DeleteAccount /></Card>}
      <LegalLinks />
    </Screen>
  );
}

function ReminderToggle() {
  const [on, setOn] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { void remindersEnabled().then(setOn); }, []);
  if (Platform.OS === 'web') return null;
  const toggle = async (v: boolean) => {
    setMsg(null);
    if (!v) { await disableReminders(); setOn(false); void reportLocalReminders(); return; }
    const res = await enableReminders();
    setOn(res === 'granted');
    if (res === 'granted') { await resyncDoses(); void reportLocalReminders(); }
    if (res === 'denied') setMsg('لم يُمنح إذن الإشعارات. يمكنك تفعيله من إعدادات الهاتف.');
  };
  return (
    <Card>
      <Row between>
        <Stack gap={2} style={{ flex: 1 }}>
          <Text variant="title">تذكيرات الدواء على هذا الهاتف</Text>
          <Text variant="small" muted>تشتغل تلقائياً بعد السماح بالإشعارات، وترن حتى بدون إنترنت. تُحذف التذكيرات عند الخروج.</Text>
        </Stack>
        <Switch value={on} onValueChange={(v) => void toggle(v)} trackColor={{ true: color.accent, false: color.borderStrong }} accessibilityLabel="تذكيرات الدواء" />
      </Row>
      {msg && <Alert tone="warning">{msg}</Alert>}
    </Card>
  );
}
