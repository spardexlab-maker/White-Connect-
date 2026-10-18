import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlarmClock, CalendarDays, CalendarPlus, Check, ChevronLeft, ChevronRight, Clock3, DoorOpen, Hourglass, IdCard,
  ListOrdered, LogIn, Megaphone, Stethoscope, UserX, Wallet, X,
} from 'lucide-react';
import {
  addDays, bookingSource, errorMessage, formatDate, formatTime, localDateKey, minutesBetween, reasonSchema,
  type AppointmentStatus, type BookingSource, type QueueStatus,
} from '@app/shared';
import { supabase } from '../../lib/supabase';
import { unwrap, useAsync } from '../../lib/useAsync';
import { useWorkspace } from '../../lib/workspace';
import { newIdempotencyKey } from '../../lib/idempotency';
import {
  Alert, AppointmentStatusBadge, Badge, Button, ConfirmDialog, EmptyState, ErrorState, Ltr, PageHead, QueueStatusBadge,
  SelectField, SkeletonList, TextField, TextareaField, useToast,
} from '../../components/ui';
import { PrintCardDialog, QuickBookSheet, SlotPicker, usePractitioners, type Practitioner } from './reception-shared';
import { InvoiceSheet } from '../../components/InvoiceSheet';

export interface BoardRow {
  appointment_id: string; booking_number: string; status: AppointmentStatus; starts_at: string; ends_at: string;
  practitioner_id: string | null; practitioner_name: string | null; service_name: string; patient_id: string;
  patient_name: string; patient_code: string; patient_phone: string | null; source: BookingSource;
  confirmation_deadline: string | null; arrived_at: string | null; queue_entry_id: string | null; queue_status: QueueStatus | null; version: number;
}
export interface QueueRow {
  queue_entry_id: string; kind: 'appointment' | 'walk_in'; status: QueueStatus; priority: number; priority_reason: string | null;
  arrived_at: string; appointment_id: string | null; appointment_start: string | null; duration_minutes: number;
  practitioner_id: string | null; patient_id: string; patient_name: string; patient_code: string;
  queue_position: number | null; estimated_start: string | null;
}

/** Realtime is only a refresh signal; data always comes back from the RPCs. */
export function useFacilityRealtime(facilityId: string, onChange: () => void) {
  useEffect(() => {
    const ch = supabase.channel(`facility:${facilityId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `facility_id=eq.${facilityId}` }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_entries', filter: `facility_id=eq.${facilityId}` }, onChange)
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [facilityId, onChange]);
}

type ReasonAction = { row: BoardRow; to: 'rejected' | 'cancelled' | 'no_show' };
const reasonTitle = { rejected: 'رفض طلب الحجز', cancelled: 'إلغاء الموعد', no_show: 'تسجيل عدم حضور' } as const;

export function ReceptionDashboard() {
  const { current } = useWorkspace();
  const facilityId = current!.facility_id!;
  const tz = current!.timezone;
  const toast = useToast();
  const today = localDateKey(new Date(), tz);
  const [date, setDate] = useState(today);
  const [doctor, setDoctor] = useState<string>('');
  const [view, setView] = useState<'list' | 'hours'>('list');
  const [quickOpen, setQuickOpen] = useState(false);
  const [reasonAction, setReasonAction] = useState<ReasonAction | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | undefined>();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [printFor, setPrintFor] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<QueueRow | null>(null);
  const [delayOpen, setDelayOpen] = useState(false);
  const [feesFor, setFeesFor] = useState<string | null>(null);
  const [, tick] = useState(0);

  const practitioners = usePractitioners(facilityId);
  const board = useAsync(async () => (await unwrap(supabase.rpc('facility_day_board', { p_facility_id: facilityId, p_date: date, p_practitioner_id: doctor || undefined }))) as BoardRow[], [facilityId, date, doctor]);
  const queue = useAsync(async () => (await unwrap(supabase.rpc('facility_queue', { p_facility_id: facilityId, p_date: date, p_practitioner_id: doctor || undefined }))) as QueueRow[], [facilityId, date, doctor]);
  const reloadAll = useCallback(() => { board.reload(); queue.reload(); }, [board.reload, queue.reload]); // eslint-disable-line react-hooks/exhaustive-deps
  useFacilityRealtime(facilityId, reloadAll);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 60_000); return () => clearInterval(t); }, []);

  // keyboard: N opens quick booking (not while typing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key.toLowerCase() === 'n' && !e.ctrlKey && !e.metaKey && !['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) { e.preventDefault(); setQuickOpen(true); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const rows = board.data ?? [];
  const q = queue.data ?? [];
  const now = Date.now();
  const kpi = useMemo(() => ({
    waiting: q.filter((x) => x.status === 'waiting').length,
    pending: rows.filter((r) => r.status === 'awaiting_confirmation').length,
    late: rows.filter((r) => r.status === 'confirmed' && new Date(r.starts_at).getTime() < now).length,
    inSession: q.filter((x) => x.status === 'in_session').map((x) => x.patient_name),
  }), [rows, q, now]);

  const change = async (row: BoardRow, to: AppointmentStatus, why?: string) => {
    setBusyId(row.appointment_id);
    const { data, error } = await supabase.rpc('change_appointment_status', { p_appointment_id: row.appointment_id, p_to: to, p_reason: why, p_expected_version: row.version });
    setBusyId(null);
    if (error) { toast(errorMessage(error), 'danger'); reloadAll(); return false; }
    if ((data as { status: string }).status === 'expired') toast('انتهت مهلة التأكيد قبل الإجراء؛ تحرر الوقت.', 'danger');
    reloadAll();
    return true;
  };

  const submitReason = async () => {
    if (!reasonAction) return;
    const parsed = reasonSchema.safeParse(reason);
    if (!parsed.success) { setReasonError(parsed.error.issues[0].message); return; }
    if (await change(reasonAction.row, reasonAction.to, reason)) { setReasonAction(null); setReason(''); setReasonError(undefined); }
  };

  const queueAction = async (entry: QueueRow, status: QueueStatus) => {
    setBusyId(entry.queue_entry_id);
    const { error } = await supabase.rpc('update_queue_entry', { p_queue_entry_id: entry.queue_entry_id, p_status: status });
    setBusyId(null);
    if (error) toast(errorMessage(error), 'danger');
    reloadAll();
  };

  const byHour = useMemo(() => {
    const m = new Map<string, BoardRow[]>();
    rows.forEach((r) => { const h = formatTime(r.starts_at, tz).replace(/:\d\d/, ':00'); m.set(h, [...(m.get(h) ?? []), r]); });
    return [...m.entries()];
  }, [rows, tz]);

  const docs = practitioners.data ?? [];
  const noScope = practitioners.status === 'success' && docs.length === 0;

  return (
    <div className="stack">
      <PageHead
        title="لوحة اليوم"
        subtitle={<>{current!.facility_name} · {formatDate(date + 'T12:00:00Z', tz)}</>}
        actions={<>
          <Button variant="secondary" icon={<Megaphone size={18} />} onClick={() => setDelayOpen(true)} disabled={!docs.length}>إشعار تأخير</Button>
          <Button icon={<CalendarPlus size={18} />} onClick={() => setQuickOpen(true)} disabled={!docs.length} aria-keyshortcuts="N">
            حجز سريع <kbd aria-hidden>N</kbd>
          </Button>
        </>}
      />

      {noScope && <Alert tone="warning" title="لا يوجد أطباء ضمن صلاحياتك">اطلب من مدير المنشأة تحديد الأطباء الذين تدير مواعيدهم.</Alert>}

      <div className="kpi-strip" role="list" aria-label="ملخص اليوم">
        <div className="kpi" role="listitem"><Hourglass size={22} aria-hidden /><div><div className="kpi-v num">{kpi.waiting}</div><div className="kpi-l">ينتظرون</div></div></div>
        <div className="kpi" role="listitem"><AlarmClock size={22} aria-hidden /><div><div className="kpi-v num">{kpi.pending}</div><div className="kpi-l">طلبات تحتاج تأكيد</div></div></div>
        <div className="kpi" role="listitem"><Clock3 size={22} aria-hidden /><div><div className="kpi-v num">{kpi.late}</div><div className="kpi-l">متأخرون عن موعدهم</div></div></div>
        <div className="kpi" role="listitem"><Stethoscope size={22} aria-hidden /><div className="grow" style={{ minWidth: 0 }}><div className="kpi-v truncate" style={{ fontSize: 'var(--f-body)' }}>{kpi.inSession[0] ?? '—'}</div><div className="kpi-l">الجلسة الحالية</div></div></div>
      </div>

      <div className="row-between">
        <div className="row">
          <Button variant="secondary" size="sm" aria-label="اليوم السابق" onClick={() => setDate(addDays(date, -1))}><ChevronRight size={18} /></Button>
          <Button variant={date === today ? 'primary' : 'secondary'} size="sm" onClick={() => setDate(today)}>اليوم</Button>
          <Button variant="secondary" size="sm" aria-label="اليوم التالي" onClick={() => setDate(addDays(date, 1))}><ChevronLeft size={18} /></Button>
          <label className="sr-only" htmlFor="day">التاريخ</label>
          <input id="day" type="date" className="input input-ltr" style={{ width: 170, minHeight: 36 }} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </div>
        <div className="row">
          <label className="sr-only" htmlFor="doc">الطبيب</label>
          <select id="doc" className="select" style={{ width: 'auto', minHeight: 36 }} value={doctor} onChange={(e) => setDoctor(e.target.value)}>
            <option value="">كل الأطباء</option>
            {docs.map((d) => <option key={d.practitioner_id} value={d.practitioner_id}>{d.full_name}</option>)}
          </select>
          <div className="segmented" role="group" aria-label="طريقة العرض">
            <button aria-pressed={view === 'list'} onClick={() => setView('list')}><ListOrdered size={16} aria-hidden /> قائمة</button>
            <button aria-pressed={view === 'hours'} onClick={() => setView('hours')}><CalendarDays size={16} aria-hidden /> حسب الساعة</button>
          </div>
        </div>
      </div>

      <div className="board">
        <section className="card card-flush" aria-labelledby="appts-title">
          <div className="card-header"><h2 id="appts-title">المواعيد <span className="muted small num">({rows.length})</span></h2></div>
          {board.status === 'loading' && !board.data && <SkeletonList rows={5} />}
          {board.status === 'error' && <ErrorState error={board.error} onRetry={board.reload} />}
          {board.data && rows.length === 0 && (
            <EmptyState icon={<CalendarDays />} title="لا توجد مواعيد في هذا اليوم"
                        action={docs.length ? <Button icon={<CalendarPlus size={18} />} onClick={() => setQuickOpen(true)}>إضافة حجز</Button> : undefined} />
          )}
          {view === 'list'
            ? rows.map((r) => <AppointmentRow key={r.appointment_id} r={r} tz={tz} busy={busyId === r.appointment_id} today={date === today}
                                               onChange={change} onReason={(to) => { setReasonAction({ row: r, to }); setReason(''); setReasonError(undefined); }}
                                               onPrint={() => setPrintFor(r.patient_id)} onFees={() => setFeesFor(r.appointment_id)} showDoctor={!doctor} />)
            : byHour.map(([h, list]) => (
                <div key={h}>
                  <div className="label-text" style={{ padding: 'var(--s-2) var(--s-4)', background: 'var(--c-surface-sunken)' }}><Ltr>{h}</Ltr></div>
                  {list.map((r) => <AppointmentRow key={r.appointment_id} r={r} tz={tz} busy={busyId === r.appointment_id} today={date === today}
                                                   onChange={change} onReason={(to) => { setReasonAction({ row: r, to }); setReason(''); setReasonError(undefined); }}
                                                   onPrint={() => setPrintFor(r.patient_id)} onFees={() => setFeesFor(r.appointment_id)} showDoctor={!doctor} />)}
                </div>
              ))}
        </section>

        <aside className="card card-flush" aria-labelledby="queue-title">
          <div className="card-header"><h2 id="queue-title">الحضور والانتظار</h2><Badge tone="neutral">تقدير وليس وعداً</Badge></div>
          {queue.status === 'loading' && !queue.data && <SkeletonList rows={3} />}
          {queue.status === 'error' && <ErrorState error={queue.error} onRetry={queue.reload} />}
          {queue.data && q.length === 0 && <EmptyState icon={<DoorOpen />} title="لا أحد في الانتظار">يظهر هنا من سُجّل حضوره والمرضى العابرون.</EmptyState>}
          {q.map((e) => (
            <div key={e.queue_entry_id} className="queue-item">
              <span className="pos num" aria-label={e.queue_position ? `الترتيب ${e.queue_position}` : undefined}>{e.queue_position ?? '–'}</span>
              <div className="grow stack-sm" style={{ gap: 2 }}>
                <div className="row-between"><strong className="truncate">{e.patient_name}</strong><QueueStatusBadge status={e.status} /></div>
                <span className="small muted">
                  {e.kind === 'walk_in' ? 'عابر — قائمة انتظار' : `موعد ${formatTime(e.appointment_start!, tz)}`} · وصل {formatTime(e.arrived_at, tz)}
                </span>
                {e.estimated_start && ['waiting', 'called'].includes(e.status) && <span className="small">التقدير: نحو <span className="num">{formatTime(e.estimated_start, tz)}</span></span>}
                {e.priority > 0 && <span className="small" style={{ color: 'var(--c-warning)' }}>أولوية: {e.priority_reason}</span>}
                <div className="row" style={{ gap: 'var(--s-2)', marginBlockStart: 4 }}>
                  {e.kind === 'walk_in' && !e.appointment_id && e.status === 'waiting' && (
                    <Button size="sm" variant="secondary" onClick={() => setAssigning(e)}>تخصيص وقت</Button>
                  )}
                  {e.status === 'waiting' && <Button size="sm" variant="ghost" loading={busyId === e.queue_entry_id} onClick={() => queueAction(e, 'called')}>نداء</Button>}
                  {['waiting', 'called'].includes(e.status) && <Button size="sm" variant="ghost" onClick={() => queueAction(e, 'left')}>غادر</Button>}
                </div>
              </div>
            </div>
          ))}
        </aside>
      </div>

      {practitioners.data && (
        <QuickBookSheet open={quickOpen} onClose={() => setQuickOpen(false)} facilityId={facilityId} timezone={tz} practitioners={docs}
                        defaultPractitionerId={doctor || undefined} defaultDate={date}
                        onBooked={(r) => { setQuickOpen(false); reloadAll(); setPrintFor(r.patientId); }} />
      )}

      <ConfirmDialog open={!!reasonAction} title={reasonAction ? reasonTitle[reasonAction.to] : ''} confirmLabel="تأكيد" tone="danger"
                     loading={!!reasonAction && busyId === reasonAction.row.appointment_id}
                     onCancel={() => setReasonAction(null)} onConfirm={submitReason}>
        {reasonAction && <p>{reasonAction.row.patient_name} — {formatTime(reasonAction.row.starts_at, tz)}. يُحفظ السبب في سجل الموعد{reasonAction.to !== 'no_show' ? ' ويتحرر الوقت' : ''}.</p>}
        <TextareaField label="السبب" required value={reason} error={reasonError} onChange={(e) => setReason(e.target.value)} style={{ minHeight: 72 }} />
      </ConfirmDialog>

      {printFor && <PrintCardDialog facilityId={facilityId} patientId={printFor} onClose={() => setPrintFor(null)} />}
      {assigning && <AssignWalkIn entry={assigning} facilityId={facilityId} tz={tz} date={date} practitioners={docs} onClose={() => setAssigning(null)} onDone={() => { setAssigning(null); reloadAll(); }} />}
      {feesFor && <InvoiceSheet appointmentId={feesFor} onClose={() => setFeesFor(null)} />}
      {delayOpen && <DelayNotice facilityId={facilityId} practitioners={docs} defaultDoctor={doctor} onClose={() => setDelayOpen(false)} />}
    </div>
  );
}

function AppointmentRow({ r, tz, busy, today, onChange, onReason, onPrint, onFees, showDoctor }: {
  r: BoardRow; tz: string; busy: boolean; today: boolean; showDoctor: boolean;
  onChange: (r: BoardRow, to: AppointmentStatus) => void; onReason: (to: ReasonAction['to']) => void; onPrint: () => void; onFees: () => void;
}) {
  const lateMin = r.status === 'confirmed' ? minutesBetween(r.starts_at, new Date()) : 0;
  return (
    <div className="appt-row">
      <div className="time num">{formatTime(r.starts_at, tz)}<small>{minutesBetween(r.starts_at, r.ends_at)} د</small></div>
      <div className="who">
        <strong className="truncate">{r.patient_name}</strong>
        <span className="small muted">
          <Ltr>{r.patient_code}</Ltr>{r.patient_phone && <> · <Ltr>{r.patient_phone}</Ltr></>} · {r.service_name}{showDoctor && r.practitioner_name ? ` · ${r.practitioner_name}` : ''}
        </span>
        <div className="row" style={{ gap: 6, marginBlockStart: 4 }}>
          <AppointmentStatusBadge status={r.status} />
          <Badge tone="neutral">{bookingSource[r.source]}</Badge>
          {r.arrived_at && <span className="small muted">وصل {formatTime(r.arrived_at, tz)}</span>}
          {lateMin > 5 && <span className="small" style={{ color: 'var(--c-danger)' }}>متأخر {lateMin} د</span>}
          {r.status === 'awaiting_confirmation' && r.confirmation_deadline && <span className="small" style={{ color: 'var(--c-warning)' }}>المهلة حتى {formatTime(r.confirmation_deadline, tz)}</span>}
        </div>
      </div>
      <div className="actions">
        {r.status === 'awaiting_confirmation' && <>
          <Button size="sm" variant="accent" icon={<Check size={16} />} loading={busy} onClick={() => onChange(r, 'confirmed')}>تأكيد</Button>
          <Button size="sm" variant="danger" icon={<X size={16} />} onClick={() => onReason('rejected')}>رفض</Button>
        </>}
        {r.status === 'confirmed' && <>
          {today && <Button size="sm" variant="accent" icon={<LogIn size={16} />} loading={busy} onClick={() => onChange(r, 'checked_in')}>تسجيل حضور</Button>}
          {today && new Date(r.starts_at).getTime() < Date.now() && <Button size="sm" variant="ghost" icon={<UserX size={16} />} onClick={() => onReason('no_show')}>لم يحضر</Button>}
          <Button size="sm" variant="ghost" onClick={() => onReason('cancelled')}>إلغاء</Button>
        </>}
        {r.status === 'checked_in' && <Button size="sm" variant="secondary" icon={<DoorOpen size={16} />} loading={busy} onClick={() => onChange(r, 'fulfilled')}>تسجيل مغادرة</Button>}
        {['confirmed', 'checked_in', 'fulfilled'].includes(r.status) && <Button size="sm" variant="ghost" icon={<Wallet size={16} />} onClick={onFees}>رسوم</Button>}
        <Button size="sm" variant="ghost" icon={<IdCard size={16} />} onClick={onPrint} aria-label={`بطاقة ${r.patient_name}`}>بطاقة</Button>
      </div>
    </div>
  );
}

function AssignWalkIn({ entry, facilityId, tz, date, practitioners, onClose, onDone }: {
  entry: QueueRow; facilityId: string; tz: string; date: string; practitioners: Practitioner[]; onClose: () => void; onDone: () => void;
}) {
  const toast = useToast();
  const doc = practitioners.find((p) => p.practitioner_id === entry.practitioner_id);
  const [serviceId, setServiceId] = useState(doc?.services[0]?.id ?? '');
  const [slot, setSlot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [key] = useState(() => newIdempotencyKey('walkin'));
  const submit = async () => {
    if (!slot) return;
    setBusy(true);
    const { error } = await supabase.rpc('assign_walk_in_slot', { p_queue_entry_id: entry.queue_entry_id, p_service_id: serviceId, p_start: slot, p_idempotency_key: key });
    setBusy(false);
    if (error) { toast(errorMessage(error), 'danger'); setSlot(null); return; }
    toast('تم تخصيص وقت فعلي للمريض العابر', 'success');
    onDone();
  };
  return (
    <ConfirmDialog open title={`تخصيص وقت — ${entry.patient_name}`} confirmLabel="تثبيت الوقت" loading={busy} onCancel={onClose} onConfirm={submit}>
      <p className="small muted">يُخصص فقط وقت شاغر فعلاً؛ يخضع لنفس قيود الحجز.</p>
      <SelectField label="نوع الزيارة" value={serviceId} onChange={(e) => { setServiceId(e.target.value); setSlot(null); }}>
        {doc?.services.filter((s) => s.is_active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </SelectField>
      {entry.practitioner_id && <SlotPicker facilityId={facilityId} practitionerId={entry.practitioner_id} serviceId={serviceId} date={date} value={slot} onChange={setSlot} timezone={tz} />}
    </ConfirmDialog>
  );
}

function DelayNotice({ facilityId, practitioners, defaultDoctor, onClose }: { facilityId: string; practitioners: { practitioner_id: string; full_name: string }[]; defaultDoctor: string; onClose: () => void }) {
  const toast = useToast();
  const [doctor, setDoctor] = useState(defaultDoctor || practitioners[0]?.practitioner_id || '');
  const [minutes, setMinutes] = useState('20');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('post_delay_notice', { p_facility_id: facilityId, p_practitioner_id: doctor, p_delay_minutes: Number(minutes) || 0 });
    setBusy(false);
    if (error) { toast(errorMessage(error), 'danger'); return; }
    toast('تم نشر إشعار التأخير للمرضى ذوي الحسابات', 'success');
    onClose();
  };
  return (
    <ConfirmDialog open title="إشعار تأخير عام" confirmLabel="نشر الإشعار" loading={busy} onCancel={onClose} onConfirm={submit}>
      <p className="small muted">يصل لأصحاب مواعيد اليوم اللاحقة فقط، دون كشف أسماء مرضى آخرين. لا يغيّر أوقات المواعيد.</p>
      <SelectField label="الطبيب" value={doctor} onChange={(e) => setDoctor(e.target.value)}>
        {practitioners.map((p) => <option key={p.practitioner_id} value={p.practitioner_id}>{p.full_name}</option>)}
      </SelectField>
      <TextField label="مدة التأخير التقديرية (دقيقة)" inputMode="numeric" ltr value={minutes} onChange={(e) => setMinutes(e.target.value)} />
    </ConfirmDialog>
  );
}
