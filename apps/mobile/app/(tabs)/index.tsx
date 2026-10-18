import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Link, router } from 'expo-router';
import * as Location from 'expo-location';
import { BadgeCheck, Clock, FlaskConical, LocateFixed, MapPin, QrCode, Search, SearchX, Stethoscope, Wallet } from 'lucide-react-native';
import { addDays, formatDateShort, formatMoney, formatTime, localDateKey } from '@app/shared';
import { supabase } from '../../src/lib/supabase';
import { unwrap, useAsync } from '../../src/lib/useAsync';
import { useAuth } from '../../src/lib/auth';
import { providerHref } from '../../src/lib/routes';
import { Avatar, Badge, Button, Card, Chip, EmptyState, ErrorState, Field, Loading, Row, Screen, Segmented, Stack, Text } from '../../src/components/ui';
import { color, space } from '../../src/theme';

type Kind = 'doctor' | 'laboratory';
interface Provider {
  practitioner_id: string | null; facility_id: string; display_name: string; title: string | null;
  specialty_name: string | null; facility_name: string; organization_name: string; branch_name: string;
  area: string | null; city_name: string | null; distance_km: number | null;
  min_price_minor: number | null; currency: string; license_verified: boolean;
}

export default function Home() {
  const { session } = useAuth();
  const [kind, setKind] = useState<Kind>('doctor');
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [specialty, setSpecialty] = useState<string | null>(null);
  const [cityId, setCityId] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geo, setGeo] = useState<'idle' | 'asking' | 'denied' | 'ok'>('idle');

  useEffect(() => { const t = setTimeout(() => setDebounced(query.trim()), 300); return () => clearTimeout(t); }, [query]);

  const catalogs = useAsync(async () => {
    const [sp, ct] = await Promise.all([
      unwrap(supabase.from('specialties').select('id, name_ar').eq('is_active', true).order('sort_order')),
      unwrap(supabase.from('cities').select('id, name_ar').eq('is_active', true).order('name_ar')),
    ]);
    return { specialties: sp ?? [], cities: ct ?? [] };
  }, []);

  const results = useAsync(async () => unwrap(supabase.rpc('search_providers', {
    p_kind: kind,
    p_query: debounced || undefined,
    p_specialty_id: kind === 'doctor' ? specialty ?? undefined : undefined,
    p_city_id: cityId ?? undefined,
    p_lat: coords?.lat, p_lng: coords?.lng,
  })) as Promise<Provider[]>, [kind, debounced, specialty, cityId, coords]);

  const askLocation = async () => {
    setGeo('asking');
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) { setGeo('denied'); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGeo('ok');
    } catch { setGeo('denied'); }
  };

  return (
    <Screen refreshing={results.status === 'loading' && !!results.data} onRefresh={results.reload}>
      <Stack gap={space[3]}>
        <Row between>
          <Text variant="h3">{session ? 'أهلاً بك' : 'مرحباً'}، كيف نساعدك اليوم؟</Text>
          {session && <Button title="بطاقتي" small variant="secondary" icon={<QrCode size={16} color={color.primary} />} onPress={() => router.navigate('/account')} />}
        </Row>
        <View style={{ position: 'relative', justifyContent: 'center' }}>
          <Field label="ابحث عن طبيب أو تحليل" placeholder="اسم طبيب، تحليل أو منطقة" value={query} onChangeText={setQuery}
                 returnKeyType="search" style={{ paddingStart: 40 }} />
          <View style={{ position: 'absolute', start: 12, bottom: 14 }} pointerEvents="none"><Search size={18} color={color.mutedText} /></View>
        </View>
        <Segmented<Kind> value={kind} onChange={setKind} options={[
          { id: 'doctor', label: 'أطباء', icon: <Stethoscope size={16} color={kind === 'doctor' ? color.primary : color.mutedText} /> },
          { id: 'laboratory', label: 'مختبرات', icon: <FlaskConical size={16} color={kind === 'laboratory' ? color.primary : color.mutedText} /> },
        ]} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space[2] }}>
          <Chip label={geo === 'ok' ? 'حسب موقعك' : geo === 'asking' ? 'جارٍ التحديد…' : 'استخدم موقعي'} selected={geo === 'ok'}
                icon={<LocateFixed size={14} color={geo === 'ok' ? color.surface : color.accent} />}
                onPress={() => (geo === 'ok' ? (setCoords(null), setGeo('idle')) : void askLocation())} />
          <Chip label="كل المدن" selected={cityId === null} onPress={() => setCityId(null)} />
          {catalogs.data?.cities.map((c) => <Chip key={c.id} label={c.name_ar} selected={cityId === c.id} onPress={() => setCityId(c.id)} />)}
        </ScrollView>
        {geo === 'denied' && <Text variant="small" muted>لم يُمنح إذن الموقع — اختر المدينة يدوياً، والحجز لا يحتاج الموقع.</Text>}
        {kind === 'doctor' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space[2] }}>
            <Chip label="كل التخصصات" selected={specialty === null} onPress={() => setSpecialty(null)} />
            {catalogs.data?.specialties.map((sp) => <Chip key={sp.id} label={sp.name_ar} selected={specialty === sp.id} onPress={() => setSpecialty(sp.id)} />)}
          </ScrollView>
        )}
      </Stack>

      <Row between>
        <Text variant="title">{kind === 'doctor' ? 'الأطباء' : 'المختبرات'}{coords ? ' الأقرب إليك' : ''}</Text>
        {results.status === 'success' && <Text variant="small" muted>{results.data.length} نتيجة</Text>}
      </Row>
      {results.status === 'loading' && !results.data && <Card><Loading /></Card>}
      {results.status === 'error' && <Card><ErrorState error={results.error} onRetry={results.reload} /></Card>}
      {results.data?.length === 0 && (
        <Card><EmptyState icon={<SearchX size={28} color={color.mutedText} />} title="لا توجد نتائج مطابقة">جرّب تخصصاً آخر أو احذف عبارة البحث أو اختر مدينة مختلفة.</EmptyState></Card>
      )}
      {results.data?.map((p) => <ProviderCard key={`${p.facility_id}:${p.practitioner_id}`} p={p} kind={kind} />)}
    </Screen>
  );
}

function ProviderCard({ p, kind }: { p: Provider; kind: Kind }) {
  const href = providerHref(p.facility_id, p.practitioner_id);
  return (
    <Card>
      <Link href={href} asChild>
        <Pressable accessibilityRole="link" accessibilityLabel={`${p.display_name} — عرض التفاصيل`}>
          <Row gap={space[3]} style={{ alignItems: 'flex-start' }}>
            <Avatar name={p.display_name} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="title">{p.display_name}</Text>
              <Text variant="small" muted>{kind === 'doctor' ? (p.specialty_name ?? p.title ?? '') : p.organization_name}</Text>
              {kind === 'doctor' && <Text variant="small">{p.facility_name}</Text>}
            </View>
            {p.license_verified && kind === 'doctor' && <Badge label="موثّق" tone="success" icon={<BadgeCheck size={12} color={color.success} />} />}
          </Row>
        </Pressable>
      </Link>
      <Row wrap gap={space[3]}>
        <Row gap={4}><MapPin size={14} color={color.mutedText} /><Text variant="small" muted>{[p.area, p.city_name].filter(Boolean).join('، ') || p.branch_name}</Text></Row>
        {p.distance_km != null && <Text variant="small" muted>≈ {p.distance_km} كم</Text>}
        {p.min_price_minor != null && <Row gap={4}><Wallet size={14} color={color.mutedText} /><Text variant="small" muted>يبدأ من {formatMoney(p.min_price_minor)}</Text></Row>}
      </Row>
      <NextSlot facilityId={p.facility_id} practitionerId={p.practitioner_id} />
      <Button title={kind === 'doctor' ? 'عرض المواعيد والحجز' : 'عرض الفحوصات والحجز'} onPress={() => router.push(href)} />
    </Card>
  );
}

/** Earliest free slot in the next 7 days for the provider's first public service. */
function NextSlot({ facilityId, practitionerId }: { facilityId: string; practitionerId: string | null }) {
  const today = useMemo(() => localDateKey(new Date()), []);
  const state = useAsync(async () => {
    const profile = await unwrap(supabase.rpc('get_provider_profile', { p_facility_id: facilityId, p_practitioner_id: practitionerId ?? undefined }));
    const services = ((profile as { services?: { id: string }[] } | null)?.services) ?? [];
    if (!services.length) return null;
    const slots = await unwrap(supabase.rpc('get_available_slots', {
      p_facility_id: facilityId, p_practitioner_id: practitionerId as string, p_service_id: services[0].id,
      p_from: today, p_to: addDays(today, 7),
    }));
    return (slots as { slot_start: string }[])[0]?.slot_start ?? null;
  }, [facilityId, practitionerId, today]);
  if (state.status === 'loading') return <Text variant="small" muted>…</Text>;
  if (state.status === 'error' || !state.data) {
    return <Row gap={4}><Clock size={14} color={color.mutedText} /><Text variant="small" muted>لا توجد أوقات متاحة خلال 7 أيام</Text></Row>;
  }
  return (
    <Row gap={4}>
      <Clock size={14} color={color.accent} />
      <Text variant="small" weight="semibold" style={{ color: color.accent }}>أقرب موعد: {formatDateShort(state.data)} — {formatTime(state.data)}</Text>
    </Row>
  );
}
