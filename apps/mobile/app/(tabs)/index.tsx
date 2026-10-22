import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import {
  Baby, BadgeCheck, Bone, Brain, CalendarClock, Clock, Droplets, Ear, Eye, FlaskConical, Flower2, HeartHandshake, HeartPulse, LocateFixed, MapPin,
  QrCode, Search, SearchX, Smile, Sparkles, Stethoscope, Syringe, Users,
} from 'lucide-react-native';
import { addDays, formatDateShort, formatMoney, formatTime, localDateKey } from '@app/shared';
import { supabase } from '../../src/lib/supabase';
import { unwrap, useAsync } from '../../src/lib/useAsync';
import { useAuth } from '../../src/lib/auth';
import { mediaUrl } from '../../src/lib/media';
import { AiAssist } from '../../src/components/AiAssist';
import { PendingRx } from '../../src/components/PendingRx';
import { providerHref } from '../../src/lib/routes';
import { Avatar, Card, Chip, EmptyState, ErrorState, FadeIn, PressScale, Row, Screen, SkeletonBox, Stack, Text } from '../../src/components/ui';
import { color, family, radius, shadow, size, space, startAlign } from '../../src/theme';

const specIcons: [RegExp, (c: string) => ReactNode][] = [
  [/قلب/, (c) => <HeartPulse size={20} color={c} />], [/أطفال/, (c) => <Baby size={20} color={c} />], [/نسائية|توليد/, (c) => <Flower2 size={20} color={c} />],
  [/عظام|مفاصل/, (c) => <Bone size={20} color={c} />], [/عيون/, (c) => <Eye size={20} color={c} />], [/أنف|أذن/, (c) => <Ear size={20} color={c} />],
  [/أسنان/, (c) => <Smile size={20} color={c} />], [/جلد/, (c) => <Sparkles size={20} color={c} />], [/عصبي/, (c) => <Brain size={20} color={c} />],
  [/نفسي/, (c) => <HeartHandshake size={20} color={c} />], [/جراحة/, (c) => <Syringe size={20} color={c} />], [/مسالك/, (c) => <Droplets size={20} color={c} />],
  [/أسرة/, (c) => <Users size={20} color={c} />],
];
const specIcon = (name: string, c: string) => (specIcons.find(([re]) => re.test(name))?.[1] ?? ((x: string) => <Stethoscope size={20} color={x} />))(c);

type Kind = 'doctor' | 'laboratory';
interface Provider {
  practitioner_id: string | null; facility_id: string; display_name: string; title: string | null;
  specialty_name: string | null; facility_name: string; organization_name: string; branch_name: string;
  area: string | null; city_name: string | null; distance_km: number | null;
  min_price_minor: number | null; currency: string; license_verified: boolean; photo_path?: string | null;
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
  const showNearest = (k: Kind, specialtyId: string | null) => {
    setKind(k); setSpecialty(specialtyId); setQuery('');
    if (geo !== 'ok' && geo !== 'asking') void askLocation();
  };
  // the assistant's «أقرب أطباء …» / «أقرب المختبرات» buttons land here with filters
  const params = useLocalSearchParams<{ kind?: string; specialty?: string }>();
  useEffect(() => {
    if (params.kind === 'doctor' || params.kind === 'laboratory') showNearest(params.kind, params.specialty ?? null);
  }, [params.kind, params.specialty]); // eslint-disable-line react-hooks/exhaustive-deps
  // nearest first: ask for the location as soon as the home screen opens (once)
  useEffect(() => { void askLocation(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Screen refreshing={results.status === 'loading' && !!results.data} onRefresh={results.reload}>
      <FadeIn>
        <View style={h.hero}>
          <View style={h.glow} pointerEvents="none" />
          <View style={h.ring} pointerEvents="none" />
          <Row between style={{ alignItems: 'flex-start' }}>
            <Stack gap={2} style={{ flex: 1 }}>
              <Text variant="label" style={{ color: '#A9C3DA' }}>{session ? 'أهلاً بك من جديد' : 'مرحباً بك'}</Text>
              <Text variant="h2" style={{ color: '#fff' }}>كيف نساعدك اليوم؟</Text>
            </Stack>
            {session && (
              <Pressable onPress={() => router.navigate('/account')} style={h.pill} accessibilityRole="button" accessibilityLabel="بطاقتي">
                <QrCode size={16} color="#fff" /><Text variant="small" weight="semibold" style={{ color: '#fff' }}>بطاقتي</Text>
              </Pressable>
            )}
          </Row>
          <View style={h.search}>
            <Search size={20} color={color.mutedText} />
            <TextInput value={query} onChangeText={setQuery} placeholder="ابحث عن طبيب أو تحليل أو منطقة" placeholderTextColor={color.mutedText}
                       returnKeyType="search" accessibilityLabel="ابحث عن طبيب أو تحليل" style={h.searchInput} />
          </View>
          <View style={h.seg} accessibilityRole="tablist">
            {(['doctor', 'laboratory'] as Kind[]).map((k) => {
              const on = kind === k;
              return (
                <Pressable key={k} onPress={() => setKind(k)} style={[h.segBtn, on && { backgroundColor: '#fff' }]} accessibilityRole="tab" accessibilityState={{ selected: on }}>
                  {k === 'doctor' ? <Stethoscope size={16} color={on ? color.primary : '#CFE0EE'} /> : <FlaskConical size={16} color={on ? color.primary : '#CFE0EE'} />}
                  <Text variant="small" weight="semibold" style={{ color: on ? color.primary : '#CFE0EE' }}>{k === 'doctor' ? 'أطباء' : 'مختبرات'}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </FadeIn>

      {session && <PendingRx compact />}
      <AiAssist />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space[2] }}>
        <Chip label={geo === 'ok' ? 'الأقرب إليك' : geo === 'asking' ? 'جارٍ التحديد…' : 'استخدم موقعي'} selected={geo === 'ok'}
              icon={<LocateFixed size={14} color={geo === 'ok' ? color.surface : color.accent} />}
              onPress={() => (geo === 'ok' ? (setCoords(null), setGeo('idle')) : void askLocation())} />
        <Chip label="كل المدن" selected={cityId === null} icon={<MapPin size={14} color={cityId === null ? color.surface : color.mutedText} />} onPress={() => setCityId(null)} />
        {catalogs.data?.cities.map((c) => <Chip key={c.id} label={c.name_ar} selected={cityId === c.id} onPress={() => setCityId(c.id)} />)}
      </ScrollView>
      {geo === 'denied' && <Text variant="small" muted>لم يُمنح إذن الموقع — اختر المدينة يدوياً، والحجز لا يحتاج الموقع.</Text>}

      {kind === 'doctor' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space[2] }}>
          {[{ id: null as string | null, name_ar: 'الكل' }, ...(catalogs.data?.specialties ?? [])].map((sp) => {
            const on = specialty === sp.id;
            return (
              <PressScale key={sp.id ?? 'all'} onPress={() => setSpecialty(on && sp.id ? null : sp.id)} selected={on} accessibilityLabel={sp.name_ar}
                          style={[h.spec, on && { borderColor: color.accent, backgroundColor: color.accentSoft }]}>
                <View style={[h.specIco, on && { backgroundColor: color.accent }]}>{sp.id ? specIcon(sp.name_ar, on ? '#fff' : color.primary) : <Stethoscope size={20} color={on ? '#fff' : color.primary} />}</View>
                <Text variant="label" style={{ textAlign: 'center' }} numberOfLines={2}>{sp.name_ar}</Text>
              </PressScale>
            );
          })}
        </ScrollView>
      )}

      <Row between>
        <Text variant="h3" style={{ fontSize: 18 }}>{kind === 'doctor' ? 'الأطباء' : 'المختبرات'}{coords ? ' الأقرب إليك' : ''}</Text>
        {results.status === 'success' && <Text variant="small" muted>{results.data.length} نتيجة</Text>}
      </Row>
      {results.status === 'loading' && !results.data && [0, 1].map((i) => (
        <Card key={i}>
          <Row gap={space[3]}><SkeletonBox width={48} height={48} radius={14} /><Stack gap={6} style={{ flex: 1 }}><SkeletonBox width="60%" /><SkeletonBox width="35%" height={12} /></Stack></Row>
          <SkeletonBox width="55%" height={30} radius={12} />
        </Card>
      ))}
      {results.status === 'error' && <Card><ErrorState error={results.error} onRetry={results.reload} /></Card>}
      {results.data?.length === 0 && (
        <Card><EmptyState icon={<SearchX size={28} color={color.mutedText} />} title="لا توجد نتائج مطابقة">جرّب تخصصاً آخر أو احذف عبارة البحث أو اختر مدينة مختلفة.</EmptyState></Card>
      )}
      {results.data?.map((p, i) => <FadeIn key={`${p.facility_id}:${p.practitioner_id}`} index={i}><ProviderCard p={p} kind={kind} /></FadeIn>)}
    </Screen>
  );
}

const h = StyleSheet.create({
  hero: { backgroundColor: color.primary, borderRadius: 22, padding: space[5], gap: space[4], overflow: 'hidden', ...shadow },
  glow: { position: 'absolute', top: -70, left: -50, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(94,234,212,0.16)' },
  ring: { position: 'absolute', bottom: -110, right: -40, width: 260, height: 260, borderRadius: 130, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space[3], minHeight: 38, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  search: { flexDirection: 'row', alignItems: 'center', gap: space[2], backgroundColor: '#fff', borderRadius: radius.lg, paddingHorizontal: space[4], minHeight: 54 },
  searchInput: { flex: 1, minWidth: 0, width: 0, fontFamily: family.regular, fontSize: size.bodyLg, color: color.text, textAlign: startAlign, paddingVertical: 10 },
  seg: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.1)' },
  segBtn: { flex: 1, minHeight: 40, borderRadius: radius.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  spec: { width: 86, paddingVertical: space[3], paddingHorizontal: 4, borderRadius: radius.lg, borderWidth: 1, borderColor: color.border, backgroundColor: color.surface, alignItems: 'center', gap: 6 },
  specIco: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#EEF3F8', alignItems: 'center', justifyContent: 'center' },
});

function ProviderCard({ p, kind }: { p: Provider; kind: Kind }) {
  const href = providerHref(p.facility_id, p.practitioner_id);
  return (
    <PressScale onPress={() => router.push(href)} accessibilityRole="link" accessibilityLabel={`${p.display_name} — ${kind === 'doctor' ? 'عرض المواعيد والحجز' : 'عرض الفحوصات والحجز'}`}>
      <Card>
        <Row gap={space[3]} style={{ alignItems: 'flex-start' }}>
          <Avatar name={p.display_name} src={mediaUrl(p.photo_path)} />
          <View style={{ flex: 1, gap: 2 }}>
            <Row gap={6}><Text variant="title" numberOfLines={1} style={{ flexShrink: 1 }}>{p.display_name}</Text>{p.license_verified && kind === 'doctor' && <BadgeCheck size={18} color={color.accent} />}</Row>
            <Text variant="small" muted>{kind === 'doctor' ? (p.specialty_name ?? p.title ?? '') : p.organization_name}</Text>
          </View>
        </Row>
        <Row wrap gap={space[3]}>
          {kind === 'doctor' && <Row gap={4}><Stethoscope size={14} color={color.mutedText} /><Text variant="small" muted>{p.facility_name}</Text></Row>}
          <Row gap={4}><MapPin size={14} color={color.mutedText} /><Text variant="small" muted>{[p.area, p.city_name].filter(Boolean).join('، ') || p.branch_name}</Text></Row>
          {p.distance_km != null && <Text variant="small" muted>≈ {p.distance_km} كم</Text>}
        </Row>
        <NextSlot facilityId={p.facility_id} practitionerId={p.practitioner_id} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderStyle: 'dashed', borderColor: color.border, paddingTop: space[3] }}>
          <View>
            <Text variant="small" muted style={{ fontSize: 12 }}>{p.min_price_minor != null ? 'يبدأ من' : 'السعر'}</Text>
            <Text variant="title" style={{ fontSize: 15 }}>{p.min_price_minor != null ? formatMoney(p.min_price_minor) : 'في العيادة'}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: color.accentSoft, paddingHorizontal: space[3], minHeight: 40, borderRadius: radius.md }}>
            <CalendarClock size={16} color={color.accent} />
            <Text variant="small" weight="semibold" style={{ color: color.accent }}>{kind === 'doctor' ? 'عرض المواعيد والحجز' : 'عرض الفحوصات والحجز'}</Text>
          </View>
        </View>
      </Card>
    </PressScale>
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
  if (state.status === 'loading') return <SkeletonBox width="60%" height={30} radius={12} />;
  const none = state.status === 'error' || !state.data;
  const isToday = !none && localDateKey(new Date(state.data!)) === today;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: space[3], paddingVertical: 6, borderRadius: radius.md, backgroundColor: none ? color.surfaceSunken : color.accentSoft }}>
      <Clock size={14} color={none ? color.mutedText : color.accent} />
      <Text variant="small" weight={none ? 'regular' : 'semibold'} style={{ color: none ? color.mutedText : color.accent }}>
        {none ? 'لا توجد أوقات متاحة خلال 7 أيام' : `أقرب موعد: ${isToday ? 'اليوم' : formatDateShort(state.data!)} — ${formatTime(state.data!)}`}
      </Text>
    </View>
  );
}
