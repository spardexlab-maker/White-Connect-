import { Share } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Pill, Share2 } from 'lucide-react-native';
import { formatDateTime } from '@app/shared';
import { supabase, webUrl } from '../../src/lib/supabase';
import { unwrap, useAsync } from '../../src/lib/useAsync';
import { itemLine, type RxDoc } from '../../src/lib/clinical';
import { ReminderSetup } from '../../src/components/ReminderSetup';
import { Alert, Badge, Button, Card, Divider, ErrorState, Loading, Ltr, Row, Screen, Stack, Summary, Text } from '../../src/components/ui';
import { color, space } from '../../src/theme';

/** The patient's copy of an approved prescription (can be taken to any pharmacy). */
export default function RxScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const doc = useAsync(async () => (await unwrap(supabase.rpc('prescription_document', { p_prescription_id: id }))) as unknown as RxDoc, [id]);
  if (doc.status === 'loading' && !doc.data) return <Screen><Loading /></Screen>;
  if (doc.status === 'error') return <Screen><Card><ErrorState error={doc.error} onRetry={doc.reload} /></Card></Screen>;
  const d = doc.data!;
  const verifyUrl = d.verify_token ? `${webUrl}/verify/rx?token=${d.verify_token}` : null;
  const age = d.patient.birth_year ? new Date().getFullYear() - d.patient.birth_year : null;

  return (
    <Screen refreshing={doc.status === 'loading'} onRefresh={doc.reload}>
      {d.status === 'cancelled' && <Alert tone="danger">هذه الوصفة ملغاة من الطبيب ولا يجوز صرفها.</Alert>}
      <Card>
        <Row between>
          <Text variant="title">وصفة <Ltr>{d.rx_number}</Ltr></Text>
          <Badge label={d.version_no > 1 ? `إصدار ${d.version_no}` : 'معتمدة'} tone={d.status === 'cancelled' ? 'neutral' : 'success'} />
        </Row>
        <Summary rows={[
          ['الطبيب', [d.practitioner.title, d.practitioner.full_name].filter(Boolean).join(' ')],
          ['الجهة', `${d.facility.name} — ${d.facility.branch}`],
          ['المريض', `${d.patient.full_name}${age != null ? ` · ${age} سنة` : ''}`],
          ['التاريخ', d.approved_at ? formatDateTime(d.approved_at) : '—'],
        ]} />
        <Divider />
        <Stack gap={space[3]}>
          {d.items.map((i) => (
            <Stack key={i.line_no} gap={2}>
              <Row gap={space[2]}><Pill size={16} color={color.accent} /><Text variant="title" ltr style={{ fontSize: 15, flex: 1 }}>{i.display_name}</Text></Row>
              <Text variant="small">{itemLine(i) || '—'}</Text>
              {i.quantity != null && <Text variant="small" muted>الكمية: {Number(i.quantity)} {i.quantity_unit ?? ''}</Text>}
              {i.instructions && <Text variant="small" muted>تعليمات: {i.instructions}</Text>}
            </Stack>
          ))}
        </Stack>
        {verifyUrl && <Button title="مشاركة رابط التحقق" variant="secondary" small icon={<Share2 size={16} color={color.primary} />}
                              onPress={() => void Share.share({ message: `وصفة ${d.rx_number} — التحقق: ${verifyUrl}` })} />}
      </Card>
      <Text variant="small" muted>يمكنك إظهار هذه الوصفة في أي صيدلية. لا تغيّر الجرعات دون استشارة الطبيب.</Text>

      {d.status === 'active' && (
        <Card>
          <Text variant="title">بدأت الاستخدام؟ فعّل التذكيرات</Text>
          <Text variant="small" muted>إذا صُرف الدواء من صيدلية خارج المنصة، أكّد بدء الاستخدام واختر أوقاتك.</Text>
          {d.items.map((i) => <ReminderSetup key={i.line_no} prescriptionId={id} lineNo={i.line_no} displayName={i.display_name}
                                             frequencyText={i.frequency_text} asNeeded={i.as_needed} durationDays={i.duration_days} />)}
          <Button title="عرض خطة الدواء" variant="ghost" onPress={() => router.push('/meds')} />
        </Card>
      )}
    </Screen>
  );
}
