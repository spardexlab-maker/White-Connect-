import { Fragment, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BadgeCheck, CalendarPlus, Clock, MapPin, Navigation, Phone, ShieldAlert, Wallet } from 'lucide-react';
import { directionsUrl, formatMoney, mapEmbedUrl, wazeUrl, weekdayLabel } from '@app/shared';
import { supabase } from '../../lib/supabase';
import { unwrap, useAsync } from '../../lib/useAsync';
import { fetchProviderMedia, mediaUrl } from '../../lib/media';
import { MediaGallery } from '../../components/MediaGallery';
import { Alert, Avatar, Badge, EmptyState, ErrorState, Ltr, SkeletonList, Tabs } from '../../components/ui';

export interface ProviderProfile {
  facility: {
    id: string; name: string; type: 'clinic' | 'laboratory' | 'pharmacy'; description: string | null; phone: string | null;
    opening_hours_note: string | null; organization_name: string; branch_name: string; area: string | null;
    address: string | null; city: string | null; latitude: number | null; longitude: number | null; timezone: string;
  };
  practitioner: { id: string; full_name: string; title: string | null; bio: string | null; specialty: string | null; license_verified: boolean } | null;
  services: { id: string; name: string; description: string | null; duration_minutes: number; price_minor: number | null; currency: string; preparation_note: string | null }[];
  weekly_hours: { weekday: number; start: string; end: string }[];
  policy: { confirmation_mode: 'manual' | 'auto'; confirmation_timeout_minutes: number; cancellation_cutoff_minutes: number; cancellation_policy_text: string | null; booking_window_days: number };
}

export function useProviderProfile(facilityId?: string, practitionerId?: string) {
  return useAsync(async () => {
    const data = await unwrap(supabase.rpc('get_provider_profile', { p_facility_id: facilityId!, p_practitioner_id: practitionerId }));
    return data as unknown as ProviderProfile | null;
  }, [facilityId, practitionerId]);
}

type Tab = 'about' | 'services' | 'location';

/** Opened from the search (ids in the URL) or from a public doctor/lab page (ids passed in). */
export function ProviderPage(props: { facilityId?: string; practitionerId?: string } = {}) {
  const params = useParams();
  const facilityId = props.facilityId ?? params.facilityId;
  const practitionerId = props.facilityId ? props.practitionerId : params.practitionerId;
  const profile = useProviderProfile(facilityId, practitionerId);
  const [tab, setTab] = useState<Tab>('about');
  const media = useAsync(() => (facilityId ? fetchProviderMedia(facilityId, practitionerId) : Promise.resolve(null)), [facilityId, practitionerId]);

  if (profile.status === 'loading') return <div className="card"><SkeletonList rows={3} /></div>;
  if (profile.status === 'error') return <div className="card"><ErrorState error={profile.error} onRetry={profile.reload} /></div>;
  const p = profile.data;
  if (!p) return <div className="card"><EmptyState icon={<ShieldAlert />} title="مقدم الخدمة غير متاح">قد يكون الملف غير منشور حالياً.</EmptyState></div>;

  const name = p.practitioner?.full_name ?? p.facility.name;
  const bookHref = `/patient/book/${p.facility.id}${p.practitioner ? `/${p.practitioner.id}` : ''}`;
  const where = p.facility.latitude != null && p.facility.longitude != null ? { lat: p.facility.latitude, lng: p.facility.longitude } : null;
  const hoursByDay = groupHours(p.weekly_hours);

  return (
    <div className="stack" style={{ gap: 'var(--s-5)' }}>
      <section className="card stack">
        <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
          <Avatar name={name} size="lg" src={mediaUrl(media.data?.photo)} />
          <div className="grow stack-sm" style={{ gap: 4 }}>
            <h1 style={{ fontSize: 'var(--f-h2)' }}>{name}</h1>
            {p.practitioner && <div className="muted">{p.practitioner.title}{p.practitioner.specialty ? ` · ${p.practitioner.specialty}` : ''}</div>}
            <div className="small">{p.facility.name} — {p.facility.branch_name}</div>
            <div className="row" style={{ gap: 'var(--s-2)' }}>
              {p.practitioner?.license_verified && <Badge tone="success" icon={<BadgeCheck aria-hidden />}>ترخيص تمت مراجعته</Badge>}
              <Badge tone={p.policy.confirmation_mode === 'auto' ? 'success' : 'warning'}>
                {p.policy.confirmation_mode === 'auto' ? 'تأكيد فوري' : 'يتطلب تأكيد العيادة'}
              </Badge>
            </div>
          </div>
        </div>
      </section>

      {!!media.data?.clinic_photos.length && (
        <section className="card stack-sm" aria-label="صور العيادة">
          <h2 className="section-title">صور {p.practitioner ? 'العيادة' : 'المكان'}</h2>
          <div className="media-strip">
            {media.data.clinic_photos.map((m) => (
              <a key={m.id} href={mediaUrl(m.path)!} target="_blank" rel="noreferrer noopener"><img src={mediaUrl(m.path)!} alt={m.caption ?? 'صورة العيادة'} loading="lazy" /></a>
            ))}
          </div>
        </section>
      )}

      <div className="card card-flush">
        <Tabs<Tab> label="معلومات مقدم الخدمة" value={tab} onChange={setTab}
              tabs={[{ id: 'about', label: p.practitioner ? 'عن الطبيب' : 'عن المختبر' }, { id: 'services', label: 'الخدمات والمواعيد' }, { id: 'location', label: 'الموقع' }]} />
        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} style={{ padding: 'var(--s-4)' }} className="stack">
          {tab === 'about' && (
            <>
              <p>{p.practitioner?.bio ?? p.facility.description ?? 'لا توجد نبذة منشورة.'}</p>
              <div className="stack-sm">
                <h2 className="section-title">أيام العمل</h2>
                {hoursByDay.length ? (
                  <dl className="summary-list">
                    {hoursByDay.map(([d, ranges]) => (<Fragment key={d}><dt>{weekdayLabel[d]}</dt><dd className="num">{ranges}</dd></Fragment>))}
                  </dl>
                ) : <span className="muted small">{p.facility.opening_hours_note ?? 'غير منشورة'}</span>}
              </div>
              {!!media.data?.certificates.length && (
                <div className="stack-sm">
                  <h2 className="section-title">الشهادات</h2>
                  <MediaGallery items={media.data.certificates} />
                </div>
              )}
              <Alert tone="info" title="سياسة الإلغاء">
                {p.policy.cancellation_policy_text ?? `يمكن الإلغاء قبل ${Math.round(p.policy.cancellation_cutoff_minutes / 60)} ساعة من الموعد.`}
              </Alert>
            </>
          )}
          {tab === 'services' && (
            p.services.length ? (
              <ul className="list" style={{ margin: 0, padding: 0 }}>
                {p.services.map((s) => (
                  <li key={s.id} className="list-item" style={{ paddingInline: 0 }}>
                    <div className="grow">
                      <strong>{s.name}</strong>
                      <div className="muted small row" style={{ gap: 'var(--s-3)' }}>
                        <span><Clock size={14} aria-hidden style={{ verticalAlign: '-2px' }} /> {s.duration_minutes} دقيقة</span>
                        <span><Wallet size={14} aria-hidden style={{ verticalAlign: '-2px' }} /> {formatMoney(s.price_minor, s.currency)}</span>
                      </div>
                      {s.preparation_note && <div className="small" style={{ color: 'var(--c-warning)' }}>{s.preparation_note}</div>}
                    </div>
                    <Link className="btn btn-secondary btn-sm" to={`${bookHref}?service=${s.id}`}>اختيار</Link>
                  </li>
                ))}
              </ul>
            ) : <EmptyState icon={<CalendarPlus />} title="لا توجد خدمات منشورة للحجز" />
          )}
          {tab === 'location' && (
            <div className="stack-sm">
              <div className="row"><MapPin size={18} aria-hidden /><span>{[p.facility.address, p.facility.area, p.facility.city].filter(Boolean).join('، ')}</span></div>
              {p.facility.phone && <div className="row"><Phone size={18} aria-hidden /><a href={`tel:${p.facility.phone}`}><Ltr>{p.facility.phone}</Ltr></a></div>}
              {where && (
                <div className="clinic-map stack-sm">
                  <iframe title={`موقع ${p.facility.name} على الخريطة`} src={mapEmbedUrl(where)} loading="lazy" />
                  <div className="row" style={{ gap: 'var(--s-2)', flexWrap: 'wrap' }}>
                    <a className="btn btn-primary" href={directionsUrl(where)} target="_blank" rel="noreferrer noopener"><Navigation size={16} aria-hidden />الاتجاهات (خرائط Google)</a>
                    <a className="btn btn-secondary" href={wazeUrl(where)} target="_blank" rel="noreferrer noopener">Waze</a>
                  </div>
                  <span className="map-attrib">الخريطة © مساهمو OpenStreetMap</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="sticky-cta-spacer" />
      <div className="sticky-cta">
        <div className="grow small">
          <strong style={{ display: 'block' }}>{name}</strong>
          <span className="muted">{p.services[0] ? `يبدأ من ${formatMoney(Math.min(...p.services.map((s) => s.price_minor ?? Infinity)))}` : ''}</span>
        </div>
        <Link to={bookHref} className="btn btn-primary"><CalendarPlus size={18} aria-hidden />احجز موعداً</Link>
      </div>
    </div>
  );
}

function groupHours(rows: ProviderProfile['weekly_hours']): [number, string][] {
  const map = new Map<number, string[]>();
  for (const r of rows) {
    const list = map.get(r.weekday) ?? [];
    list.push(`${r.start.slice(0, 5)} – ${r.end.slice(0, 5)}`);
    map.set(r.weekday, list);
  }
  // Saturday-first week order common in Iraq
  return [6, 0, 1, 2, 3, 4, 5].filter((d) => map.has(d)).map((d) => [d, map.get(d)!.join('، ')]);
}
