import { loadPharmacyNotes } from './PharmacyNotes';
import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertOctagon, BellRing, CalendarDays, ClipboardCheck, DoorOpen, IdCard, Play, PlayCircle, Stethoscope } from 'lucide-react';
import { encounterStatus, errorMessage, formatDate, formatDateTime, formatTime, localDateKey, type EncounterStatus } from '@app/shared';
import { supabase } from '../../lib/supabase';
import { unwrap, useAsync } from '../../lib/useAsync';
import { useAuth } from '../../lib/auth';
import { useWorkspace } from '../../lib/workspace';
import { Alert, AppointmentStatusBadge, Badge, Button, ConfirmDialog, EmptyState, ErrorState, Ltr, PageHead, QueueStatusBadge, SkeletonList, useToast } from '../../components/ui';
import { laneOf, useFacilityRealtime, type BoardRow, type QueueRow } from './Reception';
import { MedicalCardSheet } from '../../components/clinical/MedicalCard';

interface Task { task_id: string; kind: string; created_at: string; patient_name: string; patient_code: string; lab_order_id: string | null; order_number: string | null; encounter_id: string | null; has_critical: boolean }
interface OpenEnc { id: string; status: EncounterStatus; started_at: string; paused_at: string | null; pause_reason: string | null; patients: { full_name: string; public_code: string } | null }

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
  const [cardFor, setCardFor] = useState<string | null>(null);

  const board = useAsync(async () => (me ? ((await unwrap(supabase.rpc('facility_day_board', { p_facility_id: facilityId, p_date: today, p_practitioner_id: me }))) as BoardRow[]) : []), [facilityId, today, me]);
  const queue = useAsync(async () => (me ? ((await unwrap(supabase.rpc('facility_queue', { p_facility_id: facilityId, p_date: today, p_practitioner_id: me }))) as QueueRow[]) : []), [facilityId, today, me]);
  const tasks = useAsync(async () => (await unwrap(supabase.rpc('my_clinical_tasks'))) as Task[], []);
  const openEnc = useAsync(async () => (me ? ((await unwrap(supabase.from('encounters').select('id, status, started_at, paused_at, pause_reason, patients(full_name, public_code)')
    .eq('practitioner_id', me).eq('facility_id', facilityId).in('status', ['in_progress', 'awaiting_results', 'ready_for_review'])
    .order('started_at', { ascending: false }))) as unknown as OpenEnc[]) : []), [me, facilityId]);
  const reload = useCallback(() => { board.reload(); queue.reload(); openEnc.reload(); tasks.reload(); }, [board.reload, queue.reload, openEnc.reload, tasks.reload]); // eslint-disable-line react-hooks/exhaustive-deps
  useFacilityRealtime(facilityId, reload);

  const waiting = (queue.data ?? []).filter((q) => ['waiting', 'called'].includes(q.status));
  // one ACTIVE session at a time; paused ones stay open alongside it
  const inProgress = openEnc.data?.find((e) => e.status === 'in_progress' && !e.paused_at);
  const others = (openEnc.data ?? []).filter((e) => e.id !== inProgress?.id);

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
    if (inProgress) {
      const { error: pauseErr } = await supabase.rpc('pause_encounter', { p_encounter_id: inProgress.id, p_reason: 'تبديل إلى مريض آخر' });
      if (pauseErr) { setBusy(null); setStarting(null); toast(errorMessage(pauseErr), 'danger'); return; }
    }
    const { data, error } = await supabase.rpc('start_encounter', { p_queue_entry_id: starting.queue_entry_id, p_identity_verified: true });
    setBusy(null); setStarting(null);
    if (error) { toast(errorMessage(error), 'danger'); return; }
    navigate(`/workspace/doctor/session/${(data as { id: string }).id}`);
  };
  const resume = async (e: OpenEnc) => {
    setBusy(e.id);
    const { error } = await supabase.rpc('resume_encounter', { p_encounter_id: e.id });
    setBusy(null);
    if (error) { toast(errorMessage(error), 'danger'); return; }
    navigate(`/workspace/doctor/session/${e.id}`);
  };
  const doneTask = async (t: Task) => {
    const { error } = await supabase.rpc('complete_clinical_task', { p_task_id: t.task_id });
    if (error) toast(errorMessage(error), 'danger'); else tasks.reload();
  };

  return (
    <div className="stack">
      <PageHead title="اليوم والطابور" subtitle={<>{current!.facility_name} — {current!.branch_name} · {formatDate(new Date(), tz)}</>} />
      <PharmacyNotesBanner />
      {inProgress && (
        <Alert tone="info" title={`جلسة جارية: ${inProgress.patients?.full_name ?? ''}`}
               action={<Link className="btn btn-primary btn-sm" to={`/workspace/doctor/session/${inProgress.id}`}>متابعة الجلسة</Link>}>
          بدأت {formatTime(inProgress.started_at, tz)}. يمكنك بدء جلسة مريض آخر وستتوقف هذه مؤقتاً، ثم تعود إليها من «جلسات مفتوحة».
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
            <div key={r.appointment_id} className="appt-row" data-lane={laneOf(r)}>
              <div className="time num">{formatTime(r.starts_at, tz)}</div>
              <div className="who"><strong className="truncate">{r.patient_name}</strong><span className="small muted"><Ltr>{r.patient_code}</Ltr> · {r.service_name}</span></div>
              <div className="actions"><AppointmentStatusBadge status={r.status} /></div>
            </div>
          ))}
          {others.length > 0 && (
            <>
              <div className="card-header" style={{ borderBlockStart: '1px solid var(--c-border)' }}><h2>جلسات مفتوحة</h2><span className="muted small num">{others.length}</span></div>
              {others.map((e) => {
                const isPaused = e.status === 'in_progress' && !!e.paused_at;
                return (
                  <div key={e.id} className="list-item">
                    <div className="grow"><strong>{e.patients?.full_name}</strong> <span className="small muted">· {formatDateTime(e.started_at, tz)}</span>
                      {isPaused && <div className="small muted">متوقفة منذ {formatTime(e.paused_at!, tz)}{e.pause_reason ? ` — ${e.pause_reason}` : ''}</div>}</div>
                    {isPaused ? <Badge tone="warning">متوقفة مؤقتاً</Badge> : <Badge tone={encounterStatus[e.status].tone}>{encounterStatus[e.status].label}</Badge>}
                    {isPaused
                      ? <Button size="sm" icon={<PlayCircle size={16} />} loading={busy === e.id} onClick={() => void resume(e)}>استئناف</Button>
                      : <Link className="btn btn-ghost btn-sm" to={`/workspace/doctor/session/${e.id}`}>فتح</Link>}
                  </div>
                );
              })}
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
                  <Button size="sm" variant="secondary" icon={<BellRing size={16} />} loading={busy === q.queue_entry_id} onClick={() => call(q)}>{q.status === 'called' ? 'نداء مرة ثانية' : 'نداء'}</Button>
                  <Button size="sm" icon={<Play size={16} />} onClick={() => setStarting(q)}>بدء الجلسة</Button>
                  <Button size="sm" variant="ghost" icon={<IdCard size={16} />} onClick={() => setCardFor(q.patient_id)}>البطاقة الطبية</Button>
                </div>
              </div>
            </div>
          ))}
          <div style={{ padding: 'var(--s-4)' }} className="small muted">
            <Stethoscope size={14} aria-hidden style={{ verticalAlign: '-2px' }} /> مرور الوقت لا يبدأ الجلسة ولا ينهيها؛ يتم ذلك بضغطك فقط.
          </div>
        </aside>
      </div>
      <RecentSessions tz={tz} />
      <ConfirmDialog open={!!starting} title="التحقق من هوية المريض" confirmLabel="تأكيد الهوية وبدء الجلسة" loading={!!starting && busy === starting.queue_entry_id}
                     onCancel={() => setStarting(null)} onConfirm={start}>
        <p>تأكد أن المريض أمامك هو: <strong>{starting?.patient_name}</strong> (<Ltr>{starting?.patient_code}</Ltr>).</p>
        <p className="small muted">سيُسجل وقت البدء الفعلي الآن.</p>
        {inProgress && <p className="small">ستتوقف جلسة <strong>{inProgress.patients?.full_name}</strong> مؤقتاً وتعود إليها من «جلسات مفتوحة».</p>}
      </ConfirmDialog>
      <MedicalCardSheet patientId={cardFor} onClose={() => setCardFor(null)} />
    </div>
  );
}

interface Recent { id: string; status: EncounterStatus; started_at: string; ended_at: string | null; patient_name: string; public_code: string; facility: string; diagnosis: string | null; prescriptions: number; reopen_count: number }

/** Finished sessions of the last 30 days — open one to review it or reopen it for a correction. */
function RecentSessions({ tz }: { tz: string }) {
  const [q, setQ] = useState('');
  const recent = useAsync(async () => (await unwrap(supabase.rpc('my_recent_encounters', { p_days: 30 }))) as unknown as Recent[], []);
  const rows = (recent.data ?? []).filter((r) => !q.trim() || r.patient_name.includes(q.trim()) || r.public_code.toUpperCase().includes(q.trim().toUpperCase()));
  if (!recent.data?.length) return null;
  return (
    <section className="card card-flush" aria-labelledby="recent-title">
      <div className="card-header">
        <h2 id="recent-title" className="row" style={{ gap: 8 }}><ClipboardCheck size={18} aria-hidden />جلسات منتهية (آخر 30 يوماً)</h2>
        <input className="input" style={{ maxWidth: 220 }} placeholder="بحث بالاسم أو الرقم" value={q} onChange={(e) => setQ(e.target.value)} aria-label="بحث في الجلسات المنتهية" />
      </div>
      <ul className="list" style={{ margin: 0, padding: 0, maxHeight: 360, overflow: 'auto' }}>
        {rows.slice(0, 50).map((r) => (
          <li key={r.id} className="list-item">
            <div className="grow" style={{ minWidth: 0 }}>
              <strong>{r.patient_name}</strong> <span className="small muted"><Ltr>{r.public_code}</Ltr> · {formatDateTime(r.ended_at ?? r.started_at, tz)}</span>
              <div className="small truncate">{r.diagnosis ? `التشخيص: ${r.diagnosis}` : 'بدون تشخيص مكتوب'}{r.prescriptions ? ` · ${r.prescriptions} وصفة` : ''}{r.reopen_count ? ` · أُعيد فتحها ${r.reopen_count}×` : ''}</div>
            </div>
            <Badge tone={encounterStatus[r.status].tone}>{encounterStatus[r.status].label}</Badge>
            <Link className="btn btn-secondary btn-sm" to={`/workspace/doctor/session/${r.id}`}>فتح</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A pharmacy asked about one of the doctor's prescriptions and it is not answered yet. */
function PharmacyNotesBanner() {
  const notes = useAsync(loadPharmacyNotes, []);
  const open = (notes.data ?? []).filter((n) => !n.reply);
  if (!open.length) return null;
  return (
    <Alert tone="warning" title={`ملاحظات من الصيدلية (${open.length})`}
           action={<Link className="btn btn-secondary btn-sm" to="/workspace/doctor/pharmacy-notes">عرض والرد</Link>}>
      {open.slice(0, 2).map((n) => `${n.medicine ?? ''} — ${n.patient_name}: ${n.note ?? (n.kind === 'not_available' ? 'غير متوفر' : 'طلب توضيح')}`).join(' · ')}
    </Alert>
  );
}
