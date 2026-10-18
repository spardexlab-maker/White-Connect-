import { useMemo, useState } from 'react';
import { CalendarCheck2, FlaskConical, Pill, Route } from 'lucide-react';
import { formatDate, formatTime, type AppointmentStatus } from '@app/shared';
import { supabase } from '../../lib/supabase';
import { unwrap, useAsync } from '../../lib/useAsync';
import { useAuth } from '../../lib/auth';
import { Alert, AppointmentStatusBadge, EmptyState, ErrorState, SkeletonList } from '../../components/ui';
import { SignInPrompt } from './Account';

interface Row { appointment_id: string; status: AppointmentStatus; starts_at: string; timezone: string; facility_name: string; practitioner_name: string | null; service_name: string; patient_name: string }
type Filter = 'all' | 'visits' | 'prescriptions' | 'labs';

/**
 * Medical journey timeline. In this phase it contains visits (appointments).
 * Prescriptions and lab results join the same timeline when Phase 3/4 ship;
 * their filters are visible but clearly marked as not yet available.
 */
export function Journey() {
  const { session } = useAuth();
  const [filter, setFilter] = useState<Filter>('all');
  const list = useAsync(async () => (session ? ((await unwrap(supabase.rpc('my_appointments'))) as Row[]) : []), [session?.user.id]);
  const events = useMemo(() => (list.data ?? []).filter((r) => !['expired'].includes(r.status)), [list.data]);
  if (!session) return <SignInPrompt title="رحلتي الطبية" />;

  const groups = new Map<string, Row[]>();
  for (const e of events) {
    const k = formatDate(e.starts_at, e.timezone);
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }

  return (
    <div className="stack">
      <h1 style={{ fontSize: 'var(--f-h2)' }}>رحلتي الطبية</h1>
      <div className="chips" role="group" aria-label="تصفية الأحداث">
        <button className="chip" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>الكل</button>
        <button className="chip" aria-pressed={filter === 'visits'} onClick={() => setFilter('visits')}><CalendarCheck2 size={14} aria-hidden />الزيارات</button>
        <button className="chip" aria-pressed={filter === 'prescriptions'} onClick={() => setFilter('prescriptions')}><Pill size={14} aria-hidden />الوصفات</button>
        <button className="chip" aria-pressed={filter === 'labs'} onClick={() => setFilter('labs')}><FlaskConical size={14} aria-hidden />التحاليل</button>
      </div>
      {(filter === 'prescriptions' || filter === 'labs') ? (
        <div className="card">
          <EmptyState icon={filter === 'labs' ? <FlaskConical /> : <Pill />} title={filter === 'labs' ? 'نتائج التحاليل غير مفعّلة بعد' : 'الوصفات الإلكترونية غير مفعّلة بعد'}>
            ستظهر هنا {filter === 'labs' ? 'النتائج المعتمدة من المختبر' : 'الوصفات المعتمدة من الطبيب'} مرتبطة بالزيارة نفسها عند تفعيل المرحلة الثالثة من المنصة.
          </EmptyState>
        </div>
      ) : (
        <div className="card">
          {list.status === 'loading' && !list.data && <SkeletonList rows={3} />}
          {list.status === 'error' && <ErrorState error={list.error} onRetry={list.reload} />}
          {list.data && events.length === 0 && <EmptyState icon={<Route />} title="لا توجد أحداث بعد">بعد أول حجز أو زيارة ستتجمع الأحداث هنا بترتيب زمني.</EmptyState>}
          {events.length > 0 && (
            <ol className="timeline">
              {[...groups.entries()].map(([dateLabel, rows]) => rows.map((r, i) => (
                <li key={r.appointment_id}>
                  <span className="dot" aria-hidden><CalendarCheck2 size={12} color="var(--c-accent)" /></span>
                  {i === 0 && <div className="label-text" style={{ marginBlockEnd: 4 }}>{dateLabel}</div>}
                  <div className="card" style={{ padding: 'var(--s-3)' }}>
                    <div className="row-between">
                      <strong>زيارة — {r.service_name}</strong>
                      <AppointmentStatusBadge status={r.status} />
                    </div>
                    <div className="small muted">{r.practitioner_name ?? r.facility_name} · {r.facility_name} · <span className="num">{formatTime(r.starts_at, r.timezone)}</span></div>
                    <div className="small muted">{r.patient_name}</div>
                  </div>
                </li>
              )))}
            </ol>
          )}
        </div>
      )}
      <Alert tone="info" title="عن هذه الصفحة">
        تعرض الرحلة ما اعتمده المهنيون الصحيون. الملاحظات الداخلية والمسودات لا تُنشر لك تلقائياً.
      </Alert>
    </div>
  );
}
