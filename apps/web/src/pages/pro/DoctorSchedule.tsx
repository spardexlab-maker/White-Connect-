import { useEffect, useState } from 'react';
import { CalendarOff, Plus, Save, Trash2 } from 'lucide-react';
import { errorMessage, formatDateTime, formatMoney, weekdayLabel, type Json } from '@app/shared';
import { supabase } from '../../lib/supabase';
import { unwrap, useAsync } from '../../lib/useAsync';
import { useAuth } from '../../lib/auth';
import { useWorkspace } from '../../lib/workspace';
import { Alert, Button, ErrorState, PageHead, SelectField, SkeletonList, TextField, useToast } from '../../components/ui';

interface Slot { weekday: number; start: string; end: string }
const ORDER = [6, 0, 1, 2, 3, 4, 5];

/** Doctor manages their own schedule, visit types and booking policy AT THIS LOCATION. */
export function DoctorSchedule() {
  const { access } = useAuth();
  const { current } = useWorkspace();
  const toast = useToast();
  const facilityId = current!.facility_id!;
  const me = access?.practitioner_id ?? '';

  const data = useAsync(async () => {
    const [sch, svc, pol, exc] = await Promise.all([
      unwrap(supabase.from('schedules').select('weekday, start_local, end_local, valid_until').eq('facility_id', facilityId).eq('practitioner_id', me)),
      unwrap(supabase.from('clinic_services').select('id, name, duration_minutes, buffer_minutes, price_minor, is_active, practitioner_id').eq('facility_id', facilityId)),
      unwrap(supabase.from('booking_policies').select('*').eq('facility_id', facilityId)),
      unwrap(supabase.from('schedule_exceptions').select('id, period, kind, reason').eq('practitioner_id', me).order('created_at', { ascending: false }).limit(20)),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    return {
      slots: (sch ?? []).filter((s) => !s.valid_until || s.valid_until >= today).map((s) => ({ weekday: s.weekday, start: s.start_local.slice(0, 5), end: s.end_local.slice(0, 5) })) as Slot[],
      services: (svc ?? []).filter((s) => s.practitioner_id === me || s.practitioner_id === null),
      policy: (pol ?? []).find((p) => p.practitioner_id === me) ?? (pol ?? []).find((p) => p.practitioner_id === null) ?? null,
      exceptions: exc ?? [],
    };
  }, [facilityId, me]);

  const [slots, setSlots] = useState<Slot[]>([]);
  useEffect(() => { if (data.data) setSlots(data.data.slots); }, [data.data]);
  const [saving, setSaving] = useState(false);

  const saveSchedule = async () => {
    for (const s of slots) if (s.end <= s.start) { toast('وقت النهاية يجب أن يكون بعد البداية', 'danger'); return; }
    setSaving(true);
    const { error } = await supabase.rpc('set_weekly_schedule', { p_facility_id: facilityId, p_practitioner_id: me, p_slots: slots as unknown as Json });
    setSaving(false);
    if (error) toast(errorMessage(error), 'danger'); else { toast('تم حفظ الجدول الأسبوعي — المواعيد السابقة لا تتغير', 'success'); data.reload(); }
  };

  if (data.status === 'loading' && !data.data) return <SkeletonList />;
  if (data.status === 'error') return <ErrorState error={data.error} onRetry={data.reload} />;

  return (
    <div className="stack">
      <PageHead title="الجدول والخدمات" subtitle={`${current!.facility_name} — ${current!.branch_name}`} />
      <div className="two-col">
        <section className="card stack" aria-labelledby="week-title">
          <div className="row-between"><h2 id="week-title" className="section-title">الجدول الأسبوعي (بتوقيت المنشأة)</h2>
            <Button size="sm" icon={<Save size={16} />} loading={saving} onClick={saveSchedule}>حفظ</Button></div>
          {ORDER.map((d) => {
            const daySlots = slots.map((s, i) => ({ s, i })).filter(({ s }) => s.weekday === d);
            return (
              <div key={d} className="stack-sm" style={{ borderBlockEnd: '1px solid var(--c-border)', paddingBlockEnd: 'var(--s-3)' }}>
                <div className="row-between">
                  <strong>{weekdayLabel[d]}</strong>
                  <Button size="sm" variant="ghost" icon={<Plus size={16} />} onClick={() => setSlots([...slots, { weekday: d, start: '16:00', end: '20:00' }])}>فترة</Button>
                </div>
                {daySlots.length === 0 && <span className="small muted">عطلة</span>}
                {daySlots.map(({ s, i }) => (
                  <div key={i} className="row" style={{ flexWrap: 'nowrap' }}>
                    <label className="sr-only" htmlFor={`s${i}`}>من</label>
                    <input id={`s${i}`} type="time" className="input input-ltr" value={s.start} onChange={(e) => setSlots(slots.map((x, j) => j === i ? { ...x, start: e.target.value } : x))} />
                    <span aria-hidden>–</span>
                    <label className="sr-only" htmlFor={`e${i}`}>إلى</label>
                    <input id={`e${i}`} type="time" className="input input-ltr" value={s.end} onChange={(e) => setSlots(slots.map((x, j) => j === i ? { ...x, end: e.target.value } : x))} />
                    <button className="icon-btn" aria-label="حذف الفترة" onClick={() => setSlots(slots.filter((_, j) => j !== i))}><Trash2 size={18} /></button>
                  </div>
                ))}
              </div>
            );
          })}
          <p className="small muted">الاستراحات تُمثَّل بتقسيم اليوم لفترتين. لا يمكن حجز الطبيب في موقعين بنفس الوقت حتى لو تداخلت الجداول.</p>
        </section>

        <div className="stack">
          <ServicesCard facilityId={facilityId} me={me} services={data.data!.services} onChange={data.reload} />
          <PolicyCard facilityId={facilityId} me={me} policy={data.data!.policy} onChange={data.reload} />
          <ExceptionCard facilityId={facilityId} me={me} exceptions={data.data!.exceptions as { id: string; period: string; kind: string; reason: string | null }[]} onChange={data.reload} />
        </div>
      </div>
    </div>
  );
}

function ServicesCard({ facilityId, me, services, onChange }: { facilityId: string; me: string; services: { id: string; name: string; duration_minutes: number; buffer_minutes: number; price_minor: number | null; is_active: boolean }[]; onChange: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', duration: '20', buffer: '0', price: '' });
  const [busy, setBusy] = useState(false);
  const add = async () => {
    if (!form.name.trim()) { toast('اكتب اسم الخدمة', 'danger'); return; }
    setBusy(true);
    const { error } = await supabase.rpc('upsert_clinic_service', {
      p_facility_id: facilityId, p_practitioner_id: me, p_name: form.name.trim(), p_duration_minutes: Number(form.duration),
      p_buffer_minutes: Number(form.buffer) || 0, p_price_minor: form.price ? Number(form.price) : undefined,
    });
    setBusy(false);
    if (error) toast(errorMessage(error), 'danger'); else { setForm({ name: '', duration: '20', buffer: '0', price: '' }); onChange(); }
  };
  const toggle = async (s: (typeof services)[number]) => {
    const { error } = await supabase.rpc('upsert_clinic_service', {
      p_facility_id: facilityId, p_practitioner_id: me, p_service_id: s.id, p_name: s.name, p_duration_minutes: s.duration_minutes,
      p_buffer_minutes: s.buffer_minutes, p_price_minor: s.price_minor ?? undefined, p_is_active: !s.is_active,
    });
    if (error) toast(errorMessage(error), 'danger'); else onChange();
  };
  return (
    <section className="card stack" aria-labelledby="svc-title">
      <h2 id="svc-title" className="section-title">أنواع الزيارة</h2>
      <div className="table-wrap" role="region" aria-label="أنواع الزيارة" tabIndex={0}>
        <table className="table">
          <thead><tr><th>الخدمة</th><th>المدة</th><th>فاصل</th><th>السعر</th><th>الحالة</th></tr></thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td><td className="num">{s.duration_minutes} د</td><td className="num">{s.buffer_minutes} د</td>
                <td>{formatMoney(s.price_minor)}</td>
                <td><Button size="sm" variant="ghost" onClick={() => toggle(s)}>{s.is_active ? 'مفعّلة — إيقاف' : 'موقوفة — تفعيل'}</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div className="grow"><TextField label="خدمة جديدة" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div style={{ width: 90 }}><TextField label="المدة" inputMode="numeric" ltr value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} /></div>
        <div style={{ width: 90 }}><TextField label="فاصل" inputMode="numeric" ltr value={form.buffer} onChange={(e) => setForm({ ...form, buffer: e.target.value })} /></div>
        <div style={{ width: 120 }}><TextField label="السعر (د.ع)" inputMode="numeric" ltr value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
        <Button icon={<Plus size={16} />} loading={busy} onClick={add}>إضافة</Button>
      </div>
      <p className="small muted">تغيير المدة لاحقاً لا يغيّر المواعيد المحجوزة سابقاً (تُحفظ نسخة المدة في كل موعد).</p>
    </section>
  );
}

function PolicyCard({ facilityId, me, policy, onChange }: { facilityId: string; me: string; policy: Record<string, unknown> | null; onChange: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({
    mode: String(policy?.confirmation_mode ?? 'manual'), timeout: String(policy?.confirmation_timeout_minutes ?? 120),
    window: String(policy?.booking_window_days ?? 30), notice: String(policy?.min_notice_minutes ?? 30),
    cutoff: String(policy?.cancellation_cutoff_minutes ?? 120), text: String(policy?.cancellation_policy_text ?? ''),
  });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('set_booking_policy', {
      p_facility_id: facilityId, p_practitioner_id: me, p_confirmation_mode: f.mode, p_confirmation_timeout_minutes: Number(f.timeout),
      p_booking_window_days: Number(f.window), p_min_notice_minutes: Number(f.notice), p_cancellation_cutoff_minutes: Number(f.cutoff),
      p_cancellation_policy_text: f.text || undefined,
    });
    setBusy(false);
    if (error) toast(errorMessage(error), 'danger'); else { toast('تم حفظ سياسة الحجز', 'success'); onChange(); }
  };
  return (
    <section className="card stack" aria-labelledby="pol-title">
      <h2 id="pol-title" className="section-title">سياسة الحجز والتأكيد</h2>
      <SelectField label="التأكيد" value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })}>
        <option value="manual">يدوي من السكرتير (الوقت محجوز خلال المهلة)</option>
        <option value="auto">تلقائي فور الحجز</option>
      </SelectField>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="grow"><TextField label="مهلة التأكيد (دقيقة)" inputMode="numeric" ltr value={f.timeout} onChange={(e) => setF({ ...f, timeout: e.target.value })} /></div>
        <div className="grow"><TextField label="نافذة الحجز (يوم)" inputMode="numeric" ltr value={f.window} onChange={(e) => setF({ ...f, window: e.target.value })} /></div>
      </div>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="grow"><TextField label="أقل مدة قبل الموعد (دقيقة)" inputMode="numeric" ltr value={f.notice} onChange={(e) => setF({ ...f, notice: e.target.value })} /></div>
        <div className="grow"><TextField label="مهلة الإلغاء (دقيقة)" inputMode="numeric" ltr value={f.cutoff} onChange={(e) => setF({ ...f, cutoff: e.target.value })} /></div>
      </div>
      <TextField label="نص سياسة الإلغاء للمريض" optional value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} />
      <Button icon={<Save size={16} />} loading={busy} onClick={save}>حفظ السياسة</Button>
    </section>
  );
}

function ExceptionCard({ facilityId, me, exceptions, onChange }: { facilityId: string; me: string; exceptions: { id: string; period: string; kind: string; reason: string | null }[]; onChange: () => void }) {
  const toast = useToast();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const add = async () => {
    if (!from || !to || to <= from) { toast('حدد بداية ونهاية صحيحتين', 'danger'); return; }
    setBusy(true);
    const { error } = await supabase.rpc('add_schedule_exception', {
      p_facility_id: facilityId, p_practitioner_id: me, p_starts_at: new Date(from).toISOString(), p_ends_at: new Date(to).toISOString(),
      p_kind: 'unavailable', p_reason: reason || undefined,
    });
    setBusy(false);
    if (error) toast(errorMessage(error), 'danger'); else { setFrom(''); setTo(''); setReason(''); onChange(); }
  };
  const parse = (p: string) => { const m = p.match(/^[[(]"?([^",]+)"?,"?([^")\]]+)"?[)\]]$/); return m ? [m[1], m[2]] : [p, '']; };
  return (
    <section className="card stack" aria-labelledby="exc-title">
      <h2 id="exc-title" className="section-title row"><CalendarOff size={18} aria-hidden />إجازة أو عدم توفر</h2>
      <Alert tone="info">تمنع الحجوزات الجديدة في الفترة؛ لا تُلغى المواعيد الموجودة آلياً.</Alert>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div className="grow"><TextField label="من" type="datetime-local" ltr value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="grow"><TextField label="إلى" type="datetime-local" ltr value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </div>
      <TextField label="السبب" optional value={reason} onChange={(e) => setReason(e.target.value)} />
      <Button variant="secondary" loading={busy} onClick={add}>إضافة فترة عدم توفر</Button>
      {exceptions.length > 0 && (
        <ul className="list" style={{ margin: 0, padding: 0 }}>
          {exceptions.map((e) => { const [a, b] = parse(e.period); return (
            <li key={e.id} className="list-item" style={{ paddingInline: 0 }}>
              <span className="small">{formatDateTime(a)} ← {b ? formatDateTime(b) : ''}{e.reason ? ` · ${e.reason}` : ''}</span>
            </li>
          ); })}
        </ul>
      )}
    </section>
  );
}
