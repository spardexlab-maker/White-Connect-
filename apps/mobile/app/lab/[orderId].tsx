import { useState } from 'react';
import { Linking, View } from 'react-native';
import { labReportPdf } from '../../src/lib/labPdf';
import { useLocalSearchParams } from 'expo-router';
import { AlertOctagon, FileText, FlaskConical, Printer, Share2 } from 'lucide-react-native';
import { errorMessage, formatDateTime, labFlag, labState, labStateColor, labStateLabel, patientLabStatus, type LabStatus } from '@app/shared';
import { supabase } from '../../src/lib/supabase';
import { unwrap, useAsync } from '../../src/lib/useAsync';
import type { LabDetail } from '../../src/lib/clinical';
import { Alert, Badge, Button, Card, Divider, ErrorState, Loading, Ltr, Row, Screen, Stack, Text, type Tone } from '../../src/components/ui';
import { color, space } from '../../src/theme';

/** Values, units, ranges and flags exactly as entered by the lab — no automatic interpretation. */
export default function LabScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const d = useAsync(async () => (await unwrap(supabase.rpc('lab_order_detail', { p_order_id: orderId }))) as unknown as LabDetail, [orderId]);
  // result files (PDF/image) uploaded by the lab — readable once the results are released
  const files = useAsync(async () => ((await unwrap(supabase.rpc('list_attachments', { p_kind: 'lab_result', p_ref_id: orderId }))) ?? []) as
    { id: string; file_name: string; status: string }[], [orderId]);
  const [pdfBusy, setPdfBusy] = useState<'print' | 'share' | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  // the lab report as a PDF: print / save from the system dialog, or share the file
  const pdf = async (mode: 'print' | 'share') => {
    setPdfBusy(mode); setPdfError(null);
    try { await labReportPdf(orderId, mode); } catch (e) { setPdfError(errorMessage(e)); }
    setPdfBusy(null);
  };
  const openFile = async (id: string) => {
    const { data } = await supabase.storage.from('clinical-files').createSignedUrl(`files/${id}`, 60);
    if (data?.signedUrl) void Linking.openURL(data.signedUrl);
  };
  if (d.status === 'loading' && !d.data) return <Screen><Loading /></Screen>;
  if (d.status === 'error') return <Screen><Card><ErrorState error={d.error} onRetry={d.reload} /></Card></Screen>;
  const x = d.data!;
  const st = patientLabStatus[x.order.status as LabStatus] ?? { label: x.order.status, tone: 'neutral' };

  return (
    <Screen refreshing={d.status === 'loading'} onRefresh={() => { d.reload(); files.reload(); }}>
      <Card>
        <Row between style={{ alignItems: 'flex-start' }}>
          <Row gap={space[2]} style={{ flex: 1 }}><FlaskConical size={18} color={color.accent} /><Text variant="title" style={{ flex: 1 }}>{x.lab}</Text></Row>
          <Badge label={st.label} tone={st.tone as Tone} />
        </Row>
        {x.items.some((i) => i.status === 'released') && (
          <Row gap={space[2]} wrap style={{ marginVertical: space[2] }}>
            <Button title="تقرير PDF / طباعة" small icon={<Printer size={14} color={color.surface} />} loading={pdfBusy === 'print'} onPress={() => void pdf('print')} />
            <Button title="مشاركة PDF" small variant="secondary" icon={<Share2 size={14} color={color.primary} />} loading={pdfBusy === 'share'} onPress={() => void pdf('share')} />
          </Row>
        )}
        {pdfError && <Alert tone="danger">{pdfError}</Alert>}
        <Text variant="small" muted>طلب <Ltr>{x.order.order_number}</Ltr> · {x.patient.full_name}{x.ordering_doctor ? ` · الطبيب الطالب: ${x.ordering_doctor}` : ' · زيارة مباشرة للمختبر'}</Text>
      </Card>
      {x.items.map((it) => {
        const res = it.results.find((r) => r.status === 'released');
        const ls = res ? labState({ value_numeric: res.value_numeric, reference_range: res.reference_range ?? it.catalog.reference_range_text, flag: res.lab_flag }) : null;
        return (
          <Card key={it.id}>
            <Row between><Text variant="title" ltr style={{ fontSize: 15, flex: 1 }}>{it.name}</Text>
              {res ? (ls && (
                <View style={{ backgroundColor: ls === 'normal' ? '#E8EFFE' : '#FDECEC', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 }}>
                  <Text variant="small" style={{ color: labStateColor[ls], fontWeight: '700' }}>{labStateLabel[ls]}</Text>
                </View>
              )) : <Badge label="قيد التحضير" tone="neutral" />}</Row>
            {res ? (
              <Stack gap={space[2]}>
                <Row gap={space[2]} wrap>
                  <Text variant="h3" style={ls ? { color: labStateColor[ls] } : undefined}><Ltr>{res.value_text ?? (res.value_numeric != null ? String(res.value_numeric) : '—')}</Ltr></Text>
                  {(res.unit ?? it.catalog.unit) && <Text variant="small" muted><Ltr>{res.unit ?? it.catalog.unit}</Ltr></Text>}
                  {res.lab_flag === 'critical' && (
                    <Badge label={labFlag[res.lab_flag]} tone="danger" icon={<AlertOctagon size={12} color={color.danger} />} />
                  )}
                </Row>
                <Text variant="small" muted>المدى المرجعي (كما أدخله المختبر): <Ltr>{res.reference_range ?? it.catalog.reference_range_text ?? '—'}</Ltr></Text>
                {res.notes && <Text variant="small">ملاحظة المختبر: {res.notes}</Text>}
                {res.version_no > 1 && <Alert tone="info" title="نتيجة مصححة">{res.correction_reason ?? 'صحّح المختبر هذه النتيجة؛ النسخة السابقة محفوظة في السجل.'}</Alert>}
                {res.released_at && <Text variant="small" muted>صدرت: {formatDateTime(res.released_at)}</Text>}
              </Stack>
            ) : <Text variant="small" muted>تظهر النتيجة هنا حال جهوزها من المختبر.</Text>}
          </Card>
        );
      })}
      {files.data?.some((f) => f.status === 'available') && (
        <Card>
          <Text variant="title">ملفات النتيجة</Text>
          {files.data.filter((f) => f.status === 'available').map((f) => (
            <Row key={f.id} between gap={space[2]}>
              <Row gap={space[2]} style={{ flex: 1 }}><FileText size={16} color={color.accent} /><Text variant="small" style={{ flex: 1 }}>{f.file_name}</Text></Row>
              <Button title="فتح" small variant="secondary" onPress={() => void openFile(f.id)} />
            </Row>
          ))}
        </Card>
      )}
      <View style={{ gap: space[2] }}>
        <Divider />
        <Text variant="small" muted>العلامات (مرتفع/منخفض) يضعها المختبر ولا تُعد تشخيصاً. ناقش نتائجك مع طبيبك.</Text>
      </View>
    </Screen>
  );
}
