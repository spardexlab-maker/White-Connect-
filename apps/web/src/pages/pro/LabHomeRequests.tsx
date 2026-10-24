import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, Car, CheckCircle2, Home, MapPin, Phone, Settings2, XCircle } from 'lucide-react';
import { errorMessage, formatDate, formatDateTime, formatMoney, homeLabStatus, homeLabWindowLabel, labStatus, type HomeLabStatus, type LabStatus } from '@app/shared';
import { supabase } from '../../lib/supabase';
import { unwrap, useAsync } from '../../lib/useAsync';
import { useWorkspace } from '../../lib/workspace';
import { Alert, Badge, Button, EmptyState, ErrorState, Ltr, PageHead, Sheet, SkeletonList, Tabs, TextField, TextareaField, useToast } from '../../components/ui';

interface Req {
  id: string; request_number: string; status: HomeLabStatus; patient_name: string; public_code: string; phone: string; address: string;
  latitude: number | null; longitude: number | null; tests: string | null; preferred_date: string; preferred_window: string; notes: string | null;
  scheduled_at: string | null; collector_name: string | null; status_reason: string | null; lab_order_id: string | null;
  lab_order_number: string | null; lab_order_status: LabStatus | null; from_doctor: boolean | null; created_at: string;
}
type Tab = 'new' | 'scheduled' | 'on_the_way' | 'done';
const TAB_STATUSES: Record<Tab, HomeLabStatus[]> = {
  new: ['requested'], scheduled: ['scheduled'], on_the_way: ['on_the_way'], done: ['collected', 'rejected', 'cancelled'],
};

/** The lab's home-visit list: new requests → schedule → on the way → sample collected (the order then joins the normal worklist). */
export function LabHomeRequests() {
  const { current } = useWorkspace();
  const labId = current!.facility_id!;
  const [tab, setTab] = useState<Tab>('new');
  const [open, setOpen] = useState<Req | null>(null);
  const list = useAsync(async () => (await unwrap(supabase.rpc('lab_home_requests', { p_lab_facility_id: labId }))) as unknown as Req[], [labId]);
  const reload = useCallback(() => list.reload(), [list.reload]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const ch = supabase.channel(`homelab:${labId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'home_lab_requests', filter: `lab_facility_id=eq.${labId}` }, reload).subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [labId, reload]);
  const counts = useMemo(() => Object.fromEntries((Object.keys(TAB_STATUSES) as Tab[]).map((t) =>
    [t, (list.data ?? []).filter((r) => TAB_STATUSES[t].includes(r.status)).length])) as Record<Tab, number>, [list.data]);
  const rows = (list.data ?? []).filter((r) => TAB_STATUSES[tab].includes(r.status));

  return (
    <div className="stack">
      <PageHead title="السحب المنزلي" subtitle="طلبات المرضى لسحب العينة من البيت — حدّد الموعد، وحدّث الحالة، فيتابعها المريض على هاتفه." />
      <HomeSettings labId={labId} />
      <Tabs label="حالة الطلبات" value={tab} onChange={setTab} tabs={[
        { id: 'new', label: `جديدة (${counts.new})` }, { id: 'scheduled', label: `مجدولة (${counts.scheduled})` },
        { id: 'on_the_way', label: `بالطريق (${counts.on_the_way})` }, { id: 'done', label: 'المنتهية' },
      ]} />
      <div className="card card-flush">
        {list.status === 'loading' && !list.data && <SkeletonList rows={3} />}
        {list.status === 'error' && <ErrorState error={list.error} onRetry={list.reload} />}
        {list.data && rows.length === 0 && <EmptyState icon={<Home />} title="لا توجد طلبات هنا">تصلك الطلبات الجديدة مع إشعار.</EmptyState>}
        <ul className="list" style={{ margin: 0, padding: 0 }}>
          {rows.map((r) => (
            <li key={r.id} className="list-item" style={{ alignItems: 'flex-start', cursor: 'pointer' }} onClick={() => setOpen(r)}>
              <Home size={18} aria-hidden style={{ marginBlockStart: 4, color: 'var(--c-accent)' }} />
              <div className="grow stack-sm" style={{ gap: 2 }}>
                <div className="row-between"><strong>{r.patient_name}</strong><Badge tone={homeLabStatus[r.status].tone}>{homeLabStatus[r.status].label}</Badge></div>
                <span className="small">{r.tests}</span>
                <span className="small muted"><MapPin size={12} aria-hidden /> {r.address}</span>
                <span className="small muted">
                  {r.scheduled_at ? <>الموعد: {formatDateTime(r.scheduled_at)}{r.collector_name ? ` · ${r.collector_name}` : ''}</>
                    : <>يفضّل: {formatDate(r.preferred_date + 'T12:00:00Z')} — {homeLabWindowLabel(r.preferred_window)}</>}
                  {' · '}<Ltr>{r.request_number}</Ltr>
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <RequestSheet req={open} onClose={() => setOpen(null)} onChanged={() => { setOpen(null); reload(); }} />
    </div>
  );
}

function RequestSheet({ req, onClose, onChanged }: { req: Req | null; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const [when, setWhen] = useState('');
  const [collector, setCollector] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    if (!req) return;
    const hour = req.preferred_window === 'morning' ? '09:00' : req.preferred_window === 'noon' ? '13:00' : '17:00';
    setWhen(req.scheduled_at ? toLocalInput(req.scheduled_at) : `${req.preferred_date}T${hour}`);
    setCollector(req.collector_name ?? ''); setReason('');
  }, [req]);
  if (!req) return null;
  const move = async (status: string, extra: Record<string, unknown> = {}, ok = 'حُدّثت الحالة — وصل إشعار للمريض') => {
    setBusy(status);
    const { error } = await supabase.rpc('lab_update_home_request', { p_request_id: req.id, p_status: status, ...extra });
    setBusy(null);
    if (error) { toast(errorMessage(error), 'danger'); return; }
    toast(ok, 'success'); onChanged();
  };
  const map = req.latitude != null && req.longitude != null ? `https://maps.google.com/?q=${req.latitude},${req.longitude}` : `https://maps.google.com/?q=${encodeURIComponent(req.address)}`;
  return (
    <Sheet open={!!req} onClose={onClose} title={`طلب سحب منزلي ${req.request_number}`}>
      <div className="stack">
        <div className="stack-sm">
          <div className="row-between"><strong>{req.patient_name} <span className="muted small"><Ltr>{req.public_code}</Ltr></span></strong>
            <Badge tone={homeLabStatus[req.status].tone}>{homeLabStatus[req.status].label}</Badge></div>
          <span><strong>التحاليل:</strong> {req.tests}{req.from_doctor ? <span className="small muted"> (طلبها الطبيب)</span> : null}</span>
          <span className="row" style={{ gap: 6 }}><MapPin size={16} aria-hidden />{req.address} — <a href={map} target="_blank" rel="noreferrer">فتح بالخريطة</a></span>
          <span className="row" style={{ gap: 6 }}><Phone size={16} aria-hidden /><a href={`tel:${req.phone}`}><Ltr>{req.phone}</Ltr></a></span>
          <span className="small">يفضّل: {formatDate(req.preferred_date + 'T12:00:00Z')} — {homeLabWindowLabel(req.preferred_window)}</span>
          {req.notes && <span className="small">ملاحظة المريض: {req.notes}</span>}
          {req.status_reason && <Alert tone="warning">{req.status_reason}</Alert>}
          {req.lab_order_id && (
            <span className="small">طلب المختبر <Ltr>{req.lab_order_number}</Ltr>{req.lab_order_status ? ` — ${labStatus[req.lab_order_status].label}` : ''} · <Link to="/workspace/lab">افتحه من «طلبات المختبر»</Link></span>
          )}
        </div>

        {(req.status === 'requested' || req.status === 'scheduled') && (
          <div className="card stack-sm" style={{ padding: 'var(--s-3)' }}>
            <strong className="row" style={{ gap: 6 }}><CalendarClock size={18} aria-hidden />{req.status === 'requested' ? 'قبول وتحديد الموعد' : 'تغيير الموعد'}</strong>
            <div className="row" style={{ gap: 'var(--s-2)' }}>
              <TextField label="الموعد (بتوقيت بغداد)" type="datetime-local" ltr value={when} onChange={(e) => setWhen(e.target.value)} />
              <TextField label="اسم المختص" optional value={collector} onChange={(e) => setCollector(e.target.value)} />
            </div>
            <Button loading={busy === 'scheduled'} disabled={!when} icon={<CalendarClock size={16} />}
                    onClick={() => void move('scheduled', { p_scheduled_at: `${when}:00+03:00`, p_collector_name: collector || null }, 'حُدّد الموعد — وصل إشعار للمريض')}>
              {req.status === 'requested' ? 'قبول وتحديد الموعد' : 'حفظ الموعد الجديد'}
            </Button>
          </div>
        )}
        <div className="row" style={{ gap: 'var(--s-2)' }}>
          {req.status === 'scheduled' && <Button variant="secondary" icon={<Car size={16} />} loading={busy === 'on_the_way'} onClick={() => void move('on_the_way')}>بالطريق للمريض</Button>}
          {(req.status === 'scheduled' || req.status === 'on_the_way') && (
            <Button variant="accent" icon={<CheckCircle2 size={16} />} loading={busy === 'collected'}
                    onClick={() => void move('collected', {}, 'سُجل السحب — الطلب صار في «طلبات المختبر»')}>تم سحب العينة</Button>
          )}
        </div>
        {(req.status === 'requested' || req.status === 'scheduled') && (
          <div className="stack-sm">
            <TextareaField label="سبب الاعتذار" optional hint="يظهر للمريض" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
            <Button variant="ghost" icon={<XCircle size={16} />} disabled={reason.trim().length < 3} loading={busy === 'rejected'}
                    onClick={() => void move('rejected', { p_note: reason }, 'أُبلغ المريض بالاعتذار')}>الاعتذار عن الطلب</Button>
          </div>
        )}
      </div>
    </Sheet>
  );
}

/** On / off, the visit fee and a note shown to patients (e.g. the areas covered). */
function HomeSettings({ labId }: { labId: string }) {
  const toast = useToast();
  type Cfg = { home_collection: boolean; home_collection_fee_minor: number | null; home_collection_note: string | null };
  const s = useAsync(async () => (await unwrap(supabase.from('facilities').select('home_collection, home_collection_fee_minor, home_collection_note').eq('id', labId).single())) as Cfg | null, [labId]);
  const [edit, setEdit] = useState(false);
  const [on, setOn] = useState(false);
  const [fee, setFee] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const cfg: Cfg | null = s.data ?? null;
  useEffect(() => {
    if (!cfg) return;
    setOn(cfg.home_collection); setFee(cfg.home_collection_fee_minor != null ? String(cfg.home_collection_fee_minor) : ''); setNote(cfg.home_collection_note ?? '');
  }, [cfg]);
  const reloadCfg = s.reload;
  if (!cfg) return null;
  const save = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('set_home_collection', { p_lab_facility_id: labId, p_enabled: on, p_fee_minor: fee ? Number(fee) : undefined, p_note: note || undefined });
    setBusy(false);
    if (error) { toast(errorMessage(error), 'danger'); return; }
    toast(on ? 'السحب المنزلي مفعّل — يظهر مختبرك للمرضى' : 'أُوقف استقبال طلبات السحب المنزلي', 'success'); setEdit(false); reloadCfg();
  };
  return (
    <div className="card stack-sm" style={{ padding: 'var(--s-3)' }}>
      <div className="row-between">
        <span className="row" style={{ gap: 8 }}>
          <Badge tone={cfg.home_collection ? 'success' : 'neutral'}>{cfg.home_collection ? 'يستقبل طلبات السحب المنزلي' : 'السحب المنزلي متوقف'}</Badge>
          {cfg.home_collection && cfg.home_collection_fee_minor != null && <span className="small muted">أجور الزيارة {formatMoney(cfg.home_collection_fee_minor)}</span>}
        </span>
        <Button size="sm" variant="ghost" icon={<Settings2 size={16} />} onClick={() => setEdit(!edit)}>الإعدادات</Button>
      </div>
      {edit && (
        <div className="stack-sm">
          <label className="row" style={{ gap: 8 }}><input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} /> استقبال طلبات السحب المنزلي</label>
          <div className="row" style={{ gap: 'var(--s-2)' }}>
            <TextField label="أجور الزيارة (دينار)" optional type="number" min={0} ltr value={fee} onChange={(e) => setFee(e.target.value)} />
            <TextField label="ملاحظة للمرضى" optional hint="مثلاً: المناطق التي نغطيها" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="row"><Button size="sm" loading={busy} onClick={() => void save()}>حفظ</Button></div>
        </div>
      )}
    </div>
  );
}

/** The time box is Baghdad time (UTC+3, no daylight saving), whatever the computer's own clock zone. */
function toLocalInput(iso: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Baghdad', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
