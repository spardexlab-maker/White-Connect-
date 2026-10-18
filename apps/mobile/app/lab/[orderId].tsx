import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AlertOctagon, FlaskConical } from 'lucide-react-native';
import { formatDateTime, labFlag, labStatus, type LabStatus } from '@app/shared';
import { supabase } from '../../src/lib/supabase';
import { unwrap, useAsync } from '../../src/lib/useAsync';
import type { LabDetail } from '../../src/lib/clinical';
import { Alert, Badge, Card, Divider, ErrorState, Loading, Ltr, Row, Screen, Stack, Text, type Tone } from '../../src/components/ui';
import { color, space } from '../../src/theme';

/** Values, units, ranges and flags exactly as entered by the lab — no automatic interpretation. */
export default function LabScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const d = useAsync(async () => (await unwrap(supabase.rpc('lab_order_detail', { p_order_id: orderId }))) as unknown as LabDetail, [orderId]);
  if (d.status === 'loading' && !d.data) return <Screen><Loading /></Screen>;
  if (d.status === 'error') return <Screen><Card><ErrorState error={d.error} onRetry={d.reload} /></Card></Screen>;
  const x = d.data!;
  const st = labStatus[x.order.status as LabStatus] ?? { label: x.order.status, tone: 'neutral' };

  return (
    <Screen refreshing={d.status === 'loading'} onRefresh={d.reload}>
      <Card>
        <Row between style={{ alignItems: 'flex-start' }}>
          <Row gap={space[2]} style={{ flex: 1 }}><FlaskConical size={18} color={color.accent} /><Text variant="title" style={{ flex: 1 }}>{x.lab}</Text></Row>
          <Badge label={st.label} tone={st.tone as Tone} />
        </Row>
        <Text variant="small" muted>طلب <Ltr>{x.order.order_number}</Ltr> · {x.patient.full_name}{x.ordering_doctor ? ` · الطبيب الطالب: ${x.ordering_doctor}` : ' · زيارة مباشرة للمختبر'}</Text>
      </Card>
      {x.items.map((it) => {
        const res = it.results.find((r) => r.status === 'released');
        return (
          <Card key={it.id}>
            <Row between><Text variant="title" ltr style={{ fontSize: 15, flex: 1 }}>{it.name}</Text>
              {res ? <Badge label="معتمدة" tone="success" /> : <Badge label="لم تُنشر بعد" tone="neutral" />}</Row>
            {res ? (
              <Stack gap={space[2]}>
                <Row gap={space[2]} wrap>
                  <Text variant="h3"><Ltr>{res.value_text ?? (res.value_numeric != null ? String(res.value_numeric) : '—')}</Ltr></Text>
                  {(res.unit ?? it.catalog.unit) && <Text variant="small" muted><Ltr>{res.unit ?? it.catalog.unit}</Ltr></Text>}
                  {res.lab_flag && (
                    <Badge label={labFlag[res.lab_flag] ?? res.lab_flag} tone={res.lab_flag === 'critical' ? 'danger' : 'warning'}
                           icon={res.lab_flag === 'critical' ? <AlertOctagon size={12} color={color.danger} /> : undefined} />
                  )}
                </Row>
                <Text variant="small" muted>المدى المرجعي (كما أدخله المختبر): <Ltr>{res.reference_range ?? it.catalog.reference_range_text ?? '—'}</Ltr></Text>
                {res.notes && <Text variant="small">ملاحظة المختبر: {res.notes}</Text>}
                {res.version_no > 1 && <Alert tone="info" title="نتيجة مصححة">{res.correction_reason ?? 'صحّح المختبر هذه النتيجة؛ النسخة السابقة محفوظة في السجل.'}</Alert>}
                {res.released_at && <Text variant="small" muted>نُشرت: {formatDateTime(res.released_at)}</Text>}
              </Stack>
            ) : <Text variant="small" muted>تظهر النتيجة هنا بعد مراجعتها واعتمادها من المختبر.</Text>}
          </Card>
        );
      })}
      <View style={{ gap: space[2] }}>
        <Divider />
        <Text variant="small" muted>العلامات (مرتفع/منخفض) يضعها المختبر ولا تُعد تشخيصاً. ناقش نتائجك مع طبيبك.</Text>
      </View>
    </Screen>
  );
}
