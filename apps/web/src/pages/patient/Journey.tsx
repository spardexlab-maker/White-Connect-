import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck2, FlaskConical, Pill, Route, Stethoscope } from 'lucide-react';
import { appointmentStatus, encounterStatus, formatDate, formatTime, labStatus, type AppointmentStatus, type EncounterStatus, type LabStatus } from '@app/shared';
import { supabase } from '../../lib/supabase';
import { unwrap, useAsync } from '../../lib/useAsync';
import { useAuth } from '../../lib/auth';
import { Alert, Badge, EmptyState, ErrorState, SkeletonList } from '../../components/ui';
import { SignInPrompt } from './Account';

interface J { event_type: 'visit' | 'prescription' | 'lab'; occurred_at: string; ref_id: string; encounter_id: string | null; patient_name: string;
  facility_name: string; practitioner_name: string | null; status: string; title: string; corrected: boolean }
interface A { appointment_id: string; status: AppointmentStatus; starts_at: string; timezone: string; facility_name: string; practitioner_name: string | null; service_name: string; patient_name: string }
type Filter = 'all' | 'visits' | 'prescriptions' | 'labs';
type Ev = { kind: 'appointment' | J['event_type']; at: string; key: string; title: string; who: string; where: string; patient: string; badge: JSX.Element; link?: string; corrected?: boolean; group?: string | null };

/** One chronological journey; events of the same visit are grouped (§8, §23). */
export function Journey() {
  const { session } = useAuth();
  const [filter, setFilter] = useState<Filter>('all');
  const data = useAsync(async () => {
    if (!session) return { j: [] as J[], a: [] as A[] };
    const [j, a] = await Promise.all([unwrap(supabase.rpc('patient_journey')), unwrap(supabase.rpc('my_appointments'))]);
    return { j: j as J[], a: a as A[] };
  }, [session?.user.id]);

  const events = useMemo<Ev[]>(() => {
    if (!data.data) return [];
    const out: Ev[] = data.data.a.filter((x) => !['expired', 'fulfilled'].includes(x.status)).map((x) => ({
      kind: 'appointment', at: x.starts_at, key: `a${x.appointment_id}`, title: `موعد — ${x.service_name}`, who: x.practitioner_name ?? x.facility_name,
      where: x.facility_name, patient: x.patient_name, badge: <Badge tone={appointmentStatus[x.status].tone}>{appointmentStatus[x.status].label}</Badge>, link: '/patient/appointments' }));
    for (const e of data.data.j) {
      out.push({ kind: e.event_type, at: e.occurred_at, key: `${e.event_type}${e.ref_id}`, title: e.title, who: e.practitioner_name ?? '', where: e.facility_name,
        patient: e.patient_name, corrected: e.corrected, group: e.encounter_id,
        badge: e.event_type === 'visit' ? <Badge tone={encounterStatus[e.status as EncounterStatus].tone}>{encounterStatus[e.status as EncounterStatus].label}</Badge>
          : e.event_type === 'lab' ? <Badge tone={labStatus[e.status as LabStatus].tone}>{e.status === 'released' ? 'نتائج معتمدة' : labStatus[e.status as LabStatus].label}</Badge>
          : <Badge tone={e.status === 'active' ? 'success' : 'neutral'}>{e.status === 'active' ? 'معتمدة' : 'ملغاة'}</Badge>,
        link: e.event_type === 'prescription' ? `/patient/rx/${e.ref_id}` : e.event_type === 'lab' ? `/patient/labs/${e.ref_id}` : undefined });
    }
    return out.sort((x, y) => y.at.localeCompare(x.at)).filter((e) =>
      filter === 'all' || (filter === 'visits' && (e.kind === 'visit' || e.kind === 'appointment')) || (filter === 'prescriptions' && e.kind === 'prescription') || (filter === 'labs' && e.kind === 'lab'));
  }, [data.data, filter]);

  if (!session) return <SignInPrompt title="رحلتي الطبية" />;
  const icon = { appointment: <CalendarCheck2 size={12} />, visit: <Stethoscope size={12} />, prescription: <Pill size={12} />, lab: <FlaskConical size={12} /> };
  let lastDate = '';

  return (
    <div className="stack">
      <div className="row-between"><h1 style={{ fontSize: 'var(--f-h2)' }}>رحلتي الطبية</h1><Link to="/patient/meds" className="btn btn-secondary btn-sm"><Pill size={16} aria-hidden />خطة الدواء</Link></div>
      <div className="chips" role="group" aria-label="تصفية الأحداث">
        {([['all', 'الكل'], ['visits', 'الزيارات'], ['prescriptions', 'الوصفات'], ['labs', 'التحاليل']] as [Filter, string][]).map(([v, l]) =>
          <button key={v} className="chip" aria-pressed={filter === v} onClick={() => setFilter(v)}>{l}</button>)}
      </div>
      <div className="card">
        {data.status === 'loading' && !data.data && <SkeletonList rows={3} />}
        {data.status === 'error' && <ErrorState error={data.error} onRetry={data.reload} />}
        {data.data && events.length === 0 && <EmptyState icon={<Route />} title="لا توجد أحداث بعد">بعد أول حجز أو زيارة تتجمع الأحداث هنا بترتيب زمني.</EmptyState>}
        {events.length > 0 && (
          <ol className="timeline">
            {events.map((e) => {
              const d = formatDate(e.at); const showDate = d !== lastDate; lastDate = d;
              return (
                <li key={e.key}>
                  <span className="dot" aria-hidden>{icon[e.kind]}</span>
                  {showDate && <div className="label-text" style={{ marginBlockEnd: 4 }}>{d}</div>}
                  <div className="card" style={{ padding: 'var(--s-3)' }}>
                    <div className="row-between"><strong>{e.title}</strong><span className="row" style={{ gap: 4 }}>{e.corrected && <Badge tone="info">مصححة</Badge>}{e.badge}</span></div>
                    <div className="small muted">{[e.who, e.where].filter(Boolean).join(' · ')} · <span className="num">{formatTime(e.at)}</span> · {e.patient}</div>
                    {e.link && <Link to={e.link} className="small">التفاصيل</Link>}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
      <Alert tone="info" title="عن هذه الصفحة">تعرض الرحلة ما اعتمده المهنيون الصحيون: الوصفات المعتمدة والنتائج المنشورة. الملاحظات الداخلية والمسودات لا تُنشر لك تلقائياً.</Alert>
    </div>
  );
}
