import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { CalendarCheck2, ChevronLeft, FlaskConical, Pill, Route, Stethoscope } from 'lucide-react-native';
import { appointmentStatus, encounterStatus, formatDate, formatTime, labStatus, type AppointmentStatus, type EncounterStatus, type LabStatus } from '@app/shared';
import { supabase } from '../../src/lib/supabase';
import { unwrap, useAsync } from '../../src/lib/useAsync';
import { useAuth } from '../../src/lib/auth';
import { SignInPrompt } from '../../src/components/SignInPrompt';
import { Alert, Badge, Button, Card, Chip, EmptyState, ErrorState, Loading, Row, Screen, Stack, Text, type Tone } from '../../src/components/ui';
import { color, space } from '../../src/theme';

interface J { event_type: 'visit' | 'prescription' | 'lab'; occurred_at: string; ref_id: string; encounter_id: string | null; patient_name: string;
  facility_name: string; practitioner_name: string | null; status: string; title: string; corrected: boolean }
interface A { appointment_id: string; status: AppointmentStatus; starts_at: string; facility_name: string; practitioner_name: string | null; service_name: string; patient_name: string }
type Filter = 'all' | 'visits' | 'prescriptions' | 'labs';
type Kind = 'appointment' | J['event_type'];
interface Ev { kind: Kind; at: string; key: string; title: string; who: string; where: string; patient: string; badge: { label: string; tone: Tone }; link?: string; corrected?: boolean }

const icons: Record<Kind, (c: string) => ReactNode> = {
  appointment: (c) => <CalendarCheck2 size={16} color={c} />, visit: (c) => <Stethoscope size={16} color={c} />,
  prescription: (c) => <Pill size={16} color={c} />, lab: (c) => <FlaskConical size={16} color={c} />,
};

/** One chronological journey of approved/released events (§8, §23). */
export default function Journey() {
  const { session } = useAuth();
  const [filter, setFilter] = useState<Filter>('all');
  const data = useAsync(async () => {
    if (!session) return { j: [] as J[], a: [] as A[] };
    const [j, a] = await Promise.all([unwrap(supabase.rpc('patient_journey')), unwrap(supabase.rpc('my_appointments'))]);
    return { j: j as J[], a: a as A[] };
  }, [session?.user.id]);
  useFocusEffect(useCallback(() => { if (session) data.reload(); }, [session?.user.id])); // eslint-disable-line react-hooks/exhaustive-deps

  const events = useMemo<Ev[]>(() => {
    if (!data.data) return [];
    const out: Ev[] = data.data.a.filter((x) => !['expired', 'fulfilled'].includes(x.status)).map((x) => ({
      kind: 'appointment', at: x.starts_at, key: `a${x.appointment_id}`, title: `موعد — ${x.service_name}`, who: x.practitioner_name ?? x.facility_name,
      where: x.facility_name, patient: x.patient_name, badge: appointmentStatus[x.status], link: '/appointments' }));
    for (const e of data.data.j) {
      out.push({ kind: e.event_type, at: e.occurred_at, key: `${e.event_type}${e.ref_id}`, title: e.title, who: e.practitioner_name ?? '', where: e.facility_name,
        patient: e.patient_name, corrected: e.corrected,
        badge: e.event_type === 'visit' ? encounterStatus[e.status as EncounterStatus]
          : e.event_type === 'lab' ? (e.status === 'released' ? { label: 'نتائج معتمدة', tone: 'success' } : labStatus[e.status as LabStatus])
          : e.status === 'active' ? { label: 'معتمدة', tone: 'success' } : { label: 'ملغاة', tone: 'neutral' },
        link: e.event_type === 'prescription' ? `/rx/${e.ref_id}` : e.event_type === 'lab' ? `/lab/${e.ref_id}` : undefined });
    }
    return out.sort((x, y) => y.at.localeCompare(x.at)).filter((e) =>
      filter === 'all' || (filter === 'visits' && (e.kind === 'visit' || e.kind === 'appointment')) || (filter === 'prescriptions' && e.kind === 'prescription') || (filter === 'labs' && e.kind === 'lab'));
  }, [data.data, filter]);

  if (!session) return <SignInPrompt />;
  let lastDate = '';

  return (
    <Screen refreshing={data.status === 'loading' && !!data.data} onRefresh={data.reload}>
      <Button title="خطة الدواء والتذكيرات" variant="secondary" icon={<Pill size={16} color={color.primary} />} onPress={() => router.push('/meds')} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space[2] }}>
        {([['all', 'الكل'], ['visits', 'الزيارات'], ['prescriptions', 'الوصفات'], ['labs', 'التحاليل']] as [Filter, string][]).map(([v, l]) =>
          <Chip key={v} label={l} selected={filter === v} onPress={() => setFilter(v)} />)}
      </ScrollView>
      {data.status === 'loading' && !data.data && <Card><Loading /></Card>}
      {data.status === 'error' && <Card><ErrorState error={data.error} onRetry={data.reload} /></Card>}
      {data.data && events.length === 0 && (
        <Card><EmptyState icon={<Route size={28} color={color.mutedText} />} title="لا توجد أحداث بعد">بعد أول حجز أو زيارة تتجمع الأحداث هنا بترتيب زمني.</EmptyState></Card>
      )}
      {events.map((e) => {
        const d = formatDate(e.at); const showDate = d !== lastDate; lastDate = d;
        const body = (
          <Card style={{ padding: space[3], gap: space[1] }}>
            <Row between style={{ alignItems: 'flex-start' }}>
              <Row gap={space[2]} style={{ flex: 1 }}>
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: color.accentSoft, alignItems: 'center', justifyContent: 'center' }}>{icons[e.kind](color.accent)}</View>
                <Text variant="title" style={{ fontSize: 15, flex: 1 }}>{e.title}</Text>
              </Row>
              <Row gap={4}>{e.corrected && <Badge label="مصححة" tone="info" />}<Badge label={e.badge.label} tone={e.badge.tone} /></Row>
            </Row>
            <Text variant="small" muted>{[e.who, e.where].filter(Boolean).join(' · ')} · {formatTime(e.at)} · {e.patient}</Text>
            {e.link && <Row gap={2}><Text variant="small" weight="semibold" style={{ color: color.accent }}>التفاصيل</Text><ChevronLeft size={14} color={color.accent} /></Row>}
          </Card>
        );
        return (
          <Stack key={e.key} gap={space[1]}>
            {showDate && <Text variant="label" muted>{d}</Text>}
            {e.link ? <Pressable accessibilityRole="link" accessibilityLabel={`${e.title} — التفاصيل`} onPress={() => router.push(e.link!)}>{body}</Pressable> : body}
          </Stack>
        );
      })}
      <Alert tone="info" title="عن هذه الصفحة">تعرض الرحلة ما اعتمده المهنيون الصحيون: الوصفات المعتمدة والنتائج المنشورة. الملاحظات الداخلية والمسودات لا تُنشر لك تلقائياً.</Alert>
    </Screen>
  );
}
