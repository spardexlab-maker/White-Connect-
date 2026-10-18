import { useCallback, useMemo, useState } from 'react';
import { Modal, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { CalendarDays, MapPin, Users } from 'lucide-react-native';
import { errorMessage, formatDateTime, formatMoney, type AppointmentStatus } from '@app/shared';
import { supabase } from '../../src/lib/supabase';
import { unwrap, useAsync } from '../../src/lib/useAsync';
import { useAuth } from '../../src/lib/auth';
import { SignInPrompt } from '../../src/components/SignInPrompt';
import { Alert, AppointmentBadge, Button, Card, Chip, EmptyState, ErrorState, Loading, Ltr, Row, Screen, Segmented, Stack, Text } from '../../src/components/ui';
import { color, radius, space } from '../../src/theme';

interface Appt {
  appointment_id: string; booking_number: string; status: AppointmentStatus; starts_at: string; ends_at: string; timezone: string;
  patient_name: string; facility_name: string; branch_name: string; practitioner_name: string | null;
  service_name: string; price_minor: number | null; currency: string; confirmation_deadline: string | null;
  cancellation_cutoff_minutes: number; status_reason: string | null;
}
const ACTIVE: AppointmentStatus[] = ['awaiting_confirmation', 'confirmed', 'checked_in'];
const reasons = ['تعارض مع موعد آخر', 'تحسّن الحالة', 'سأحجز وقتاً آخر', 'سبب آخر'];

export default function Appointments() {
  const { session } = useAuth();
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [cancelling, setCancelling] = useState<Appt | null>(null);
  const [reason, setReason] = useState(reasons[0]);
  const [busy, setBusy] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const list = useAsync(async () => (session ? ((await unwrap(supabase.rpc('my_appointments'))) as Appt[]) : []), [session?.user.id]);
  useFocusEffect(useCallback(() => { if (session) list.reload(); }, [session?.user.id])); // eslint-disable-line react-hooks/exhaustive-deps

  const [upcoming, past] = useMemo(() => {
    const now = Date.now();
    const rows = list.data ?? [];
    const isUpcoming = (r: Appt) => ACTIVE.includes(r.status) && new Date(r.ends_at).getTime() > now;
    return [rows.filter(isUpcoming).reverse(), rows.filter((r) => !isUpcoming(r))];
  }, [list.data]);

  if (!session) return <SignInPrompt />;
  const rows = tab === 'upcoming' ? upcoming : past;

  const doCancel = async () => {
    if (!cancelling) return;
    setBusy(true); setCancelError(null);
    const { error } = await supabase.rpc('change_appointment_status', { p_appointment_id: cancelling.appointment_id, p_to: 'cancelled', p_reason: reason });
    setBusy(false);
    if (error) { setCancelError(errorMessage(error)); return; }
    setCancelling(null); setNotice('تم إلغاء الموعد وتحرير الوقت'); list.reload();
  };

  return (
    <Screen refreshing={list.status === 'loading' && !!list.data} onRefresh={list.reload}>
      <Segmented value={tab} onChange={setTab} options={[{ id: 'upcoming', label: `القادمة (${upcoming.length})` }, { id: 'past', label: 'السابقة' }]} />
      {notice && <Alert tone="success">{notice}</Alert>}
      {list.status === 'loading' && !list.data && <Card><Loading /></Card>}
      {list.status === 'error' && <Card><ErrorState error={list.error} onRetry={list.reload} /></Card>}
      {list.data && rows.length === 0 && (
        <Card>
          <EmptyState icon={<CalendarDays size={28} color={color.mutedText} />} title={tab === 'upcoming' ? 'لا توجد مواعيد قادمة' : 'لا توجد مواعيد سابقة'}
                      action={tab === 'upcoming' ? <Button title="ابحث عن طبيب" onPress={() => router.navigate('/')} /> : undefined}>
            {tab === 'upcoming' ? 'احجز موعداً وسيظهر هنا مع حالته.' : undefined}
          </EmptyState>
        </Card>
      )}
      {rows.map((r) => {
        const canCancel = ['awaiting_confirmation', 'confirmed'].includes(r.status) && new Date(r.starts_at).getTime() > Date.now();
        const late = new Date(r.starts_at).getTime() - r.cancellation_cutoff_minutes * 60000 < Date.now();
        return (
          <Card key={r.appointment_id}>
            <Row between style={{ alignItems: 'flex-start' }}>
              <Text variant="title" style={{ flex: 1 }}>{r.practitioner_name ?? r.facility_name}</Text>
              <AppointmentBadge status={r.status} />
            </Row>
            <Stack gap={4}>
              <Text variant="small" weight="medium">{formatDateTime(r.starts_at, r.timezone)} · {r.service_name}</Text>
              <Row gap={4}><MapPin size={14} color={color.mutedText} /><Text variant="small" muted style={{ flex: 1 }}>{r.facility_name} — {r.branch_name}</Text></Row>
              <Row gap={4} style={{ alignItems: 'flex-start' }}><Users size={14} color={color.mutedText} />
                <Text variant="small" muted style={{ flex: 1 }}>{r.patient_name} · رقم الحجز <Ltr>{r.booking_number}</Ltr> · {formatMoney(r.price_minor, r.currency)}</Text>
              </Row>
              {r.status === 'awaiting_confirmation' && r.confirmation_deadline && (
                <Text variant="small" style={{ color: color.warningText }}>الوقت محجوز لك حتى تأكيد العيادة (المهلة حتى {formatDateTime(r.confirmation_deadline, r.timezone)})</Text>
              )}
              {r.status_reason && ['cancelled', 'rejected'].includes(r.status) && <Text variant="small" muted>السبب: {r.status_reason}</Text>}
            </Stack>
            {canCancel && (
              <Stack gap={4}>
                <Button title="إلغاء الموعد" variant="secondary" small onPress={() => { setCancelling(r); setCancelError(null); setNotice(null); }} />
                {late && <Text variant="small" muted>تجاوزت مهلة الإلغاء المجاني المحددة من العيادة.</Text>}
              </Stack>
            )}
          </Card>
        );
      })}

      <Modal visible={!!cancelling} transparent animationType="fade" onRequestClose={() => setCancelling(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(21,37,54,0.45)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: color.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: space[4], gap: space[3] }}>
            <Text variant="h3">إلغاء الموعد؟</Text>
            <Text variant="small">سيتم إلغاء موعد {cancelling?.practitioner_name ?? cancelling?.facility_name} وتحرير الوقت لمرضى آخرين. يبقى الموعد في سجلك كملغى.</Text>
            <Text variant="label">سبب الإلغاء</Text>
            <Row wrap>{reasons.map((x) => <Chip key={x} label={x} selected={reason === x} onPress={() => setReason(x)} />)}</Row>
            {cancelError && <Alert tone="danger">{cancelError}</Alert>}
            <Button title="تأكيد الإلغاء" variant="danger" loading={busy} onPress={doCancel} />
            <Button title="تراجع" variant="ghost" disabled={busy} onPress={() => setCancelling(null)} />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
