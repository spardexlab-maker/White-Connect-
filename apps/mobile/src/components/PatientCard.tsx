import { useState } from 'react';
import { Alert as RNAlert, Platform, View } from 'react-native';
import { router } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { KeyRound, Maximize2, RefreshCw } from 'lucide-react-native';
import { errorMessage } from '@app/shared';
import { supabase } from '../lib/supabase';
import { unwrap, useAsync } from '../lib/useAsync';
import { Alert, Button, Card, ErrorState, Loading, Ltr, Row, Stack, Text } from './ui';
import { color, radius, space } from '../theme';

export interface PatientCardData { patient_id: string; public_code: string; full_name: string; qr_token: string }

export function usePatientCard(patientId: string) {
  return useAsync(async () => (await unwrap(supabase.rpc('my_patient_card', { p_patient_id: patientId }))) as unknown as PatientCardData, [patientId]);
}

/** The QR carries ONLY the random token — no name, phone or health data. */
export function QrBlock({ token, code, size }: { token: string; code: string; size: number }) {
  return (
    <View style={{ alignItems: 'center', gap: space[2] }}>
      <View style={{ padding: space[3], backgroundColor: color.surface, borderRadius: radius.md, borderWidth: 1, borderColor: color.border }}
            accessible accessibilityRole="image" accessibilityLabel="رمز QR للتعريف في العيادة">
        <QRCode value={token} size={size} color={color.text} backgroundColor={color.surface} ecl="M" />
      </View>
      <Text variant="h3" style={{ textAlign: 'center' }}><Ltr>{code}</Ltr></Text>
    </View>
  );
}

function confirm(title: string, message: string, ok: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n${message}`));
  return new Promise((resolve) => RNAlert.alert(title, message, [
    { text: 'تراجع', style: 'cancel', onPress: () => resolve(false) },
    { text: ok, style: 'destructive', onPress: () => resolve(true) },
  ]));
}

export function PatientCard({ patientId, relationship }: { patientId: string; relationship: 'self' | 'guardian' }) {
  const card = usePatientCard(patientId);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  const rotate = async () => {
    if (!(await confirm('تغيير رمز QR؟', 'سيتوقف الرمز الحالي (وأي بطاقة مطبوعة به) عن العمل فوراً.', 'إصدار رمز جديد'))) return;
    const { error } = await supabase.rpc('rotate_patient_qr', { p_patient_id: patientId });
    if (error) { setMessage({ tone: 'danger', text: errorMessage(error) }); return; }
    setMessage({ tone: 'success', text: 'تم إصدار رمز جديد وإبطال القديم' });
    card.reload();
  };

  const makeLinkCode = async () => {
    const { data, error } = await supabase.rpc('create_account_link_code');
    if (error) { setMessage({ tone: 'danger', text: errorMessage(error) }); return; }
    setLinkCode(data as string);
  };

  if (card.status === 'loading' && !card.data) return <Card><Loading /></Card>;
  if (card.status === 'error') return <Card><ErrorState error={card.error} onRetry={card.reload} /></Card>;
  const c = card.data!;

  return (
    <Card>
      <Row between>
        <Text variant="title">{c.full_name}{relationship === 'guardian' ? ' (تابع)' : ''}</Text>
      </Row>
      <QrBlock token={c.qr_token} code={c.public_code} size={180} />
      <Text variant="small" muted style={{ textAlign: 'center' }}>أظهر هذه البطاقة في الاستقبال للتعريف. الرمز وسيلة تعريف فقط ولا يمنح أحداً إذناً بقراءة سجلك.</Text>
      <Stack gap={space[2]}>
        <Button title="عرض كبير للمسح" variant="secondary" icon={<Maximize2 size={16} color={color.primary} />} onPress={() => router.push(`/card/${patientId}`)} />
        <Row>
          <View style={{ flex: 1 }}><Button title="تغيير الرمز" variant="ghost" small icon={<RefreshCw size={16} color={color.primary} />} onPress={rotate} /></View>
          {relationship === 'self' && <View style={{ flex: 1 }}><Button title="رمز ربط سجل العيادة" variant="ghost" small icon={<KeyRound size={16} color={color.primary} />} onPress={makeLinkCode} /></View>}
        </Row>
      </Stack>
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      {linkCode && (
        <Alert tone="info" title="رمز الربط (صالح 15 دقيقة)">
          <Text variant="h3"><Ltr>{linkCode}</Ltr></Text>
          <Text variant="small">أعطِ هذا الرمز لموظف الاستقبال بعد التحقق من هويتك ليتم ربط سجلك القديم في العيادة بحسابك مع حفظ التاريخ.</Text>
        </Alert>
      )}
    </Card>
  );
}
