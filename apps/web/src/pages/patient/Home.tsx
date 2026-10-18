import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, Clock, FlaskConical, LocateFixed, MapPin, QrCode, Search, SearchX, Stethoscope, Wallet } from 'lucide-react';
import { addDays, formatDateShort, formatMoney, formatTime, localDateKey } from '@app/shared';
import { supabase } from '../../lib/supabase';
import { unwrap, useAsync } from '../../lib/useAsync';
import { useAuth } from '../../lib/auth';
import { Avatar, Badge, EmptyState, ErrorState, Skeleton, SkeletonList } from '../../components/ui';

type Kind = 'doctor' | 'laboratory';
interface Provider {
  practitioner_id: string | null; facility_id: string; display_name: string; title: string | null;
  specialty_name: string | null; facility_name: string; organization_name: string; branch_name: string;
  area: string | null; city_name: string | null; address: string | null; distance_km: number | null;
  min_price_minor: number | null; currency: string; license_verified: boolean; opening_hours_note: string | null;
}

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
    if (!('geolocation' in navigator)) { setGeoState('denied'); return; }
    setGeoState('asking');
    navigator.geolocation.getCurrentPosition(
      (pos) => { setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGeoState('ok'); },
      () => setGeoState('denied'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  };

  return (
    <div className="stack" style={{ gap: 'var(--s-5)' }}>
      <section className="hero-search" aria-labelledby="home-title">
        <div className="row-between">
          <h1 id="home-title" className="greeting">{session ? 'أهلاً بك' : 'مرحباً'}، كيف نساعدك اليوم؟</h1>
          {session && <Link to="/patient/account#card" className="btn btn-secondary btn-sm"><QrCode size={16} aria-hidden />بطاقتي</Link>}
        </div>
        <div className="row">
          <button className="location-btn" onClick={askLocation} aria-describedby="loc-hint">
            <LocateFixed size={16} aria-hidden />{geoState === 'ok' ? 'يتم الترتيب حسب موقعك' : geoState === 'asking' ? 'جارٍ تحديد الموقع…' : 'استخدم موقعي'}
          </button>
          <span className="muted small">أو</span>
          <label className="sr-only" htmlFor="city">المدينة</label>
          <select id="city" className="select" style={{ width: 'auto', minHeight: 36 }} value={cityId} onChange={(e) => setCityId(e.target.value)}>
            <option value="">كل المدن</option>
            {catalogs.data?.cities.map((c) => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
          </select>
        </div>
        <span id="loc-hint" className="sr-only">الموقع اختياري ولا يلزم للحجز</span>
        {geoState === 'denied' && <span className="small muted">لم يُمنح إذن الموقع — يمكنك اختيار المدينة يدوياً، والحجز لا يحتاج GPS.</span>}

        <div className="input-icon">
          <Search size={18} aria-hidden />
          <label className="sr-only" htmlFor="q">ابحث عن طبيب أو تحليل</label>
          <input id="q" className="input" type="search" placeholder="ابحث عن طبيب أو تحليل أو منطقة" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        <div className="segmented" role="group" aria-label="نوع مقدم الخدمة">
          <button aria-pressed={kind === 'doctor'} onClick={() => setKind('doctor')}><Stethoscope size={16} aria-hidden /> أطباء</button>
          <button aria-pressed={kind === 'laboratory'} onClick={() => setKind('laboratory')}><FlaskConical size={16} aria-hidden /> مختبرات</button>
        </div>

        {kind === 'doctor' && (
          <div className="chips" role="group" aria-label="التخصصات">
            <button className="chip" aria-pressed={specialty === null} onClick={() => setSpecialty(null)}>الكل</button>
            {catalogs.data?.specialties.map((s) => (
              <button key={s.id} className="chip" aria-pressed={specialty === s.id} onClick={() => setSpecialty(s.id)}>{s.name_ar}</button>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="results-title" className="stack">
        <div className="row-between">
          <h2 id="results-title" className="section-title">{kind === 'doctor' ? 'الأطباء' : 'المختبرات'}{coords ? ' الأقرب إليك' : ''}</h2>
          {results.status === 'success' && <span className="muted small">{results.data.length} نتيجة</span>}
        </div>
        {results.status === 'loading' && !results.data && <div className="card"><SkeletonList rows={3} /></div>}
        {results.status === 'error' && <div className="card"><ErrorState error={results.error} onRetry={results.reload} /></div>}
        {results.data && results.data.length === 0 && (
          <div className="card">
            <EmptyState icon={<SearchX />} title="لا توجد نتائج مطابقة">جرّب تخصصاً آخر أو احذف عبارة البحث أو اختر مدينة مختلفة.</EmptyState>
          </div>
        )}
        {results.data && results.data.length > 0 && (
          <div className="provider-grid" aria-busy={results.status === 'loading'}>
            {results.data.map((p) => <ProviderCard key={`${p.facility_id}:${p.practitioner_id}`} p={p} kind={kind} />)}
          </div>
        )}
      </section>
    </div>
  );
}

function ProviderCard({ p, kind }: { p: Provider; kind: Kind }) {
  const href = `/patient/provider/${p.facility_id}${p.practitioner_id ? `/${p.practitioner_id}` : ''}`;
  return (
    <article className="card provider-card">
      <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
        <Avatar name={p.display_name} />
        <div className="grow">
          <h3><Link to={href} style={{ color: 'inherit', textDecoration: 'none' }}>{p.display_name}</Link></h3>
          <div className="muted small">{kind === 'doctor' ? (p.specialty_name ?? p.title) : p.organization_name}</div>
          {kind === 'doctor' && <div className="small">{p.facility_name}</div>}
        </div>
        {p.license_verified && kind === 'doctor' && <Badge tone="success" icon={<BadgeCheck aria-hidden />}>موثّق</Badge>}
      </div>
      <div className="meta">
        <span><MapPin size={14} aria-hidden />{[p.area, p.city_name].filter(Boolean).join('، ') || p.branch_name}</span>
        {p.distance_km != null && <span>≈ {p.distance_km} كم</span>}
        {p.min_price_minor != null && <span><Wallet size={14} aria-hidden />يبدأ من {formatMoney(p.min_price_minor)}</span>}
      </div>
      <NextSlot facilityId={p.facility_id} practitionerId={p.practitioner_id} />
      <Link to={href} className="btn btn-primary btn-block">{kind === 'doctor' ? 'عرض المواعيد والحجز' : 'عرض الفحوصات والحجز'}</Link>
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
  if (state.status === 'loading') return <Skeleton height={14} width="55%" />;
  if (state.status === 'error' || !state.data) return <span className="small muted"><Clock size={14} aria-hidden style={{ verticalAlign: '-2px' }} /> لا توجد أوقات متاحة خلال 7 أيام</span>;
  return (
    <span className="small" style={{ color: 'var(--c-accent)', fontWeight: 600 }}>
      <Clock size={14} aria-hidden style={{ verticalAlign: '-2px' }} /> أقرب موعد: {formatDateShort(state.data)} — {formatTime(state.data)}
    </span>
  );
}
