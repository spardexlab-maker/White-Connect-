import { useCallback, useMemo, useState } from 'react';
import { BellRing, CalendarDays, DoorOpen, Lock, Stethoscope } from 'lucide-react';
import { errorMessage, formatDate, formatTime, localDateKey } from '@app/shared';
import { supabase } from '../../lib/supabase';
import { unwrap, useAsync } from '../../lib/useAsync';
import { useAuth } from '../../lib/auth';
import { useWorkspace } from '../../lib/workspace';
import { Alert, AppointmentStatusBadge, Badge, Button, EmptyState, ErrorState, Ltr, PageHead, QueueStatusBadge, SkeletonList, useToast } from '../../components/ui';
import { useFacilityRealtime, type BoardRow, type QueueRow } from './Reception';

/**
 * Doctor's day: own appointments at the CURRENT location + arrival queue.
 * The doctor chooses whom to call next. Clinical sessions (encounters,
 * prescriptions, lab orders) are Phase 3 — the session button explains why
 * it is unavailable instead of pretending to work.
 */
export function DoctorToday() {
  const { access } = useAuth();
  const { current } = useWorkspace();
  const toast = useToast();
  const facilityId = current!.facility_id!;
  const tz = current!.timezone;
  const me = access?.practitioner_id ?? undefined;
  const today = useMemo(() => localDateKey(new Date(), tz), [tz]);
  const [busy, setBusy] = useState<string | null>(null);

  const board = useAsync(async () => (me ? ((await unwrap(supabase.rpc('facility_day_board', { p_facility_id: facilityId, p_date: today, p_practitioner_id: me }))) as BoardRow[]) : []), [facilityId, today, me]);
  const queue = useAsync(async () => (me ? ((await unwrap(supabase.rpc('facility_queue', { p_facility_id: facilityId, p_date: today, p_practitioner_id: me }))) as QueueRow[]) : []), [facilityId, today, me]);
  const reload = useCallback(() => { board.reload(); queue.reload(); }, [board.reload, queue.reload]); // eslint-disable-line react-hooks/exhaustive-deps
  useFacilityRealtime(facilityId, reload);

  const waiting = (queue.data ?? []).filter((q) => ['waiting', 'called'].includes(q.status));
  const call = async (q: QueueRow) => {
    setBusy(q.queue_entry_id);
    const { error } = await supabase.rpc('update_queue_entry', { p_queue_entry_id: q.queue_entry_id, p_status: 'called' });
    setBusy(null);
    if (error) toast(errorMessage(error), 'danger'); else toast(`تم نداء ${q.patient_name}`, 'success');
    reload();
  };

  return (
    <div className="stack">
      <PageHead title="اليوم والطابور" subtitle={<>{current!.facility_name} — {current!.branch_name} · {formatDate(new Date(), tz)}</>} />
      <Alert tone="info" title="الصيدلية والمختبر الافتراضيان لهذا الموقع">
        الإحالات من هذا الموقع تذهب افتراضياً إلى جهات فرع «{current!.branch_name}» ويمكن تغييرها صراحة عند الإرسال (تُفعّل مع الوصفات في المرحلة الثالثة).
      </Alert>
      <div className="board">
        <section className="card card-flush" aria-labelledby="today-title">
          <div className="card-header"><h2 id="today-title">مرضى اليوم</h2><span className="muted small num">{board.data?.length ?? 0}</span></div>
          {board.status === 'loading' && !board.data && <SkeletonList rows={4} />}
          {board.status === 'error' && <ErrorState error={board.error} onRetry={board.reload} />}
          {board.data?.length === 0 && <EmptyState icon={<CalendarDays />} title="لا توجد مواعيد اليوم في هذا الموقع" />}
          {board.data?.map((r) => (
            <div key={r.appointment_id} className="appt-row">
              <div className="time num">{formatTime(r.starts_at, tz)}</div>
              <div className="who">
                <strong className="truncate">{r.patient_name}</strong>
                <span className="small muted"><Ltr>{r.patient_code}</Ltr> · {r.service_name}</span>
              </div>
              <div className="actions"><AppointmentStatusBadge status={r.status} /></div>
            </div>
          ))}
        </section>
        <aside className="card card-flush" aria-labelledby="dq-title">
          <div className="card-header"><h2 id="dq-title">الحاضرون</h2><Badge tone="info">{waiting.length} ينتظر</Badge></div>
          {queue.status === 'loading' && !queue.data && <SkeletonList rows={3} />}
          {queue.status === 'error' && <ErrorState error={queue.error} onRetry={queue.reload} />}
          {queue.data && waiting.length === 0 && <EmptyState icon={<DoorOpen />} title="لا يوجد مرضى حاضرون حالياً" />}
          {waiting.map((q) => (
            <div key={q.queue_entry_id} className="queue-item">
              <span className="pos num">{q.queue_position}</span>
              <div className="grow stack-sm" style={{ gap: 2 }}>
                <div className="row-between"><strong>{q.patient_name}</strong><QueueStatusBadge status={q.status} /></div>
                <span className="small muted">{q.kind === 'walk_in' ? 'عابر' : `موعد ${formatTime(q.appointment_start!, tz)}`} · وصل {formatTime(q.arrived_at, tz)}</span>
                <div className="row" style={{ gap: 'var(--s-2)', marginBlockStart: 4 }}>
                  <Button size="sm" variant="secondary" icon={<BellRing size={16} />} loading={busy === q.queue_entry_id} onClick={() => call(q)} disabled={q.status === 'called'}>نداء</Button>
                  <Button size="sm" variant="ghost" icon={<Lock size={16} />} aria-disabled="true"
                          onClick={() => toast('بدء الجلسة الطبية وتوثيقها والوصفة وطلب التحليل ضمن المرحلة الثالثة — غير مفعّلة بعد.')}>بدء الجلسة</Button>
                </div>
              </div>
            </div>
          ))}
          <div style={{ padding: 'var(--s-4)' }} className="small muted">
            <Stethoscope size={14} aria-hidden style={{ verticalAlign: '-2px' }} /> مرور الوقت لا يبدأ الجلسة ولا ينهيها؛ يتم ذلك بضغطك فقط.
          </div>
        </aside>
      </div>
    </div>
  );
}
