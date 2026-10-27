import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BadgeCheck, FlaskConical, MapPin, Stethoscope } from 'lucide-react';
import {
  buildDirectory, doctorPath, doctorsPath, formatMoney, idFromSlug, labPath, labsPath, listing, listingTitle, type Directory, type ProviderRow,
} from '@app/shared';
import { supabase } from '../lib/supabase';
import { unwrap, useAsync } from '../lib/useAsync';
import { mediaUrl } from '../lib/media';
import { Avatar, Badge, EmptyState, ErrorState, PageHead, SkeletonList } from '../components/ui';
import { ProviderPage } from './patient/Provider';

let cached: Promise<Directory> | null = null;
/** The public directory: from the site's edge function, or built here (local dev has no edge functions). */
export function loadDirectory(): Promise<Directory> {
  cached ??= fetch('/api/directory')
    .then((r) => (r.ok && r.headers.get('content-type')?.includes('json') ? (r.json() as Promise<Directory>) : Promise.reject(new Error('no edge'))))
    .catch(() => buildDirectory({
      cities: async () => (await unwrap(supabase.from('cities').select('id, name_ar, name_en').eq('is_active', true).order('name_ar'))) ?? [],
      specialties: async () => (await unwrap(supabase.from('specialties').select('id, code, name_ar').eq('is_active', true).order('sort_order'))) ?? [],
      search: async (kind, cityId) => ((await unwrap(supabase.rpc('search_providers', { p_kind: kind, p_city_id: cityId, p_limit: 100 }))) ?? []) as unknown as ProviderRow[],
    }));
  cached.catch(() => { cached = null; });
  return cached;
}

const useTitle = (t: string | null) => useEffect(() => { if (t) document.title = t; }, [t]);

/** /doctors, /doctors/:city, /doctors/:city/:specialty */
export function DoctorsDirectory() {
  const { city, specialty } = useParams();
  const dir = useAsync(loadDirectory, []);
  const l = dir.data ? listing(dir.data, city, specialty) : null;
  useTitle(l ? `${listingTitle(l.city, l.specialty)} | أبيض` : null);
  if (dir.status === 'loading' && !dir.data) return <div className="card"><SkeletonList rows={4} /></div>;
  if (dir.status === 'error') return <div className="card"><ErrorState error={dir.error} onRetry={dir.reload} /></div>;
  const d = dir.data!;
  return (
    <div className="stack">
      <nav className="small crumbs" aria-label="مسار الصفحة">
        <Link to={doctorsPath()}>الأطباء</Link>
        {l!.city && <> › <Link to={doctorsPath(l!.city.slug)}>{l!.city.name}</Link></>}
        {l!.specialty && <> › <span>{l!.specialty.name}</span></>}
      </nav>
      <PageHead title={listingTitle(l!.city, l!.specialty)} subtitle={`${l!.doctors.length} طبيب · احجز موعدك أونلاين`} />
      <div className="chips" role="list" aria-label={l!.city ? 'الاختصاصات' : 'المدن'}>
        {!l!.city
          ? d.cities.filter((c) => c.doctors).map((c) => <Link role="listitem" key={c.slug} className="chip" to={doctorsPath(c.slug)}>{c.name} <span className="muted">({c.doctors})</span></Link>)
          : <>
              <Link role="listitem" className={`chip ${!l!.specialty ? 'on' : ''}`} to={doctorsPath(l!.city.slug)}>كل الاختصاصات</Link>
              {l!.specialties.map((s) => <Link role="listitem" key={s.code} className={`chip ${l!.specialty?.code === s.code ? 'on' : ''}`} to={doctorsPath(l!.city!.slug, s.code)}>{s.name}</Link>)}
            </>}
      </div>
      {l!.doctors.length === 0
        ? <div className="card"><EmptyState icon={<Stethoscope />} title="ماكو أطباء هنا بعد">جرّب مدينة أو اختصاص ثاني.</EmptyState></div>
        : <div className="dir-grid">{l!.doctors.map((doc) => {
            const c = doc.clinics[0];
            return (
              <Link key={doc.slug} to={doctorPath(doc)} className="card dir-card">
                <Avatar name={doc.name} src={mediaUrl(doc.photo_path)} />
                <div className="grow stack-sm" style={{ gap: 2 }}>
                  <strong>{doc.name}</strong>
                  <span className="small muted">{[doc.title, doc.specialty].filter(Boolean).join(' · ')}</span>
                  <span className="small row" style={{ gap: 4 }}><MapPin size={14} aria-hidden />{c.facility_name}{c.area ? `، ${c.area}` : ''}</span>
                  <span className="row" style={{ gap: 6 }}>
                    {doc.verified && <Badge tone="success" icon={<BadgeCheck aria-hidden />}>ترخيص تمت مراجعته</Badge>}
                    {c.min_price_minor != null && <Badge>من {formatMoney(c.min_price_minor)}</Badge>}
                  </span>
                </div>
              </Link>
            );
          })}</div>}
      <p className="small"><Link to={labsPath(l!.city?.slug)}><FlaskConical size={14} aria-hidden /> المختبرات{l!.city ? ` في ${l!.city.name}` : ''}</Link></p>
    </div>
  );
}

/** /labs, /labs/:city */
export function LabsDirectory() {
  const { city } = useParams();
  const dir = useAsync(loadDirectory, []);
  const c = dir.data && city ? dir.data.cities.find((x) => x.slug === city) ?? null : null;
  const title = c ? `مختبرات ${c.name}` : 'مختبرات التحليلات';
  useTitle(dir.data ? `${title} | أبيض` : null);
  if (dir.status === 'loading' && !dir.data) return <div className="card"><SkeletonList rows={4} /></div>;
  if (dir.status === 'error') return <div className="card"><ErrorState error={dir.error} onRetry={dir.reload} /></div>;
  const labs = dir.data!.labs.filter((l) => !c || l.city_slug === c.slug);
  return (
    <div className="stack">
      <PageHead title={title} subtitle={`${labs.length} مختبر · احجز تحليلك أو اطلب السحب من البيت`} />
      <div className="chips" role="list">
        <Link role="listitem" className={`chip ${!c ? 'on' : ''}`} to={labsPath()}>كل المدن</Link>
        {dir.data!.cities.filter((x) => x.labs).map((x) => <Link role="listitem" key={x.slug} className={`chip ${c?.slug === x.slug ? 'on' : ''}`} to={labsPath(x.slug)}>{x.name}</Link>)}
      </div>
      <div className="dir-grid">{labs.map((l) => (
        <Link key={l.slug} to={labPath(l)} className="card dir-card">
          <span className="dir-ico"><FlaskConical size={22} aria-hidden /></span>
          <div className="grow stack-sm" style={{ gap: 2 }}>
            <strong>{l.name}</strong>
            <span className="small row" style={{ gap: 4 }}><MapPin size={14} aria-hidden />{[l.area, l.city].filter(Boolean).join('، ')}</span>
          </div>
        </Link>
      ))}</div>
      <p className="small"><Link to={doctorsPath(c?.slug)}>الأطباء{c ? ` في ${c.name}` : ''}</Link></p>
    </div>
  );
}

/** /doctor/:slug and /lab/:slug → the usual provider page. */
export function ProviderBySlug({ kind }: { kind: 'doctor' | 'lab' }) {
  const { slug = '' } = useParams();
  const dir = useAsync(loadDirectory, []);
  const id = idFromSlug(slug);
  const doc = kind === 'doctor' ? dir.data?.doctors.find((d) => d.slug === slug || (id && d.slug.endsWith(`-${id}`))) : undefined;
  const lab = kind === 'lab' ? dir.data?.labs.find((l) => l.slug === slug || (id && l.slug.endsWith(`-${id}`))) : undefined;
  useTitle(doc ? `${doc.name}${doc.specialty ? ` — ${doc.specialty}` : ''} | أبيض` : lab ? `${lab.name} | أبيض` : null);
  if (dir.status === 'loading' && !dir.data) return <div className="card"><SkeletonList rows={3} /></div>;
  if (dir.status === 'error') return <div className="card"><ErrorState error={dir.error} onRetry={dir.reload} /></div>;
  if (!doc && !lab) return <div className="card"><EmptyState icon={<Stethoscope />} title="الصفحة غير متاحة">قد يكون الملف غير منشور حالياً. <Link to={kind === 'doctor' ? doctorsPath() : labsPath()}>تصفّح الدليل</Link></EmptyState></div>;
  return doc
    ? <ProviderPage facilityId={doc.clinics[0].facility_id} practitionerId={doc.practitioner_id} />
    : <ProviderPage facilityId={lab!.facility_id} />;
}
