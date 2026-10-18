import { useMemo, useState } from 'react';
import { BadgeCheck, Phone, Search, Stethoscope, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { unwrap, useAsync } from '../../lib/useAsync';
import { useWorkspace } from '../../lib/workspace';
import { Avatar, Badge, EmptyState, ErrorState, Ltr, PageHead, SkeletonList } from '../../components/ui';

interface Doc { practitioner_id: string; full_name: string; title: string | null; specialty: string | null; license_verified: boolean; facility_id: string; facility_name: string; branch_name: string; phone: string | null }

/** Directory of the doctors who work in the same complex (pharmacy / lab staff). */
export function ComplexDoctors() {
  const { current } = useWorkspace();
  const facilityId = current!.facility_id!;
  const [q, setQ] = useState('');
  const docs = useAsync(async () => (await unwrap(supabase.rpc('organization_doctors', { p_facility_id: facilityId }))) as Doc[], [facilityId]);
  const shown = useMemo(() => {
    const t = q.trim();
    return (docs.data ?? []).filter((d) => !t || [d.full_name, d.specialty, d.facility_name].some((x) => x?.includes(t)));
  }, [docs.data, q]);

  return (
    <div className="stack">
      <PageHead title="أطباء المجمع" subtitle={current!.organization_name} />
      <div className="input-icon" style={{ maxWidth: 420 }}>
        <Search size={18} aria-hidden />
        <label className="sr-only" htmlFor="dq">بحث</label>
        <input id="dq" className="input" type="search" placeholder="ابحث بالاسم أو التخصص أو العيادة" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <section className="card card-flush">
        {docs.status === 'loading' && !docs.data && <SkeletonList rows={3} />}
        {docs.status === 'error' && <ErrorState error={docs.error} onRetry={docs.reload} />}
        {docs.data && shown.length === 0 && (
          <EmptyState icon={<Users />} title={docs.data.length ? 'لا توجد نتائج' : 'لا يوجد أطباء مسجلون في هذا المجمع'}>
            {docs.data.length ? 'جرّب كلمة بحث أخرى.' : 'إذا كانت هذه جهة مستقلة فلا يوجد مجمع مرتبط بها.'}
          </EmptyState>
        )}
        <ul className="list reveal" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {shown.map((d) => (
            <li key={`${d.practitioner_id}:${d.facility_id}`} className="list-item">
              <Avatar name={d.full_name} />
              <div className="grow" style={{ minWidth: 0 }}>
                <strong className="row" style={{ gap: 6 }}>{d.full_name}{d.license_verified && <BadgeCheck size={16} color="var(--c-accent)" aria-label="ترخيص تمت مراجعته" />}</strong>
                <span className="small muted">{[d.title, d.specialty].filter(Boolean).join(' · ')}</span>
              </div>
              <div className="stack-sm" style={{ alignItems: 'flex-end', gap: 2 }}>
                <Badge tone="accent" icon={<Stethoscope aria-hidden />}>{d.facility_name}</Badge>
                {d.phone && <a className="small" href={`tel:${d.phone}`}><Phone size={13} aria-hidden style={{ verticalAlign: '-2px' }} /> <Ltr>{d.phone}</Ltr></a>}
              </div>
            </li>
          ))}
        </ul>
      </section>
      <p className="small muted">دليل للتواصل فقط: الأسماء والتخصصات والعيادات. لا يعرض بيانات مرضى.</p>
    </div>
  );
}
