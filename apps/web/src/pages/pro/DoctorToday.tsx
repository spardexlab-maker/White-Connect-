import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertOctagon, BellRing, CalendarDays, ClipboardCheck, DoorOpen, Play, Stethoscope } from 'lucide-react';
import { encounterStatus, errorMessage, formatDate, formatDateTime, formatTime, localDateKey, type EncounterStatus } from '@app/shared';
import { supabase } from '../../lib/supabase';
import { unwrap, useAsync } from '../../lib/useAsync';
import { useAuth } from '../../lib/auth';
import { useWorkspace } from '../../lib/workspace';
import { Alert, AppointmentStatusBadge, Badge, Button, ConfirmDialog, EmptyState, ErrorState, Ltr, PageHead, QueueStatusBadge, SkeletonList, useToast } from '../../components/ui';
import { useFacilityRealtime, type BoardRow, type QueueRow } from './Reception';

interface Task { task_id: string; kind: string; created_at: string; patient_name: string; patient_code: string; lab_order_id: string | null; order_number: string | null; encounter_id: string | null; has_critical: boolean }
interface OpenEnc { id: string; status: EncounterStatus; started_at: string; patients: { full_name: string; public_code: string } | null }

/**
 * Doctor's day at the CURRENT location: today's list, arrivals (the doctor
 * chooses whom to call/start), sessions waiting for results, and review
 * tasks for released lab results.
 */
export function DoctorToday() {
  const { access } = useAuth();
  const { current } = useWorkspace();
  const toast = useToast();
  const navigate = useNavigate();
  const facilityId = current!.facility_id!;
  const tz = current!.timezone;
  const me = access?.practitioner_id ?? undefined;
  const today = useMemo(() => localDateKey(new Date(), tz), [tz]);
  const [busy, setBusy] = useState<string | null>(null);
  const [starting, setStarting] = useState<QueueRow | null>(null);

  const board = useAsync(async () => (me ? ((await unwrap(supabase.rpc('facility_day_board', { p_facility_id: facilityId, p_date: today, p_practitioner_id: me }))) as BoardRow[]) : []), [facilityId, today, me]);
  const queue = useAsync(async () => (me ? ((await unwrap(supabase.rpc('facility_queue', { p_facility_id: facilityId, p_date: today, p_practitioner_id: me }))) as QueueRow[]) : []), [facilityId, today, me]);
  const tasks = useAsync(async () => (await unwrap(supabase.rpc('my_clinical_tasks'))) as Task[], []);
  const openEnc = useAsync(async () => (me ? ((await unwrap(supabase.from('encounters').select('id, status, started_at, patients(full_name, public_code)')
    .eq('practitioner_id', me).eq('facility_id', facilityId).in('status', ['in_progress', 'awaiting_results', 'ready_for_review'])
    .order('started_at', { ascending: false }))) as unknown as OpenEnc[]) : []), [me, facilityId]);
  const reload = useCallback(() => { board.reload(); queue.reload(); openEnc.reload(); tasks.reload(); }, [board.reload, queue.reload, openEnc.reload, tasks.reload]); // eslint-disable-line react-hooks/exhaustive-deps
  useFacilityRealtime(facilityId, reload);

  const waiting = (queue.data ?? []).filter((q) => ['waiting', 'called'].includes(q.status));
  const inProgress = openEnc.data?.find((e) => e.status === 'in_progress');

  const call = async (q: QueueRow) => {
    setBusy(q.queue_entry_id);
    const { error } = await supabase.rpc('update_queue_entry', { p_queue_entry_id: q.queue_entry_id, p_status: 'called' });
    setBusy(null);
    if (error) toast(errorMessage(error), 'danger'); else toast(`تم نداء ${q.patient_name}`, 'success');
    reload();
  };
  const start = async () => {
    if (!starting) return;
    setBusy(starting.queue_entry_id);
    const { data, error } = await supabase.rpc('start_encounter', { p_queue_entry_id: starting.queue_entry_id, p_identity_verified: true });
    setBusy(null); setStarting(null);
    if (error) { toast(errorMessage(error), 'danger'); return; }
    navigate(`/workspace/doctor/session/${(data as { id: string }).id}`);
  };
  const doneTask = async (t: Task) => {
    const { error } = await supabase.rpc('complete_clinical_task', { p_task_id: t.task_id });
    if (error) toast(errorMessage(error), 'danger'); else tasks.reload();
  };

  return (
    <div className="stack">
      <PageHead title="اليوم والطابور" subtitle={<>{current!.facility_name} — {current!.branch_name} · {formatDate(new Date(), tz)}</>} />
      {inProgress && (
        <Alert tone="info" title={`جلسة جارية: ${inProgress.patients?.full_name ?? ''}`}
               action={<Link className="btn btn-primary btn-sm" to={`/workspace/doctor/session/${inProgress.id}`}>متابعة الجلسة</Link>}>
          بدأت {formatTime(inProgress.started_at, tz)}. أنهِها أو حوّلها لانتظار النتائج قبل بدء جلسة أخرى.
        </Alert>
      )}

      {!!tasks.data?.length && (
        <section className="card card-flush" aria-labelledby="tasks-title">
          <div className="card-header"><h2 id="tasks-title" className="row"><ClipboardCheck size={18} aria-hidden />نتائج تحتاج مراجعة</h2><Badge tone="warning">{tasks.data.length}</Badge></div>
          {tasks.data.map((t) => (
            <div key={t.task_id} className="list-item">
              {t.has_critical ? <AlertOctagon size={20} color="var(--c-danger)" aria-label="قيمة حرجة حسب المختبر" /> : <ClipboardCheck size={20} aria-hidden />}
              <div className="grow">
                <strong>{t.patient_name}</strong> <span className="small muted"><Ltr>{t.patient_code}</Ltr></span>
                <div className="small">{t.kind === 'review_corrected_result' ? 'نتيجة مصححة' : 'نتيجة معتمدة'} · طلب <Ltr>{t.order_number}</Ltr> · {formatDateTime(t.created_at, tz)}
                  {t.has_critical && <span className="flag-critical"> · قيمة حددها المختبر كحرجة</span>}</div>
              </div>
              {t.lab_order_id && <Link className="btn btn-secondary btn-sm" to={`/workspace/doctor/lab/${t.lab_order_id}`}>عرض النتيجة</Link>}
              {t.encounter_id && <Link className="btn btn-ghost btn-sm" to={`/workspace/doctor/session/${t.encounter_id}`}>الجلسة</Link>}
              <Button size="sm" variant="ghost" onClick={() => doneTask(t)}>تمت المراجعة</Button>
            </div>
          ))}
        </section>
      )}

      <div className="board">
        <section className="card card-flush" aria-labelledby="today-title">
          <div className="card-header"><h2 id="today-title">مرضى اليوم</h2><span className="muted small num">{board.data?.length ?? 0}</span></div>
          {board.status === 'loading' && !board.data && <SkeletonList rows={4} />}
          {board.status === 'error' && <ErrorState error={board.error} onRetry={board.reload} />}
          {board.data?.length === 0 && <EmptyState icon={<CalendarDays />} title="لا توجد مواعيد اليوم في هذا الموقع" />}
          {board.data?.map((r) => (
            <div key={r.appointment_id} className="appt-row">
              <div className="time num">{formatTime(r.starts_at, tz)}</div>
              <div className="who"><strong className="truncate">{r.patient_name}</strong><span className="small muted"><Ltr>{r.patient_code}</Ltr> · {r.service_name}</span></div>
              <div className="actions"><AppointmentStatusBadge status={r.status} /></div>
            </div>
          ))}
          {!!openEnc.data?.filter((e) => e.status !== 'in_progress').length && (
            <>
              <div className="card-header" style={{ borderBlockStart: '1px solid var(--c-border)' }}><h2>جلسات مفتوحة</h2></div>
              {openEnc.data.filter((e) => e.status !== 'in_progress').map((e) => (
                <div key={e.id} className="list-item">
                  <div className="grow"><strong>{e.patients?.full_name}</strong> <span className="small muted">· {formatDateTime(e.started_at, tz)}</span></div>
                  <Badge tone={encounterStatus[e.status].tone}>{encounterStatus[e.status].label}</Badge>
                  <Link className="btn btn-ghost btn-sm" to={`/workspace/doctor/session/${e.id}`}>فتح</Link>
                </div>
              ))}
            </>
          )}
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
                  <Button size="sm" icon={<Play size={16} />} disabled={!!inProgress} onClick={() => setStarting(q)}>بدء الجلسة</Button>
                </div>
              </div>
            </div>
          ))}
          <div style={{ padding: 'var(--s-4)' }} className="small muted">
            <Stethoscope size={14} aria-hidden style={{ verticalAlign: '-2px' }} /> مرور الوقت لا يبدأ الجلسة ولا ينهيها؛ يتم ذلك بضغطك فقط.
          </div>
        </aside>
      </div>
      <ConfirmDialog open={!!starting} title="التحقق من هوية المريض" confirmLabel="تأكيد الهوية وبدء الجلسة" loading={!!starting && busy === starting.queue_entry_id}
                     onCancel={() => setStarting(null)} onConfirm={start}>
        <p>تأكد أن المريض أمامك هو: <strong>{starting?.patient_name}</strong> (<Ltr>{starting?.patient_code}</Ltr>).</p>
        <p className="small muted">سيُسجل وقت البدء الفعلي الآن.</p>
      </ConfirmDialog>
    </div>
  );
}
