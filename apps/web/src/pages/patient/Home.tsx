import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Baby, BadgeCheck, Bone, Brain, CalendarClock, Clock, Ear, Eye, FlaskConical, HeartHandshake, HeartPulse, LocateFixed, MapPin,
  QrCode, Search, SearchX, Smile, Sparkles, Stethoscope, Syringe, Users, Droplets, Flower2,
} from 'lucide-react';
import { addDays, formatDateShort, formatMoney, formatTime, localDateKey } from '@app/shared';
import { supabase } from '../../lib/supabase';
import { unwrap, useAsync } from '../../lib/useAsync';
import { useAuth } from '../../lib/auth';
import { mediaUrl } from '../../lib/media';
import { AiAssist } from '../../components/AiAssist';
import { Avatar, EmptyState, ErrorState, Skeleton } from '../../components/ui';

type Kind = 'doctor' | 'laboratory';
interface Provider {
  practitioner_id: string | null; facility_id: string; display_name: string; title: string | null;
  specialty_name: string | null; facility_name: string; organization_name: string; branch_name: string;
  area: string | null; city_name: string | null; address: string | null; distance_km: number | null;
  min_price_minor: number | null; currency: string; license_verified: boolean; opening_hours_note: string | null; photo_path?: string | null;
}

/** Icon per specialty name (falls back to a stethoscope). */
const specIcons: [RegExp, ReactNode][] = [
  [/قلب/, <HeartPulse size={20} key="h" />], [/أطفال/, <Baby size={20} key="b" />], [/نسائية|توليد/, <Flower2 size={20} key="v" />],
  [/عظام|مفاصل/, <Bone size={20} key="o" />], [/عيون/, <Eye size={20} key="e" />], [/أنف|أذن/, <Ear size={20} key="r" />],
  [/أسنان/, <Smile size={20} key="t" />], [/جلد/, <Sparkles size={20} key="s" />], [/عصبي/, <Brain size={20} key="n" />],
  [/نفسي/, <HeartHandshake size={20} key="p" />], [/جراحة/, <Syringe size={20} key="g" />], [/مسالك/, <Droplets size={20} key="u" />],
  [/أسرة/, <Users size={20} key="f" />],
];
const specIcon = (name: string) => specIcons.find(([re]) => re.test(name))?.[1] ?? <Stethoscope size={20} />;

export function PatientHome() {
  const { session } = useAuth();
  const [kind, setKind] = useState<Kind>('doctor');
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [specialty, setSpecialty] = useState<string | null>(null);
  const [cityId, setCityId] = useState<string>('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoState, setGeoState] = useState<'idle' | 'asking' | 'denied' | 'ok'>('idle');

  useEffect(() => { const t = setTimeout(() => setDebounced(query), 300); return () => clearTimeout(t); }, [query]);

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
    p_city_id: cityId || undefined,
    p_lat: coords?.lat, p_lng: coords?.lng,
  })) as Promise<Provider[]>, [kind, debounced, specialty, cityId, coords]);

  const askLocation = () => {
    if (geoState === 'ok') { setCoords(null); setGeoState('idle'); return; }
    if (!('geolocation' in navigator)) { setGeoState('denied'); return; }
    setGeoState('asking');
    navigator.geolocation.getCurrentPosition(
      (pos) => { setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGeoState('ok'); },
      () => setGeoState('denied'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  };
  // nearest first: ask once per visit when the page opens (the button still toggles it)
  useEffect(() => {
    try { if (sessionStorage.getItem('geo.asked')) return; sessionStorage.setItem('geo.asked', '1'); } catch { /* storage unavailable */ }
    askLocation();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const showNearest = (k: Kind, specialtyId: string | null) => {
    setKind(k); setSpecialty(specialtyId); setQuery('');
    if (geoState !== 'ok' && geoState !== 'asking') askLocation();
    requestAnimationFrame(() => document.getElementById('results-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  return (
    <div className="stack-lg">
      <section className="hero stack reveal" aria-labelledby="home-title">
        <div className="row-between" style={{ alignItems: 'flex-start' }}>
          <div className="stack-sm" style={{ gap: 4 }}>
            <span className="eyebrow">{session ? 'أهلاً بك من جديد' : 'مرحباً بك'}</span>
            <h1 id="home-title">كيف نساعدك اليوم؟</h1>
            <p className="lead">ابحث عن طبيب أو مختبر قريب منك، واحجز الوقت المناسب خلال دقيقة.</p>
          </div>
          {session && <Link to="/patient/account#card" className="hero-pill" style={{ textDecoration: 'none' }}><QrCode size={16} aria-hidden />بطاقتي</Link>}
        </div>
        <div className="input-icon search-xl">
          <Search size={20} aria-hidden />
          <label className="sr-only" htmlFor="q">ابحث عن طبيب أو تحليل</label>
          <input id="q" className="input" type="search" placeholder="ابحث عن طبيب أو تحليل أو منطقة" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="hero-tools">
          <button className="hero-pill" aria-pressed={geoState === 'ok'} onClick={askLocation} aria-describedby="loc-hint">
            <LocateFixed size={16} aria-hidden />{geoState === 'ok' ? 'الأقرب إليك' : geoState === 'asking' ? 'جارٍ تحديد الموقع…' : 'استخدم موقعي'}
          </button>
          <label className="hero-pill">
            <MapPin size={16} aria-hidden />
            <span className="sr-only">المدينة</span>
            <select id="city" value={cityId} onChange={(e) => setCityId(e.target.value)} aria-label="المدينة">
              <option value="">كل المدن</option>
              {catalogs.data?.cities.map((c) => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
            </select>
          </label>
          <span className="grow" />
          <div className="segmented" role="group" aria-label="نوع مقدم الخدمة">
            <button aria-pressed={kind === 'doctor'} onClick={() => setKind('doctor')}><Stethoscope size={16} aria-hidden /> أطباء</button>
            <button aria-pressed={kind === 'laboratory'} onClick={() => setKind('laboratory')}><FlaskConical size={16} aria-hidden /> مختبرات</button>
          </div>
        </div>
        <span id="loc-hint" className="sr-only">الموقع اختياري ولا يلزم للحجز</span>
        {geoState === 'denied' && <span className="small" style={{ color: '#FDE7C2' }}>لم يُمنح إذن الموقع — اختر المدينة يدوياً، والحجز لا يحتاج GPS.</span>}
      </section>

      <AiAssist signedIn={!!session} onDoctors={(id) => showNearest('doctor', id)} onLabs={() => showNearest('laboratory', null)} />

      {kind === 'doctor' && (
        <section aria-label="التخصصات" className="stack-sm">
          <div className="spec-rail" role="group" aria-label="التخصصات">
            <button className="spec" aria-pressed={specialty === null} onClick={() => setSpecialty(null)}><span className="spec-ico"><Stethoscope size={20} aria-hidden /></span>الكل</button>
            {catalogs.status === 'loading' && !catalogs.data && Array.from({ length: 6 }, (_, i) => <Skeleton key={i} width={84} height={86} style={{ flex: 'none', borderRadius: 16 }} />)}
            {catalogs.data?.specialties.map((s) => (
              <button key={s.id} className="spec" aria-pressed={specialty === s.id} onClick={() => setSpecialty(specialty === s.id ? null : s.id)}>
                <span className="spec-ico" aria-hidden>{specIcon(s.name_ar)}</span>{s.name_ar}
              </button>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="results-title" className="stack">
        <div className="section-head">
          <h2 id="results-title" className="section-title">{kind === 'doctor' ? 'الأطباء' : 'المختبرات'}{coords ? ' الأقرب إليك' : ''}</h2>
          {results.status === 'success' && <span className="muted small" aria-live="polite">{results.data.length} نتيجة</span>}
        </div>
        {results.status === 'loading' && !results.data && <div className="provider-grid" aria-busy="true" aria-label="جارٍ التحميل">{Array.from({ length: 3 }, (_, i) => <ProviderSkeleton key={i} />)}</div>}
        {results.status === 'error' && <div className="card"><ErrorState error={results.error} onRetry={results.reload} /></div>}
        {results.data && results.data.length === 0 && (
          <div className="card">
            <EmptyState icon={<SearchX />} title="لا توجد نتائج مطابقة">جرّب تخصصاً آخر أو احذف عبارة البحث أو اختر مدينة مختلفة.</EmptyState>
          </div>
        )}
        {results.data && results.data.length > 0 && (
          <div className="provider-grid reveal" aria-busy={results.status === 'loading'}>
            {results.data.map((p) => <ProviderCard key={`${p.facility_id}:${p.practitioner_id}`} p={p} kind={kind} />)}
          </div>
        )}
      </section>
    </div>
  );
}

function ProviderSkeleton() {
  return (
    <div className="card provider-card" aria-hidden>
      <div className="row" style={{ flexWrap: 'nowrap' }}><Skeleton width={48} height={48} style={{ borderRadius: 14 }} /><div className="grow stack-sm"><Skeleton width="65%" /><Skeleton width="40%" height={12} /></div></div>
      <Skeleton width="80%" height={12} />
      <Skeleton width="55%" height={30} style={{ borderRadius: 12 }} />
      <div className="row-between"><Skeleton width={90} height={28} /><Skeleton width={84} height={36} /></div>
    </div>
  );
}

function ProviderCard({ p, kind }: { p: Provider; kind: Kind }) {
  const href = `/patient/provider/${p.facility_id}${p.practitioner_id ? `/${p.practitioner_id}` : ''}`;
  return (
    <article className="card provider-card card-interactive">
      <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
        <Avatar name={p.display_name} src={mediaUrl(p.photo_path)} />
        <div className="grow" style={{ minWidth: 0 }}>
          <h3 className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
            <Link to={href} className="stretched truncate">{p.display_name}</Link>
            {p.license_verified && kind === 'doctor' && <BadgeCheck size={18} className="verified" aria-label="ترخيص تمت مراجعته" />}
          </h3>
          <div className="muted small truncate">{kind === 'doctor' ? (p.specialty_name ?? p.title) : p.organization_name}</div>
        </div>
      </div>
      <div className="meta">
        {kind === 'doctor' && <span><Stethoscope size={14} aria-hidden />{p.facility_name}</span>}
        <span><MapPin size={14} aria-hidden />{[p.area, p.city_name].filter(Boolean).join('، ') || p.branch_name}</span>
        {p.distance_km != null && <span>≈ {p.distance_km} كم</span>}
      </div>
      <NextSlot facilityId={p.facility_id} practitionerId={p.practitioner_id} />
      <div className="foot">
        <span className="price">{p.min_price_minor != null ? <><small>يبدأ من</small>{formatMoney(p.min_price_minor)}</> : <small>السعر في العيادة</small>}</span>
        <Link to={href} className="btn btn-soft btn-sm over"><CalendarClock size={16} aria-hidden />{kind === 'doctor' ? 'عرض المواعيد والحجز' : 'عرض الفحوصات والحجز'}</Link>
      </div>
    </article>
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
  if (state.status === 'loading') return <Skeleton height={30} width="60%" style={{ borderRadius: 12 }} />;
  if (state.status === 'error' || !state.data) return <span className="next-slot none"><Clock size={14} aria-hidden />لا توجد أوقات متاحة خلال 7 أيام</span>;
  const isToday = localDateKey(new Date(state.data)) === today;
  return <span className="next-slot"><Clock size={14} aria-hidden />أقرب موعد: {isToday ? 'اليوم' : formatDateShort(state.data)} — {formatTime(state.data)}</span>;
}
