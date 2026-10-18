import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ChevronDown, ChevronUp, Clock, Printer, ScanLine, Search, UserPlus, Users } from 'lucide-react';
import QRCode from 'qrcode';
import {
  addDays, errorMessage, fieldErrors, formatMoney, formatTime, localDateKey, quickBookingSchema,
} from '@app/shared';
import { supabase, productName } from '../../lib/supabase';
import { unwrap, useAsync } from '../../lib/useAsync';
import { newIdempotencyKey } from '../../lib/idempotency';
import { useOnline } from '../../lib/useOnline';
import { Alert, Badge, Button, Ltr, SelectField, Sheet, TextField, TextareaField, useToast } from '../../components/ui';

export interface Practitioner {
  practitioner_id: string; full_name: string; specialty: string | null;
  services: { id: string; name: string; duration_minutes: number; price_minor: number | null; is_active: boolean }[];
}

export function usePractitioners(facilityId: string) {
  return useAsync(async () => (await unwrap(supabase.rpc('reception_practitioners', { p_facility_id: facilityId }))) as unknown as Practitioner[], [facilityId]);
}

/* ------------------------------------------------------------------ */
/* Slot picker (server-computed; staff mode includes near-term slots)  */
/* ------------------------------------------------------------------ */
export function SlotPicker({ facilityId, practitionerId, serviceId, date, value, onChange, timezone }: {
  facilityId: string; practitionerId: string; serviceId: string; date: string; value: string | null;
  onChange: (v: string | null) => void; timezone: string;
}) {
  const slots = useAsync(async () => {
    if (!serviceId) return [];
    return (await unwrap(supabase.rpc('get_available_slots', {
      p_facility_id: facilityId, p_practitioner_id: practitionerId, p_service_id: serviceId, p_from: date, p_to: date, p_for_staff: true,
    }))) as { slot_start: string }[];
  }, [facilityId, practitionerId, serviceId, date]);
  if (!serviceId) return null;
  if (slots.status === 'loading') return <span className="small muted">جارٍ جلب الأوقات الشاغرة…</span>;
  if (slots.status === 'error') return <Alert tone="danger">{errorMessage(slots.error)}</Alert>;
  if (!slots.data.length) return <span className="small muted">لا يوجد وقت شاغر في هذا اليوم — يمكن الإضافة إلى قائمة الانتظار.</span>;
  return (
    <div className="slot-grid" role="radiogroup" aria-label="الأوقات الشاغرة">
      {slots.data.map((s) => (
        <button type="button" key={s.slot_start} role="radio" aria-checked={value === s.slot_start} aria-pressed={value === s.slot_start}
                className="slot-btn num" onClick={() => onChange(value === s.slot_start ? null : s.slot_start)}>
          {formatTime(s.slot_start, timezone)}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Quick booking panel: "name only" or existing patient (§7, §24)      */
/* ------------------------------------------------------------------ */
interface Candidate {
  patient_id: string; public_code: string; full_name: string; sex: 'male' | 'female' | null; birth_year: number | null;
  phone_masked: string | null; is_provisional: boolean; has_account: boolean; known_here: boolean;
}

export function QuickBookSheet({ open, onClose, facilityId, timezone, practitioners, defaultPractitionerId, defaultDate, onBooked }: {
  open: boolean; onClose: () => void; facilityId: string; timezone: string; practitioners: Practitioner[];
  defaultPractitionerId?: string; defaultDate: string; onBooked: (r: { patientId: string; bookingNumber?: string; waitlist: boolean }) => void;
}) {
  const toast = useToast();
  const online = useOnline();
  const [mode, setMode] = useState<'name' | 'existing'>('name');
  const [practitionerId, setPractitionerId] = useState(defaultPractitionerId ?? practitioners[0]?.practitioner_id ?? '');
  const doctor = practitioners.find((p) => p.practitioner_id === practitionerId);
  const services = (doctor?.services ?? []).filter((s) => s.is_active);
  const [serviceId, setServiceId] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [slot, setSlot] = useState<string | null>(null);
  const [waitlist, setWaitlist] = useState(false);
  const [form, setForm] = useState({ fullName: '', phone: '', sex: '', birthYear: '' });
  const [showExtra, setShowExtra] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [idemKey, setIdemKey] = useState(() => newIdempotencyKey('rq'));
  // existing patient
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [picked, setPicked] = useState<Candidate | null>(null);
  const [verification, setVerification] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setForm({ fullName: '', phone: '', sex: '', birthYear: '' }); setSlot(null); setWaitlist(false); setErrors({}); setServerError(null);
    setPicked(null); setCandidates(null); setQuery(''); setVerification(''); setIdemKey(newIdempotencyKey('rq')); setDate(defaultDate);
    if (defaultPractitionerId) setPractitionerId(defaultPractitionerId);
  }, [open, defaultDate, defaultPractitionerId]);
  useEffect(() => { setServiceId(services[0]?.id ?? ''); setSlot(null); }, [practitionerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const search = async (e?: FormEvent) => {
    e?.preventDefault();
    setServerError(null); setPicked(null);
    const { data, error } = await supabase.rpc('lookup_patients', { p_facility_id: facilityId, p_query: query.trim() });
    if (error) { setServerError(errorMessage(error)); setCandidates(null); return; }
    setCandidates(data as Candidate[]);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setServerError(null);
    if (!practitionerId) return;
    if (!waitlist && !slot) { setErrors({ slot: 'اختر وقتاً شاغراً أو أضف المريض لقائمة الانتظار' }); return; }
    let patientId: string | undefined;
    if (mode === 'name') {
      const parsed = quickBookingSchema.safeParse({ fullName: form.fullName, phone: form.phone, sex: form.sex || undefined, birthYear: form.birthYear || undefined });
      const errs = fieldErrors(parsed);
      setErrors(errs);
      if (!parsed.success) { nameRef.current?.focus(); return; }
    } else {
      if (!picked) { setErrors({ picked: 'اختر المريض من نتائج البحث' }); return; }
      if (!picked.known_here) {
        if (verification.trim().length < 3) { setErrors({ verification: 'سجّل كيف تحققت من الهوية' }); return; }
        const { error } = await supabase.rpc('attach_patient_to_facility', { p_facility_id: facilityId, p_patient_id: picked.patient_id, p_verification_note: verification });
        if (error) { setServerError(errorMessage(error)); return; }
      }
      patientId = picked.patient_id;
    }
    setErrors({});
    setBusy(true);
    const { data, error } = await supabase.rpc('reception_quick_book', {
      p_facility_id: facilityId, p_practitioner_id: practitionerId, p_idempotency_key: idemKey,
      p_patient_id: patientId, p_new_patient_name: mode === 'name' ? form.fullName.trim() : undefined,
      p_service_id: waitlist ? undefined : serviceId, p_start: waitlist ? undefined : slot ?? undefined,
      p_phone: mode === 'name' && form.phone ? form.phone : undefined,
      p_sex: mode === 'name' && form.sex ? (form.sex as 'male' | 'female') : undefined,
      p_birth_year: mode === 'name' && form.birthYear ? Number(form.birthYear) : undefined,
    });
    setBusy(false);
    if (error) {
      setServerError(errorMessage(error));
      setIdemKey(newIdempotencyKey('rq')); setSlot(null);
      return;
    }
    const r = data as { patient_id: string; booking_number?: string };
    toast(waitlist ? 'أُضيف المريض إلى قائمة الانتظار' : `تم الحجز — رقم ${r.booking_number}`, 'success');
    onBooked({ patientId: r.patient_id, bookingNumber: r.booking_number, waitlist });
  };

  const service = services.find((s) => s.id === serviceId);

  return (
    <Sheet open={open} onClose={onClose} title="حجز سريع"
           footer={<>
             <Button type="submit" form="quick-book" loading={busy} disabled={!online} block icon={<UserPlus size={18} />}>
               {busy ? 'جارٍ الحفظ…' : waitlist ? 'إضافة إلى الانتظار' : 'تثبيت الحجز'}
             </Button>
           </>}>
      <form id="quick-book" className="stack" onSubmit={submit} noValidate>
        <div className="segmented block" role="group" aria-label="نوع المريض">
          <button type="button" aria-pressed={mode === 'name'} onClick={() => setMode('name')}>اسم فقط</button>
          <button type="button" aria-pressed={mode === 'existing'} onClick={() => setMode('existing')}>مريض موجود</button>
        </div>

        {mode === 'name' ? (
          <div className="stack-sm">
            <TextField ref={nameRef} label="اسم المريض" required autoFocus data-autofocus value={form.fullName} error={errors.fullName}
                       onChange={(e) => setForm({ ...form, fullName: e.target.value })} hint="لا يلزم هاتف أو حساب أو رمز تحقق." />
            <button type="button" className="location-btn" aria-expanded={showExtra} onClick={() => setShowExtra((v) => !v)}>
              {showExtra ? <ChevronUp size={16} aria-hidden /> : <ChevronDown size={16} aria-hidden />}بيانات إضافية (اختيارية)
            </button>
            {showExtra && (
              <div className="stack-sm">
                <TextField label="الهاتف" optional type="tel" ltr inputMode="tel" value={form.phone} error={errors.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                  <div className="grow"><SelectField label="الجنس" optional value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })}>
                    <option value="">—</option><option value="female">أنثى</option><option value="male">ذكر</option>
                  </SelectField></div>
                  <div className="grow"><TextField label="سنة الميلاد" optional inputMode="numeric" ltr value={form.birthYear} error={errors.birthYear} onChange={(e) => setForm({ ...form, birthYear: e.target.value })} /></div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="stack-sm">
            <div className="field">
              <label htmlFor="lookup">بحث بالهاتف أو معرّف المريض أو رمز QR أو الاسم</label>
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <div className="input-icon grow">
                  <ScanLine size={18} aria-hidden />
                  <input id="lookup" className="input" value={query} onChange={(e) => setQuery(e.target.value)} data-autofocus
                         onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void search(); } }} placeholder="0780… أو P… أو امسح البطاقة" />
                </div>
                <Button variant="secondary" icon={<Search size={16} />} onClick={() => void search()} disabled={query.trim().length < 3}>بحث</Button>
              </div>
              <span className="hint">ماسح QR يعمل ككيبورد: امسح البطاقة في هذا الحقل. البحث بالاسم يقتصر على مرضى هذه المنشأة.</span>
              {errors.picked && <span className="error" role="alert">{errors.picked}</span>}
            </div>
            {candidates && candidates.length === 0 && <Alert tone="info">لا توجد نتائج. يمكنك التبديل إلى «اسم فقط» لإنشاء سجل جديد.</Alert>}
            {candidates && candidates.length > 1 && <Alert tone="warning">عدة سجلات مطابقة — تحقق من الهوية واختر الشخص الصحيح. لا يتم الدمج تلقائياً.</Alert>}
            <div className="stack-sm" role="radiogroup" aria-label="المرشحون">
              {candidates?.map((c) => (
                <button type="button" key={c.patient_id} className="lookup-result" role="radio" aria-checked={picked?.patient_id === c.patient_id}
                        aria-pressed={picked?.patient_id === c.patient_id} onClick={() => setPicked(c)} style={{ textAlign: 'start', background: undefined, cursor: 'pointer' }}>
                  <Users size={18} aria-hidden />
                  <span className="grow">
                    <strong style={{ display: 'block' }}>{c.full_name}</strong>
                    <span className="small muted">
                      <Ltr>{c.public_code}</Ltr>{c.birth_year ? ` · مواليد ${c.birth_year}` : ''}{c.sex ? ` · ${c.sex === 'female' ? 'أنثى' : 'ذكر'}` : ''}
                      {c.phone_masked && <> · <Ltr>{c.phone_masked}</Ltr></>}
                    </span>
                  </span>
                  {c.known_here ? <Badge tone="success">مسجل هنا</Badge> : <Badge tone="warning">يحتاج تحقق</Badge>}
                </button>
              ))}
            </div>
            {picked && !picked.known_here && (
              <TextareaField label="طريقة التحقق من الهوية" required value={verification} error={errors.verification}
                             onChange={(e) => setVerification(e.target.value)} placeholder="مثال: اطلعت على الهوية الوطنية" style={{ minHeight: 64 }} />
            )}
          </div>
        )}

        <hr className="divider" />
        <SelectField label="الطبيب" value={practitionerId} onChange={(e) => setPractitionerId(e.target.value)}>
          {practitioners.map((p) => <option key={p.practitioner_id} value={p.practitioner_id}>{p.full_name}</option>)}
        </SelectField>
        <label className="row small" style={{ gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={waitlist} onChange={(e) => { setWaitlist(e.target.checked); setSlot(null); }} />
          إضافة إلى قائمة الانتظار المعلنة (مريض عابر — اليوم)
        </label>
        {!waitlist && (
          <>
            <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
              <div className="grow"><SelectField label="نوع الزيارة" value={serviceId} onChange={(e) => { setServiceId(e.target.value); setSlot(null); }}>
                {services.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.duration_minutes} د</option>)}
              </SelectField></div>
              <div style={{ width: 168 }}><TextField label="التاريخ" type="date" ltr value={date} min={localDateKey(new Date())} max={addDays(localDateKey(new Date()), 90)} onChange={(e) => { setDate(e.target.value); setSlot(null); }} /></div>
            </div>
            <div className="field">
              <span className="field-label"><Clock size={14} aria-hidden style={{ verticalAlign: '-2px' }} /> الوقت الشاغر {service ? `(${formatMoney(service.price_minor)})` : ''}</span>
              <SlotPicker facilityId={facilityId} practitionerId={practitionerId} serviceId={serviceId} date={date} value={slot} onChange={setSlot} timezone={timezone} />
              {errors.slot && <span className="error" role="alert">{errors.slot}</span>}
            </div>
          </>
        )}
        {serverError && <Alert tone="danger">{serverError}</Alert>}
        {!online && <Alert tone="warning">لا يوجد اتصال — لا يمكن تثبيت الحجز الآن.</Alert>}
        <p className="small muted">يتم التحقق من توفر الوقت في الخادم عند التثبيت؛ إن سبقك حجز آخر ستظهر رسالة لاختيار وقت مختلف.</p>
      </form>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Printable identity card for a patient without the app               */
/* ------------------------------------------------------------------ */
export function PrintCardDialog({ facilityId, patientId, onClose }: { facilityId: string; patientId: string | null; onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const card = useAsync(async () => {
    if (!patientId) return null;
    return (await unwrap(supabase.rpc('issue_patient_card', { p_facility_id: facilityId, p_patient_id: patientId }))) as unknown as { public_code: string; full_name: string; qr_token: string };
  }, [facilityId, patientId]);
  useEffect(() => {
    if (card.data && canvas.current) void QRCode.toCanvas(canvas.current, card.data.qr_token, { width: 200, margin: 1 });
  }, [card.data]);
  const today = useMemo(() => new Date(), []);
  if (!patientId) return null;
  return (
    <Sheet open onClose={onClose} title="بطاقة تعريف المريض" footer={<Button icon={<Printer size={18} />} onClick={() => window.print()} disabled={!card.data}>طباعة</Button>}>
      {card.status === 'error' && <Alert tone="danger">{errorMessage(card.error)}</Alert>}
      {card.data && (
        <div className="print-card card stack" style={{ alignItems: 'center', textAlign: 'center' }}>
          <strong>{productName}</strong>
          <canvas ref={canvas} aria-label="رمز QR" />
          <span className="code-pill">{card.data.public_code}</span>
          <span>{card.data.full_name}</span>
          <span className="small muted">صدرت {today.toLocaleDateString('ar-IQ')} — البطاقة للتعريف فقط ولا تمنح إذناً بالاطلاع على السجل.</span>
        </div>
      )}
    </Sheet>
  );
}
