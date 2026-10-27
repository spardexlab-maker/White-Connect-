import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CalendarClock, ChevronLeft, FlaskConical, HeartPulse, Pill, Stethoscope } from 'lucide-react-native';
import { patientEncounterStatus, formatDate, formatDateTime, patientLabStatus, type EncounterStatus, type LabStatus } from '@app/shared';
import { supabase } from '../../src/lib/supabase';
import { unwrap, useAsync } from '../../src/lib/useAsync';
import { Alert, Badge, Card, Divider, ErrorState, Loading, Ltr, Row, Screen, Stack, Summary, Text } from '../../src/components/ui';
import { color, radius, space } from '../../src/theme';

interface Visit {
  id: string; status: EncounterStatus; started_at: string; ended_at: string | null; finished: boolean;
  patient_name: string; facility: string; doctor: string; specialty: string | null;
  reason: string | null; diagnosis: string | null; plan: string | null; follow_up: string | null;
  vitals: Partial<Record<'bp_sys' | 'bp_dia' | 'pulse' | 'temp_c' | 'spo2' | 'weight_kg' | 'height_cm', number>>;
  prescriptions: { id: string; rx_number: string; status: string }[];
  lab_orders: { id: string; order_number: string; status: LabStatus; lab: string | null; tests: string[] | null }[];
  next_visit: string | null;
}

/** The patient's copy of one doctor visit: diagnosis, advice, vitals, and what came out of it. */
export default function VisitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const v = useAsync(async () => (await unwrap(supabase.rpc('patient_visit', { p_encounter_id: id }))) as unknown as Visit, [id]);
  if (v.status === 'loading' && !v.data) return <Screen><Loading /></Screen>;
  if (v.status === 'error') return <Screen><Card><ErrorState error={v.error} onRetry={v.reload} /></Card></Screen>;
  const d = v.data!;
  const vt = d.vitals ?? {};
  const vitals: [string, string][] = [
    ...(vt.bp_sys && vt.bp_dia ? [['الضغط', `${vt.bp_sys}/${vt.bp_dia}`] as [string, string]] : []),
    ...(vt.pulse ? [['النبض', `${vt.pulse}`] as [string, string]] : []),
    ...(vt.temp_c ? [['الحرارة', `${vt.temp_c}°`] as [string, string]] : []),
    ...(vt.spo2 ? [['الأكسجين', `${vt.spo2}%`] as [string, string]] : []),
    ...(vt.weight_kg ? [['الوزن (كغ)', `${vt.weight_kg}`] as [string, string]] : []),
  ];

  return (
    <Screen refreshing={v.status === 'loading'} onRefresh={v.reload}>
      <Card>
        <Row between style={{ alignItems: 'flex-start' }}>
          <Row gap={space[2]} style={{ flex: 1 }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: color.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Stethoscope size={20} color={color.accent} />
            </View>
            <Stack gap={0} style={{ flex: 1 }}>
              <Text variant="title">{d.doctor}</Text>
              <Text variant="small" muted>{[d.specialty, d.facility].filter(Boolean).join(' · ')}</Text>
            </Stack>
          </Row>
          <Badge {...patientEncounterStatus[d.status]} />
        </Row>
        <Summary rows={[['التاريخ', formatDateTime(d.started_at)], ['المريض', d.patient_name]]} />
      </Card>

      {!d.finished && <Alert tone="info">الزيارة ما خلصت بعد. التشخيص والتعليمات تظهر هنا أول ما يكمّل الطبيب الجلسة.</Alert>}

      {d.finished && (
        <Card>
          {d.reason && <Block label="سبب الزيارة" text={d.reason} />}
          <View style={{ backgroundColor: color.accentSoft, borderRadius: radius.md, padding: space[3], gap: 4 }}>
            <Text variant="label" style={{ color: color.accent }}>التشخيص</Text>
            <Text variant="title">{d.diagnosis?.trim() || 'لم يُسجَّل تشخيص'}</Text>
          </View>
          {d.plan && <Block label="تعليمات الطبيب" text={d.plan} />}
          {d.follow_up && <Block label="المتابعة" text={d.follow_up} />}
          {d.next_visit && (
            <Row gap={space[2]}><CalendarClock size={16} color={color.accent} /><Text variant="small" weight="semibold">موعدك الجاي: {formatDateTime(d.next_visit)}</Text></Row>
          )}
        </Card>
      )}

      {d.finished && vitals.length > 0 && (
        <Card>
          <Row gap={space[2]}><HeartPulse size={18} color={color.accent} /><Text variant="title">القياسات</Text></Row>
          <Row wrap gap={space[2]}>
            {vitals.map(([k, val]) => (
              <View key={k} style={{ minWidth: 92, flexGrow: 1, backgroundColor: color.surfaceSunken, borderRadius: radius.md, padding: space[3], gap: 2 }}>
                <Text variant="small" muted>{k}</Text>
                <Text variant="title" ltr>{val}</Text>
              </View>
            ))}
          </Row>
        </Card>
      )}

      {d.prescriptions.length > 0 && (
        <Card>
          <Row gap={space[2]}><Pill size={18} color={color.accent} /><Text variant="title">الوصفات</Text></Row>
          {d.prescriptions.map((r, i) => (
            <View key={r.id}>
              {i > 0 && <Divider />}
              <Link onPress={() => router.push(`/rx/${r.id}`)} label={<>وصفة <Ltr>{r.rx_number}</Ltr></>}
                    badge={<Badge label={r.status === 'active' ? 'معتمدة' : 'ملغاة'} tone={r.status === 'active' ? 'success' : 'neutral'} />} />
            </View>
          ))}
        </Card>
      )}

      {d.lab_orders.length > 0 && (
        <Card>
          <Row gap={space[2]}><FlaskConical size={18} color={color.accent} /><Text variant="title">التحاليل ونتائجها</Text></Row>
          {d.lab_orders.map((o, i) => (
            <View key={o.id}>
              {i > 0 && <Divider />}
              <Link onPress={() => router.push(`/lab/${o.id}`)} label={(o.tests ?? []).join('، ') || `طلب ${o.order_number}`}
                    sub={o.lab ?? 'أي مختبر على أبيض'} badge={<Badge {...patientLabStatus[o.status]} />} />
            </View>
          ))}
        </Card>
      )}

      <Text variant="small" muted>هذه نسخة لك من زيارتك بتاريخ {formatDate(d.started_at)}. لأي سؤال عن التشخيص أو العلاج، راجع طبيبك.</Text>
    </Screen>
  );
}

function Block({ label, text }: { label: string; text: string }) {
  return (
    <Stack gap={2}>
      <Text variant="label" muted>{label}</Text>
      <Text>{text}</Text>
    </Stack>
  );
}

function Link({ onPress, label, sub, badge }: { onPress: () => void; label: ReactNode; sub?: string; badge: ReactNode }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={{ paddingVertical: space[2], gap: 2 }}>
      <Row between>
        <Text variant="title" style={{ fontSize: 15, flex: 1 }}>{label}</Text>
        <Row gap={4}>{badge}<ChevronLeft size={16} color={color.accent} /></Row>
      </Row>
      {sub && <Text variant="small" muted>{sub}</Text>}
    </Pressable>
  );
}
