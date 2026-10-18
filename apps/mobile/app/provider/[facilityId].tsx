import { Linking, View } from 'react-native';
import { Stack as RouterStack, router, useLocalSearchParams } from 'expo-router';
import { BadgeCheck, CalendarPlus, Clock, ExternalLink, MapPin, Phone, ShieldAlert, Wallet } from 'lucide-react-native';
import { formatMoney, weekdayLabel } from '@app/shared';
import { groupHours, useProviderProfile } from '../../src/lib/provider';
import { bookHref } from '../../src/lib/routes';
import { Alert, Avatar, Badge, Button, Card, Divider, EmptyState, ErrorState, Loading, Ltr, Row, Screen, SectionTitle, Stack, Summary, Text } from '../../src/components/ui';
import { color, space } from '../../src/theme';

export default function ProviderScreen() {
  const { facilityId, practitioner } = useLocalSearchParams<{ facilityId: string; practitioner?: string }>();
  const profile = useProviderProfile(facilityId, practitioner);

  if (profile.status === 'loading' && !profile.data) return <Screen><Loading /></Screen>;
  if (profile.status === 'error') return <Screen><Card><ErrorState error={profile.error} onRetry={profile.reload} /></Card></Screen>;
  const p = profile.data;
  if (!p) return <Screen><Card><EmptyState icon={<ShieldAlert size={28} color={color.mutedText} />} title="مقدم الخدمة غير متاح">قد يكون الملف غير منشور حالياً.</EmptyState></Card></Screen>;

  const name = p.practitioner?.full_name ?? p.facility.name;
  const book = (serviceId?: string) => router.push(bookHref(p.facility.id, p.practitioner?.id, serviceId));
  const hours = groupHours(p.weekly_hours);
  const minPrice = p.services.length ? Math.min(...p.services.map((s) => s.price_minor ?? Infinity)) : null;

  return (
    <Screen refreshing={profile.status === 'loading'} onRefresh={profile.reload}
            footer={<Row between>
              <View style={{ flex: 1 }}>
                <Text variant="small" weight="semibold" numberOfLines={1}>{name}</Text>
                {minPrice != null && Number.isFinite(minPrice) && <Text variant="small" muted>يبدأ من {formatMoney(minPrice)}</Text>}
              </View>
              <Button title="احجز موعداً" icon={<CalendarPlus size={18} color={color.surface} />} onPress={() => book()} disabled={!p.services.length} />
            </Row>}>
      <RouterStack.Screen options={{ title: name }} />
      <Card>
        <Row gap={space[3]} style={{ alignItems: 'flex-start' }}>
          <Avatar name={name} large />
          <Stack gap={4} style={{ flex: 1 }}>
            <Text variant="h3">{name}</Text>
            {p.practitioner && <Text variant="small" muted>{[p.practitioner.title, p.practitioner.specialty].filter(Boolean).join(' · ')}</Text>}
            <Text variant="small">{p.facility.name} — {p.facility.branch_name}</Text>
            <Row wrap>
              {p.practitioner?.license_verified && <Badge label="ترخيص تمت مراجعته" tone="success" icon={<BadgeCheck size={12} color={color.success} />} />}
              <Badge label={p.policy.confirmation_mode === 'auto' ? 'تأكيد فوري' : 'يتطلب تأكيد العيادة'} tone={p.policy.confirmation_mode === 'auto' ? 'success' : 'warning'} />
            </Row>
          </Stack>
        </Row>
        <Text variant="body">{p.practitioner?.bio ?? p.facility.description ?? 'لا توجد نبذة منشورة.'}</Text>
      </Card>

      <Card>
        <SectionTitle>الخدمات</SectionTitle>
        {p.services.length === 0 && <Text variant="small" muted>لا توجد خدمات منشورة للحجز.</Text>}
        {p.services.map((s, i) => (
          <View key={s.id} style={{ gap: space[2] }}>
            {i > 0 && <Divider />}
            <Row between style={{ alignItems: 'flex-start' }}>
              <Stack gap={2} style={{ flex: 1 }}>
                <Text variant="title" style={{ fontSize: 15 }}>{s.name}</Text>
                <Row gap={space[3]} wrap>
                  <Row gap={4}><Clock size={14} color={color.mutedText} /><Text variant="small" muted>{s.duration_minutes} دقيقة</Text></Row>
                  <Row gap={4}><Wallet size={14} color={color.mutedText} /><Text variant="small" muted>{formatMoney(s.price_minor, s.currency)}</Text></Row>
                </Row>
                {s.preparation_note && <Text variant="small" style={{ color: color.warningText }}>{s.preparation_note}</Text>}
              </Stack>
              <Button title="اختيار" small variant="secondary" onPress={() => book(s.id)} />
            </Row>
          </View>
        ))}
      </Card>

      <Card>
        <SectionTitle>أيام العمل</SectionTitle>
        {hours.length
          ? <Summary rows={hours.map(([d, r]) => [weekdayLabel[d], <Ltr key={d}>{r}</Ltr>])} />
          : <Text variant="small" muted>{p.facility.opening_hours_note ?? 'غير منشورة'}</Text>}
        <Alert tone="info" title="سياسة الإلغاء">
          {p.policy.cancellation_policy_text ?? `يمكن الإلغاء قبل ${Math.round(p.policy.cancellation_cutoff_minutes / 60)} ساعة من الموعد.`}
        </Alert>
      </Card>

      <Card>
        <SectionTitle>الموقع</SectionTitle>
        <Row style={{ alignItems: 'flex-start' }}><MapPin size={18} color={color.mutedText} /><Text style={{ flex: 1 }}>{[p.facility.address, p.facility.area, p.facility.city].filter(Boolean).join('، ') || '—'}</Text></Row>
        {p.facility.phone && (
          <Button title={p.facility.phone} variant="secondary" icon={<Phone size={16} color={color.primary} />} onPress={() => void Linking.openURL(`tel:${p.facility.phone}`)} accessibilityLabel={`اتصال ${p.facility.phone}`} />
        )}
        {p.facility.latitude != null && (
          <Button title="فتح الموقع على الخريطة" variant="secondary" icon={<ExternalLink size={16} color={color.primary} />}
                  onPress={() => void Linking.openURL(`https://www.openstreetmap.org/?mlat=${p.facility.latitude}&mlon=${p.facility.longitude}#map=17/${p.facility.latitude}/${p.facility.longitude}`)} />
        )}
      </Card>
    </Screen>
  );
}
