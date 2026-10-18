import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Activity, AlertTriangle, CheckCircle2, ClipboardList, CloudOff, FlaskConical, Hourglass, Loader2, LogOut, NotebookPen, Pill, Save, ShieldAlert, Stethoscope, Users } from 'lucide-react';
import { encounterStatus, errorCode, errorMessage, formatDateTime, formatMoney, formatTime, localDateKey, queueStatus, type EncounterStatus } from '@app/shared';
import { supabase } from '../../lib/supabase';
import { unwrap, useAsync } from '../../lib/useAsync';
import { useWorkspace } from '../../lib/workspace';
import { useAuth } from '../../lib/auth';
import { newIdempotencyKey } from '../../lib/idempotency';
import { Alert, Avatar, Badge, Button, ConfirmDialog, EmptyState, ErrorState, Ltr, Skeleton, SkeletonList, Tabs, TextField, TextareaField, useToast } from '../../components/ui';
import { useFacilityRealtime, type QueueRow } from './Reception';
import { RxBuilder, type EncounterOrders } from '../../components/clinical/RxBuilder';

interface Note {
  id: string; version: number; version_no: number; status: 'draft' | 'signed'; reason_for_visit: string | null; history: string | null;
  examination: string | null; assessment: string | null; plan: string | null; follow_up: string | null; free_text: string | null;
  vitals: Record<string, string>; signed_at: string | null;
}
interface Context {
  encounter: { id: string; status: EncounterStatus; started_at: string; facility_id: string; patient_id: string; queue_entry_id: string | null };
  patient: { id: string; public_code: string; full_name: string; sex: 'male' | 'female' | null; birth_year: number | null };
  allergies_recorded: boolean;
  allergies: { id: string; substance: string; reaction: string | null; severity: string | null; source: string }[];
  note: Note | null;
  history: { encounter_id: string; started_at: string; status: string; facility: string; assessment: string | null; plan: string | null }[];
}
type Tab = 'summary' | 'history' | 'session' | 'labs' | 'rx';
type SaveState = 'saved' | 'dirty' | 'saving' | 'error' | 'conflict';
const FIELDS: [keyof Note, string][] = [
  ['reason_for_visit', 'سبب الزيارة'], ['history', 'التاريخ المرضي ذو الصلة'], ['examination', 'الفحص السريري'],
  ['assessment', 'التقييم / التشخيص'], ['plan', 'الخطة'], ['follow_up', 'المتابعة'], ['free_text', 'ملاحظات إضافية'],
];
/** Visual grouping of the same fields (no field added or removed). */
const GROUPS: { title: string; icon: JSX.Element; keys: (keyof Note)[] }[] = [
  { title: 'الشكوى والفحص', icon: <NotebookPen size={18} aria-hidden />, keys: ['reason_for_visit', 'history', 'examination'] },
  { title: 'التقييم والخطة', icon: <ClipboardList size={18} aria-hidden />, keys: ['assessment', 'plan', 'follow_up'] },
  { title: 'ملاحظات أخرى', icon: <NotebookPen size={18} aria-hidden />, keys: ['free_text'] },
];
const fieldLabel = Object.fromEntries(FIELDS) as Record<string, string>;
const VITALS: [string, string][] = [['bp_sys', 'الضغط الانقباضي'], ['bp_dia', 'الضغط الانبساطي'], ['pulse', 'النبض'], ['temp_c', 'الحرارة °م'], ['spo2', 'تشبع الأكسجين %'], ['weight_kg', 'الوزن كغ']];

export function DoctorSession() {
  const { encounterId } = useParams();
  // keyed: switching patient remounts everything (no carry-over of forms)
  return <SessionInner key={encounterId} encounterId={encounterId!} />;
}

function SessionInner({ encounterId }: { encounterId: string }) {
  const { current } = useWorkspace();
  const navigate = useNavigate();
  const toast = useToast();
  const ctx = useAsync(async () => (await unwrap(supabase.rpc('encounter_context', { p_encounter_id: encounterId }))) as unknown as Context, [encounterId]);
  const orders = useAsync(async () => (await unwrap(supabase.rpc('encounter_orders', { p_encounter_id: encounterId }))) as unknown as EncounterOrders, [encounterId]);
  const [tab, setTab] = useState<Tab>('session');
  const [form, setForm] = useState<Partial<Note>>({});
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const version = useRef<number | null>(null);
  const timer = useRef<number>();
  const [confirm, setConfirm] = useState<null | 'sign' | 'await' | 'complete'>(null);
  const [busy, setBusy] = useState(false);
  const { access } = useAuth();
  const me = useAsync(async () => (access?.practitioner_id
    ? ((await unwrap(supabase.from('practitioner_profiles').select('full_name, title, license_number').eq('id', access.practitioner_id).maybeSingle())) as { full_name: string; title: string | null; license_number: string | null } | null)
    : null), [access?.practitioner_id]);

  useEffect(() => {
    if (ctx.data?.note) { setForm(ctx.data.note); version.current = ctx.data.note.version; }
  }, [ctx.data?.note?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const note = ctx.data?.note;
  const locked = note?.status === 'signed';

  const save = useCallback(async () => {
    if (locked) return true;
    setSaveState('saving');
    const fields: Record<string, unknown> = {};
    FIELDS.forEach(([k]) => { fields[k] = form[k] ?? ''; });
    fields.vitals = form.vitals ?? {};
    const { data, error } = await supabase.rpc('save_clinical_note_draft', { p_encounter_id: encounterId, p_fields: fields as never, p_expected_version: version.current ?? undefined });
    if (error) { setSaveState(errorCode(error) === 'stale_version' ? 'conflict' : 'error'); return false; }
    version.current = (data as { version: number }).version;
    setSaveState('saved'); setLastSaved(new Date());
    return true;
  }, [encounterId, form, locked]);

  const change = (patch: Partial<Note>) => {
    setForm((f) => ({ ...f, ...patch }));
    setSaveState('dirty');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void saveRef.current(), 1500);
  };
  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => { if (saveState === 'dirty' || saveState === 'saving' || saveState === 'error') { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [saveState]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const act = async (kind: 'sign' | 'await' | 'complete') => {
    setBusy(true);
    if (!(await save())) { setBusy(false); setConfirm(null); toast('تعذّر حفظ المسودة؛ لم يُنفّذ الإجراء.', 'danger'); return; }
    const res = kind === 'sign'
      ? await supabase.rpc('sign_clinical_note', { p_encounter_id: encounterId })
      : await supabase.rpc('set_encounter_status', { p_encounter_id: encounterId, p_status: kind === 'await' ? 'awaiting_results' : 'completed' });
    setBusy(false); setConfirm(null);
    if (res.error) { toast(errorMessage(res.error), 'danger'); return; }
    if (kind === 'sign') { toast('اعتُمدت الملاحظة وقُفلت', 'success'); ctx.reload(); return; }
    toast(kind === 'await' ? 'الجلسة بانتظار النتائج — يمكنك استقبال التالي' : 'أُنهيت الجلسة', 'success');
    navigate('/workspace/doctor');
  };

  const previewBase = useMemo(() => ctx.data ? ({
    practitioner: { full_name: me.data?.full_name ?? '—', title: me.data?.title ?? null, license_number: me.data?.license_number ?? null },
    facility: { name: current?.facility_name ?? '', branch: current?.branch_name ?? '', address: null, phone: null },
    patient: { full_name: ctx.data.patient.full_name, public_code: ctx.data.patient.public_code, sex: ctx.data.patient.sex, birth_year: ctx.data.patient.birth_year },
  }) : null, [ctx.data, current, me.data]);

  if (ctx.status === 'loading' && !ctx.data) return <SkeletonList rows={6} />;
  if (ctx.status === 'error') return <ErrorState error={ctx.error} onRetry={ctx.reload} />;
  const c = ctx.data!;
  const age = c.patient.birth_year ? new Date().getFullYear() - c.patient.birth_year : null;
  const active = ['in_progress', 'awaiting_results', 'ready_for_review'].includes(c.encounter.status);

  return (
    <div className="session-shell">
      <TodayRail facilityId={c.encounter.facility_id} currentEncounterId={encounterId} />
      <div className="stack" style={{ minWidth: 0 }}>
      {/* fixed identity + safety header (§24) */}
      <div className="session-header" role="region" aria-label="هوية المريض">
        <Avatar name={c.patient.full_name} />
        <div className="grow" style={{ minWidth: 200 }}>
          <strong style={{ fontSize: 'var(--f-h4)' }}>{c.patient.full_name}</strong>
          <div className="small muted"><Ltr>{c.patient.public_code}</Ltr>{age != null ? ` · ${age} سنة` : ' · العمر غير مسجل'}{c.patient.sex ? ` · ${c.patient.sex === 'female' ? 'أنثى' : 'ذكر'}` : ''} · بدأت {formatTime(c.encounter.started_at)}</div>
        </div>
        <div className="allergy-strip" aria-label="الحساسية الموثقة">
          {c.allergies.length > 0
            ? c.allergies.map((a) => <Badge key={a.id} tone="danger" icon={<ShieldAlert aria-hidden />}>حساسية: <bdi dir="auto">{a.substance}</bdi>{a.source === 'patient_reported' ? ' (ذكرها المريض)' : ''}</Badge>)
            : <Badge tone="warning" icon={<AlertTriangle aria-hidden />}>{c.allergies_recorded ? 'لا حساسية نشطة مسجلة' : 'لم تُسجَّل حساسية — هذا لا يعني عدم وجودها'}</Badge>}
        </div>
        <div className="session-meta">
          <Badge tone={encounterStatus[c.encounter.status].tone}>{encounterStatus[c.encounter.status].label}</Badge>
          <SaveIndicator state={locked ? 'saved' : saveState} lastSaved={lastSaved} locked={locked} onRetry={() => void save()} />
        </div>
      </div>

      {saveState === 'conflict' && <Alert tone="danger" title="تعارض في الحفظ">عُدّلت المسودة من نافذة أخرى. حدّث الصفحة قبل المتابعة حتى لا تُفقد تغييرات.</Alert>}

      <div className="card card-flush">
        <Tabs<Tab> label="ملف الجلسة" value={tab} onChange={setTab} tabs={[
          { id: 'summary', label: 'ملخص' }, { id: 'history', label: `سجل سابق (${c.history.length})` }, { id: 'session', label: 'الجلسة الحالية' },
          { id: 'labs', label: `تحاليل (${orders.data?.lab_orders.length ?? 0})` }, { id: 'rx', label: 'وصفة' },
        ]} />
        <div role="tabpanel" id={`panel-${tab}`} key={tab} aria-labelledby={`tab-${tab}`} style={{ padding: 'var(--s-5)' }}>
          {tab === 'summary' && <SummaryTab c={c} orders={orders.data ?? null} />}
          {tab === 'history' && <HistoryList c={c} />}
          {tab === 'session' && (
            <div className="session-grid">
              <div className="stack">
                {locked && <Alert tone="success" title={`الملاحظة معتمدة (${note?.signed_at ? formatDateTime(note.signed_at) : ''})`}>النسخة مقفلة؛ أي تصحيح لاحق يُضاف كإصدار جديد مع السبب.</Alert>}
                <fieldset className="note-section" disabled={locked}>
                  <legend className="note-title"><Activity size={18} aria-hidden />العلامات الحيوية <span className="muted small">(اختياري)</span></legend>
                  <div className="vitals-grid">
                    {VITALS.map(([k, label]) => (
                      <TextField key={k} label={label} inputMode="decimal" ltr value={form.vitals?.[k] ?? ''} onChange={(e) => change({ vitals: { ...(form.vitals ?? {}), [k]: e.target.value } })} />
                    ))}
                  </div>
                </fieldset>
                {GROUPS.map((g) => (
                  <fieldset key={g.title} className="note-section" disabled={locked}>
                    <legend className="note-title">{g.icon}{g.title}</legend>
                    {g.keys.map((k) => (
                      <TextareaField key={k} label={fieldLabel[k]} optional={k !== 'assessment'} value={(form[k] as string) ?? ''}
                                     onChange={(e) => change({ [k]: e.target.value } as Partial<Note>)} style={{ minHeight: k === 'assessment' || k === 'plan' ? 96 : 72 }} />
                    ))}
                  </fieldset>
                ))}
              </div>
              <aside className="session-actions" aria-label="إجراءات الجلسة">
                <div className="card stack-sm">
                  <h2 className="eyebrow">أدوات الجلسة</h2>
                  {!locked && <Button variant="secondary" icon={<Save size={18} />} loading={saveState === 'saving'} onClick={() => void save()}>حفظ مسودة</Button>}
                  <Button variant="secondary" icon={<FlaskConical size={18} />} onClick={() => setTab('labs')} disabled={!active}>طلب تحليل</Button>
                  <Button variant="secondary" icon={<Pill size={18} />} onClick={() => setTab('rx')} disabled={!active}>وصفة</Button>
                </div>
                <div className="card stack-sm">
                  <h2 className="eyebrow">قرارات</h2>
                  {!locked && <Button variant="accent" icon={<CheckCircle2 size={18} />} onClick={() => setConfirm('sign')}>اعتماد الملاحظة</Button>}
                  {c.encounter.status === 'in_progress' && <Button variant="soft" icon={<Hourglass size={18} />} onClick={() => setConfirm('await')}>انتظار النتائج واستقبال التالي</Button>}
                  {active && <Button icon={<LogOut size={18} />} onClick={() => setConfirm('complete')}>إنهاء الجلسة والتالي</Button>}
                  <p className="small muted">الحفظ التلقائي كل بضع ثوانٍ. «التالي» يفتح قائمة اليوم دون نقل أي نموذج للمريض التالي.</p>
                </div>
              </aside>
            </div>
          )}
          {tab === 'labs' && <LabOrderPanel encounterId={encounterId} orders={orders.data ?? null} onChanged={orders.reload} active={active} />}
          {tab === 'rx' && previewBase && (active || orders.data?.prescriptions.length
            ? <RxBuilder encounterId={encounterId} facilityId={c.encounter.facility_id} patientName={c.patient.full_name} orders={orders.data ?? null} onChanged={orders.reload} preview={previewBase} />
            : <EmptyState icon={<Stethoscope />} title="الجلسة مغلقة" />)}
        </div>
      </div>
      </div>

      <ConfirmDialog open={confirm === 'sign'} title="اعتماد الملاحظة؟" confirmLabel="اعتماد وقفل" loading={busy} onCancel={() => setConfirm(null)} onConfirm={() => act('sign')}>
        بعد الاعتماد تُقفل هذه النسخة لمريض: <strong>{c.patient.full_name}</strong>. التصحيح لاحقاً يُضاف كإصدار جديد مع سبب.
      </ConfirmDialog>
      <ConfirmDialog open={confirm === 'await'} title="تحويل الجلسة إلى «بانتظار النتائج»؟" confirmLabel="تأكيد" loading={busy} onCancel={() => setConfirm(null)} onConfirm={() => act('await')}>
        يتحرر وقتك لاستقبال المريض التالي، وعند اعتماد النتيجة تظهر لك مهمة مراجعة.
      </ConfirmDialog>
      <ConfirmDialog open={confirm === 'complete'} title="إنهاء الجلسة؟" confirmLabel="إنهاء" loading={busy} onCancel={() => setConfirm(null)} onConfirm={() => act('complete')}>
        {!locked ? 'الملاحظة لم تُعتمد بعد وستبقى مسودة. ' : ''}سيُسجل وقت الانتهاء الفعلي الآن.
      </ConfirmDialog>
    </div>
  );
}

/** Today's list beside the session (desktop): open sessions link back; waiting patients are started from «اليوم والطابور». */
function TodayRail({ facilityId, currentEncounterId }: { facilityId: string; currentEncounterId: string }) {
  const { current, } = useWorkspace();
  const { access } = useAuth();
  const me = access?.practitioner_id ?? undefined;
  const tz = current?.timezone ?? 'Asia/Baghdad';
  const today = useMemo(() => localDateKey(new Date(), tz), [tz]);
  const queue = useAsync(async () => (me ? ((await unwrap(supabase.rpc('facility_queue', { p_facility_id: facilityId, p_date: today, p_practitioner_id: me }))) as QueueRow[]) : []), [facilityId, today, me]);
  const open = useAsync(async () => (me ? ((await unwrap(supabase.from('encounters').select('id, status, patients(full_name)')
    .eq('practitioner_id', me).eq('facility_id', facilityId).in('status', ['in_progress', 'awaiting_results', 'ready_for_review'])
    .order('started_at', { ascending: false }))) as unknown as { id: string; status: EncounterStatus; patients: { full_name: string } | null }[]) : []), [me, facilityId]);
  const reload = useCallback(() => { queue.reload(); open.reload(); }, [queue.reload, open.reload]); // eslint-disable-line react-hooks/exhaustive-deps
  useFacilityRealtime(facilityId, reload);
  const waiting = (queue.data ?? []).filter((q) => ['waiting', 'called'].includes(q.status));
  return (
    <nav className="today-rail card card-flush" aria-label="مرضى اليوم">
      <div className="card-header"><h2 className="row" style={{ gap: 8 }}><Users size={18} aria-hidden />مرضى اليوم</h2><Link to="/workspace/doctor" className="small">الكل</Link></div>
      {(queue.status === 'loading' && !queue.data) && <div className="stack-sm" style={{ padding: 'var(--s-4)' }}><Skeleton height={40} /><Skeleton height={40} /></div>}
      <div className="rail-group">
        <span className="rail-label">جلسات مفتوحة</span>
        {open.data?.map((e) => (
          <Link key={e.id} to={`/workspace/doctor/session/${e.id}`} className="rail-item" aria-current={e.id === currentEncounterId ? 'page' : undefined}>
            <Avatar name={e.patients?.full_name ?? '؟'} size="sm" />
            <span className="grow" style={{ minWidth: 0 }}><strong className="truncate">{e.patients?.full_name}</strong><span className="truncate">{encounterStatus[e.status].label}</span></span>
          </Link>
        ))}
      </div>
      <div className="rail-group">
        <span className="rail-label">في الانتظار ({waiting.length})</span>
        {waiting.length === 0 && <span className="small muted" style={{ paddingInline: 'var(--s-4)' }}>لا أحد في الانتظار.</span>}
        {waiting.map((q) => (
          <Link key={q.queue_entry_id} to="/workspace/doctor" className="rail-item">
            <span className="pos num">{q.queue_position ?? '–'}</span>
            <span className="grow" style={{ minWidth: 0 }}><strong className="truncate">{q.patient_name}</strong><span className="truncate">{queueStatus[q.status].label}{q.appointment_start ? ` · ${formatTime(q.appointment_start, tz)}` : ' · عابر'}</span></span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

function SaveIndicator({ state, lastSaved, locked, onRetry }: { state: SaveState; lastSaved: Date | null; locked: boolean; onRetry: () => void }) {
  if (locked) return <span className="save-state" style={{ color: 'var(--c-success)' }}><CheckCircle2 size={14} aria-hidden />معتمدة ومقفلة</span>;
  const map: Record<SaveState, JSX.Element> = {
    saved: <span className="save-state" style={{ color: 'var(--c-success)' }}><CheckCircle2 size={14} aria-hidden />{lastSaved ? `محفوظ ${formatTime(lastSaved)}` : 'محفوظ'}</span>,
    dirty: <span className="save-state" style={{ color: 'var(--c-warning)' }}><AlertTriangle size={14} aria-hidden />تغييرات غير محفوظة</span>,
    saving: <span className="save-state"><Loader2 size={14} aria-hidden />جارٍ الحفظ…</span>,
    error: <span className="save-state" style={{ color: 'var(--c-danger)' }}><CloudOff size={14} aria-hidden />فشل الحفظ <button className="btn btn-ghost btn-sm" onClick={onRetry}>إعادة</button></span>,
    conflict: <span className="save-state" style={{ color: 'var(--c-danger)' }}><AlertTriangle size={14} aria-hidden />تعارض</span>,
  };
  return <span role="status" aria-live="polite">{map[state]}</span>;
}

function SummaryTab({ c, orders }: { c: Context; orders: EncounterOrders | null }) {
  return (
    <div className="two-col">
      <div className="stack-sm">
        <h3 className="section-title">الجلسة الحالية</h3>
        <p className="small"><strong>سبب الزيارة:</strong> {c.note?.reason_for_visit || '—'}</p>
        <p className="small"><strong>التقييم:</strong> {c.note?.assessment || '—'}</p>
        <p className="small"><strong>الخطة:</strong> {c.note?.plan || '—'}</p>
      </div>
      <div className="stack-sm">
        <h3 className="section-title">الطلبات في هذه الجلسة</h3>
        {orders?.prescriptions.map((p) => <p key={p.id} className="small">وصفة <Ltr>{p.rx_number}</Ltr> — {p.status === 'active' ? `معتمدة (إصدار ${p.current_version_no})` : p.status === 'draft' ? 'مسودة' : 'ملغاة'}</p>)}
        {orders?.lab_orders.map((o) => <p key={o.id} className="small">تحاليل <Ltr>{o.order_number}</Ltr> — {o.lab}</p>)}
        {!orders?.prescriptions.length && !orders?.lab_orders.length && <p className="small muted">لا توجد طلبات بعد.</p>}
      </div>
    </div>
  );
}

function HistoryList({ c }: { c: Context }) {
  if (!c.history.length) return <EmptyState icon={<Stethoscope />} title="لا يوجد سجل سابق متاح لك">تظهر هنا زياراتك السابقة لهذا المريض أو ما شاركه معك.</EmptyState>;
  return (
    <ol className="timeline">
      {c.history.map((h) => (
        <li key={h.encounter_id}>
          <span className="dot" aria-hidden />
          <div className="label-text">{h.started_at ? formatDateTime(h.started_at) : '—'} · {h.facility}</div>
          <div className="card" style={{ padding: 'var(--s-3)' }}>
            <p className="small"><strong>التقييم:</strong> {h.assessment ?? 'لا توجد ملاحظة معتمدة'}</p>
            {h.plan && <p className="small"><strong>الخطة:</strong> {h.plan}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

interface LabChoice { lab_id: string; name: string; branch: string; is_default: boolean; tests: { id: string; code: string; name: string; specimen_type: string; price_minor: number | null }[] }

function LabOrderPanel({ encounterId, orders, onChanged, active }: { encounterId: string; orders: EncounterOrders | null; onChanged: () => void; active: boolean }) {
  const toast = useToast();
  const labs = useAsync(async () => (await unwrap(supabase.rpc('lab_choices', { p_encounter_id: encounterId }))) as unknown as LabChoice[], [encounterId]);
  const [labId, setLabId] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [idem, setIdem] = useState(() => newIdempotencyKey('lab'));
  useEffect(() => { const d = labs.data?.find((l) => l.is_default) ?? labs.data?.[0]; if (d && !labId) setLabId(d.lab_id); }, [labs.data, labId]);
  const lab = labs.data?.find((l) => l.lab_id === labId);

  const submit = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('order_lab_tests', { p_encounter_id: encounterId, p_lab_facility_id: labId, p_test_ids: selected, p_idempotency_key: idem, p_note: note || undefined });
    setBusy(false);
    if (error) { toast(errorMessage(error), 'danger'); return; }
    toast(`أُرسل طلب التحاليل إلى ${lab?.name}`, 'success');
    setSelected([]); setNote(''); setIdem(newIdempotencyKey('lab')); onChanged();
  };

  return (
    <div className="stack">
      {orders?.lab_orders.map((o) => (
        <div key={o.id} className="card stack-sm">
          <div className="row-between"><strong>طلب <Ltr>{o.order_number}</Ltr> — {o.lab}</strong><Badge tone="info">{o.items.length} فحص</Badge></div>
          <p className="small muted">{o.items.map((i) => i.name).join('، ')}</p>
        </div>
      ))}
      {active && (
        <div className="card stack">
          <h3 className="section-title">طلب تحاليل جديد</h3>
          <div className="field">
            <label htmlFor="lab">المختبر</label>
            <select id="lab" className="select" value={labId} onChange={(e) => { setLabId(e.target.value); setSelected([]); }}>
              {labs.data?.map((l) => <option key={l.lab_id} value={l.lab_id}>{l.name} — {l.branch}{l.is_default ? ' (مختبر هذا الموقع)' : ''}</option>)}
            </select>
            <span className="hint">الإحالة طلب خدمة وليست حجز وقت؛ يختار المريض موعداً أو يحضر مباشرة.</span>
          </div>
          <div className="radio-cards" role="group" aria-label="الفحوصات">
            {lab?.tests.map((t) => (
              <label key={t.id} className="radio-card">
                <input type="checkbox" checked={selected.includes(t.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, t.id] : selected.filter((x) => x !== t.id))} />
                <strong>{t.name}</strong>
                <span className="small muted">{t.specimen_type} · {formatMoney(t.price_minor)}</span>
              </label>
            ))}
          </div>
          <TextField label="سبب الطلب للمختبر" optional value={note} onChange={(e) => setNote(e.target.value)} />
          <Button icon={<FlaskConical size={18} />} disabled={!selected.length} loading={busy} onClick={submit}>إرسال الطلب إلى {lab?.name ?? 'المختبر'}</Button>
        </div>
      )}
    </div>
  );
}
