import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, CalendarCheck2, CalendarX2, Clock, LogIn, Moon, Sun, Wallet } from 'lucide-react';
import {
  addDays, errorCode, errorMessage, formatDate, formatDateShort, formatDateTime, formatMoney, formatTime,
  localDateKey, weekdayLabel, weekdayOf,
} from '@app/shared';
import { supabase } from '../../lib/supabase';
import { unwrap, useAsync } from '../../lib/useAsync';
import { useAuth } from '../../lib/auth';
import { newIdempotencyKey } from '../../lib/idempotency';
import { useOnline } from '../../lib/useOnline';
import { Alert, AppointmentStatusBadge, Avatar, Button, EmptyState, ErrorState, Skeleton, SkeletonList, SuccessMark } from '../../components/ui';
import { useProviderProfile } from './Provider';

type Step = 1 | 2 | 3 | 4;
interface Slot { slot_start: string; slot_end: string }
interface Draft { facilityId: string; practitionerId?: string; serviceId: string; slot: string; note?: string }
const DRAFT_KEY = 'booking.draft';

export function BookingFlow() {
  const { facilityId, practitionerId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { session, access, refreshAccess } = useAuth();
  const online = useOnline();
  const profile = useProviderProfile(facilityId, practitionerId);

  const restored = useMemo<Draft | null>(() => {
    try {
      const d = JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? 'null') as Draft | null;
      return d && d.facilityId === facilityId && (d.practitionerId ?? null) === (practitionerId ?? null) ? d : null;
    } catch { return null; }
  }, [facilityId, practitionerId]);

  const [step, setStep] = useState<Step>(restored ? 3 : params.get('service') ? 2 : 1);
  const [serviceId, setServiceId] = useState<string | null>(restored?.serviceId ?? params.get('service'));
  const today = useMemo(() => localDateKey(new Date()), []);
  const [day, setDay] = useState<string>(restored ? localDateKey(new Date(restored.slot)) : today);
  const [slot, setSlot] = useState<string | null>(restored?.slot ?? null);
  const [note, setNote] = useState(restored?.note ?? '');
  const [patientId, setPatientId] = useState<string | null>(null);
  const [idemKey, setIdemKey] = useState(() => newIdempotencyKey('book'));
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [result, setResult] = useState<{ id: string; booking_number: string; status: 'awaiting_confirmation' | 'confirmed'; confirmation_deadline: string | null; period: string } | null>(null);
  const [staleNotice, setStaleNotice] = useState(false);

  const p = profile.data;
  const service = p?.services.find((s) => s.id === serviceId) ?? null;
  const horizon = Math.min(p?.policy.booking_window_days ?? 14, 21);

  const slots = useAsync(async () => {
    if (!serviceId || !facilityId) return [] as Slot[];
    return (await unwrap(supabase.rpc('get_available_slots', {
      p_facility_id: facilityId, p_practitioner_id: (practitionerId ?? null) as string, p_service_id: serviceId,
      p_from: today, p_to: addDays(today, horizon),
    }))) as Slot[];
  }, [facilityId, practitionerId, serviceId, today, horizon]);

  const byDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots.data ?? []) {
      const k = localDateKey(new Date(s.slot_start));
      map.set(k, [...(map.get(k) ?? []), s]);
    }
    return map;
  }, [slots.data]);

  // After returning from sign-in: re-check the chosen slot is still free.
  useEffect(() => {
    if (!restored || slots.status !== 'success') return;
    sessionStorage.removeItem(DRAFT_KEY);
    if (!slots.data.some((s) => s.slot_start === restored.slot)) {
      setStaleNotice(true); setSlot(null); setStep(2);
    }
  }, [restored, slots.status, slots.data]);

  useEffect(() => {
    if (access?.patient_ids?.length && !patientId) {
      setPatientId((access.patient_ids.find((x) => x.relationship === 'self') ?? access.patient_ids[0]).patient_id);
    }
  }, [access, patientId]);

  const patients = useAsync(async () => {
    if (!session) return [];
    return (await unwrap(supabase.from('patients').select('id, full_name, public_code'))) ?? [];
  }, [session?.user.id]);

  if (profile.status === 'loading') return <div className="card"><SkeletonList rows={3} /></div>;
  if (profile.status === 'error') return <div className="card"><ErrorState error={profile.error} onRetry={profile.reload} /></div>;
  if (!p) return <div className="card"><EmptyState icon={<CalendarX2 />} title="لا يمكن الحجز لدى مقدم الخدمة هذا حالياً" /></div>;

  const name = p.practitioner?.full_name ?? p.facility.name;
  const offDays = new Set([0, 1, 2, 3, 4, 5, 6].filter((d) => !p.weekly_hours.some((h) => h.weekday === d)));

  const goSignIn = () => {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ facilityId, practitionerId, serviceId, slot, note }));
    navigate(`/patient/account?next=${encodeURIComponent(location.pathname)}`);
  };

  const submit = async () => {
    if (!slot || !serviceId || !patientId) return;
    setSubmitting(true); setSubmitError(null);
    const { data, error } = await supabase.rpc('book_appointment', {
      p_patient_id: patientId, p_facility_id: p.facility.id, p_practitioner_id: (p.practitioner?.id ?? null) as string,
      p_service_id: serviceId, p_start: slot, p_idempotency_key: idemKey, p_source: 'web', p_patient_note: note || undefined,
    });
    setSubmitting(false);
    if (error) {
      setSubmitError(error);
      if (errorCode(error) === 'slot_unavailable') { setSlot(null); slots.reload(); setIdemKey(newIdempotencyKey('book')); }
      return;
    }
    setResult(data as unknown as NonNullable<typeof result>);
    setStep(4);
  };

  const steps = ['الخدمة', 'الموعد', 'المراجعة', 'الإرسال'];
  const daySlots = byDay.get(day) ?? [];
  const groups: [string, ReactNode, Slot[]][] = [
    ['صباحاً', <Sun size={14} aria-hidden key="s" />, daySlots.filter((x) => hourIn(x.slot_start, p.facility.timezone) < 12)],
    ['بعد الظهر والمساء', <Moon size={14} aria-hidden key="m" />, daySlots.filter((x) => hourIn(x.slot_start, p.facility.timezone) >= 12)],
  ];

  return (
    <div className="stack" style={{ gap: 'var(--s-4)' }}>
      <div className="row">
        <Link to={`/patient/provider/${p.facility.id}${p.practitioner ? `/${p.practitioner.id}` : ''}`} className="btn btn-ghost btn-sm"><ArrowRight size={16} aria-hidden />{name}</Link>
      </div>
      <div className="booking">
        <div className="stack">
          <div className="progress">
            <ol className="stepper" aria-label="مراحل الحجز">
              {steps.map((label, i) => (
                <li key={label} aria-current={step === i + 1 ? 'step' : undefined} className={step > i + 1 ? 'done' : ''}>
                  <span className="n">{i + 1}</span><span>{label}</span>
                </li>
              ))}
            </ol>
            <div className="progress-bar" aria-hidden><span style={{ width: `${(step / steps.length) * 100}%` }} /></div>
          </div>

          {step === 1 && (
            <section className="card stack" aria-labelledby="s1" key="s1">
              <div className="step-head"><h1 id="s1">اختر نوع الزيارة</h1><span className="muted small">{p.services.length} خدمة</span></div>
              <div className="radio-cards" role="radiogroup" aria-label="الخدمات">
                {p.services.map((sv) => (
                  <label key={sv.id} className="radio-card">
                    <input type="radio" name="service" value={sv.id} checked={serviceId === sv.id} onChange={() => { setServiceId(sv.id); setSlot(null); }} />
                    <strong>{sv.name}</strong>
                    <span className="small muted row" style={{ gap: 8 }}><span><Clock size={13} aria-hidden style={{ verticalAlign: '-2px' }} /> {sv.duration_minutes} دقيقة</span><span>{formatMoney(sv.price_minor, sv.currency)}</span></span>
                    {sv.preparation_note && <span className="small" style={{ color: 'var(--c-warning)' }}>{sv.preparation_note}</span>}
                  </label>
                ))}
              </div>
              <div className="row" style={{ justifyContent: 'flex-end' }}>
                <Button disabled={!serviceId} onClick={() => setStep(2)}>التالي: اختيار الموعد</Button>
              </div>
            </section>
          )}

          {step === 2 && service && (
            <section className="card stack" aria-labelledby="s2" key="s2">
              <div className="step-head"><h1 id="s2">اختر اليوم والوقت</h1><span className="muted small">{service.name} · {service.duration_minutes} دقيقة</span></div>
              {staleNotice && <Alert tone="warning" title="تغيّر التوفر">الوقت الذي اخترته سابقاً لم يعد متاحاً. اختر وقتاً آخر.</Alert>}
              {slots.status === 'error' && <ErrorState error={slots.error} onRetry={slots.reload} />}
              <div className="day-strip" role="group" aria-label="الأيام">
                {Array.from({ length: horizon + 1 }, (_, i) => addDays(today, i)).map((k) => {
                  const wd = weekdayOf(k);
                  const count = byDay.get(k)?.length ?? 0;
                  const state = offDays.has(wd) ? 'عطلة' : count ? `${count} متاح` : slots.status === 'loading' ? '…' : 'ممتلئ';
                  return (
                    <button key={k} className="day-btn" aria-pressed={day === k} disabled={!count}
                            onClick={() => { setDay(k); setSlot(null); }}
                            aria-label={`${weekdayLabel[wd]} ${formatDateShort(k + 'T12:00:00Z')} — ${state}`}>
                      <span className="d-name">{k === today ? 'اليوم' : weekdayLabel[wd]}</span>
                      <span className="d-num num">{Number(k.slice(8))}</span>
                      <span className="d-state">{state}</span>
                    </button>
                  );
                })}
              </div>
              <div className="stack-sm slot-day" key={day}>
                <h2 className="section-title" style={{ fontSize: 'var(--f-body-lg)' }}>{formatDate(day + 'T12:00:00Z')}</h2>
                {slots.status === 'loading' ? (
                  <div className="slot-grid" aria-busy="true">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} height={46} style={{ borderRadius: 12 }} />)}</div>
                ) : daySlots.length ? groups.filter(([, , xs]) => xs.length).map(([label, icon, xs]) => (
                  <div className="slot-group" key={label}>
                    <h3>{icon}{label}</h3>
                    <div className="slot-grid" role="group" aria-label={`الأوقات المتاحة ${label}`}>
                      {xs.map((x) => (
                        <button key={x.slot_start} className="slot-btn num" aria-pressed={slot === x.slot_start} onClick={() => setSlot(x.slot_start)}>
                          {formatTime(x.slot_start, p.facility.timezone)}
                        </button>
                      ))}
                    </div>
                  </div>
                )) : <p className="muted small">لا توجد أوقات متاحة في هذا اليوم. اختر يوماً آخر.</p>}
              </div>
              <div className="row-between">
                <Button variant="ghost" onClick={() => setStep(1)}>رجوع</Button>
                <Button disabled={!slot} onClick={() => { setIdemKey(newIdempotencyKey('book')); setStep(3); }}>التالي: مراجعة</Button>
              </div>
            </section>
          )}

          {step === 3 && service && slot && (
            <section className="card stack" aria-labelledby="s3" key="s3">
              <div className="step-head"><h1 id="s3">راجع تفاصيل الحجز</h1></div>
              <dl className="summary-list">
                <dt>{p.practitioner ? 'الطبيب' : 'المختبر'}</dt><dd>{name}</dd>
                <dt>الفرع</dt><dd>{p.facility.name} — {p.facility.branch_name}</dd>
                <dt>التاريخ</dt><dd>{formatDate(slot, p.facility.timezone)}</dd>
                <dt>الوقت</dt><dd className="num">{formatTime(slot, p.facility.timezone)} ({service.duration_minutes} دقيقة)</dd>
                <dt>الخدمة</dt><dd>{service.name}</dd>
                <dt>الرسوم</dt><dd>{formatMoney(service.price_minor, service.currency)} <span className="muted small">(تُدفع في العيادة)</span></dd>
                <dt>التأكيد</dt>
                <dd>{p.policy.confirmation_mode === 'auto' ? 'يُثبت فوراً عند الإرسال' : `بانتظار تأكيد العيادة خلال ${p.policy.confirmation_timeout_minutes} دقيقة كحد أقصى؛ الوقت محجوز لك خلالها`}</dd>
                <dt>الإلغاء</dt><dd className="small">{p.policy.cancellation_policy_text ?? `قبل ${Math.round(p.policy.cancellation_cutoff_minutes / 60)} ساعة`}</dd>
              </dl>

              {!session ? (
                <Alert tone="info" title="سجّل الدخول لإرسال الطلب" action={<Button size="sm" icon={<LogIn size={16} />} onClick={goSignIn}>تسجيل الدخول</Button>}>
                  سنحتفظ باختيارك ونتحقق من توفر الوقت مجدداً بعد الدخول.
                </Alert>
              ) : !access?.patient_ids?.length ? (
                <Alert tone="warning" title="أكمل ملفك أولاً" action={<Button size="sm" onClick={goSignIn}>إكمال الملف</Button>}>
                  يلزم إنشاء ملف المريض (الاسم فقط مطلوب) قبل الحجز.
                </Alert>
              ) : (
                <>
                  {(patients.data?.length ?? 0) > 1 && (
                    <div className="field">
                      <span className="field-label" id="who">الحجز لـ</span>
                      <div className="radio-cards" role="radiogroup" aria-labelledby="who">
                        {patients.data!.map((pt) => (
                          <label key={pt.id} className="radio-card">
                            <input type="radio" name="patient" checked={patientId === pt.id} onChange={() => setPatientId(pt.id)} />
                            <strong>{pt.full_name}</strong>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="field">
                    <label htmlFor="note">ملاحظة للعيادة <span className="muted small">(اختياري)</span></label>
                    <textarea id="note" className="textarea" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثال: أول زيارة" style={{ minHeight: 72 }} />
                    <span className="hint">لا تكتب معلومات حساسة هنا؛ يناقشها الطبيب معك خلال الزيارة.</span>
                  </div>
                </>
              )}

              {submitError ? <Alert tone="danger" title="لم يتم الحجز">{errorMessage(submitError)}</Alert> : null}
              {!online && <Alert tone="warning">لا يوجد اتصال — لا يمكن إرسال الطلب الآن.</Alert>}

              <div className="row-between">
                <Button variant="ghost" onClick={() => setStep(2)} disabled={submitting}>تغيير الموعد</Button>
                <Button size="lg" onClick={submit} loading={submitting} disabled={!session || !patientId || !online}
                        icon={<CalendarCheck2 size={18} />}>{submitting ? 'جارٍ الإرسال…' : 'إرسال طلب الحجز'}</Button>
              </div>
            </section>
          )}

          {step === 4 && result && (
            <section className="card stack" aria-labelledby="s4" role="status" key="s4">
              <div className={`status-hero ${result.status === 'awaiting_confirmation' ? 'pending' : ''}`}>
                <SuccessMark />
                <h1 id="s4" style={{ fontSize: 'var(--f-h3)' }}>{result.status === 'confirmed' ? 'تم تأكيد موعدك' : 'تم إرسال طلبك — بانتظار التأكيد'}</h1>
                <AppointmentStatusBadge status={result.status} />
              </div>
              <dl className="summary-list">
                <dt>رقم الحجز</dt><dd><span className="code-pill" style={{ fontSize: 'var(--f-body-lg)' }}>{result.booking_number}</span></dd>
                <dt>الموعد</dt><dd>{formatDateTime(slot!, p.facility.timezone)}</dd>
                {result.status === 'awaiting_confirmation' && result.confirmation_deadline && (
                  <><dt>مهلة التأكيد</dt><dd className="small"><Clock size={14} aria-hidden style={{ verticalAlign: '-2px' }} /> حتى {formatTime(result.confirmation_deadline)} — إن لم تؤكده العيادة يُلغى الطلب تلقائياً ويتحرر الوقت.</dd></>
                )}
              </dl>
              <div className="row">
                <Link to="/patient/appointments" className="btn btn-primary">عرض حجوزاتي</Link>
                <Link to="/patient" className="btn btn-secondary" onClick={() => void refreshAccess()}>العودة للرئيسية</Link>
              </div>
            </section>
          )}
        </div>

        <aside className="card stack booking-aside" aria-label="ملخص الحجز">
          <div className="provider-mini">
            <Avatar name={name} />
            <div className="grow" style={{ minWidth: 0 }}>
              <strong className="truncate" style={{ display: 'block' }}>{name}</strong>
              <span className="muted small truncate" style={{ display: 'block' }}>{p.facility.name} — {p.facility.branch_name}</span>
            </div>
          </div>
          <hr className="divider" />
          <dl className="summary-list">
            <dt>الخدمة</dt><dd>{service?.name ?? <span className="muted">—</span>}</dd>
            <dt>الموعد</dt><dd>{slot ? <span className="num">{formatDateShort(slot, p.facility.timezone)} — {formatTime(slot, p.facility.timezone)}</span> : <span className="muted">لم يُختر بعد</span>}</dd>
            <dt>الرسوم</dt><dd>{service ? <span className="row" style={{ gap: 6 }}><Wallet size={14} aria-hidden />{formatMoney(service.price_minor, service.currency)}</span> : <span className="muted">—</span>}</dd>
          </dl>
          <span className="small muted">{p.policy.confirmation_mode === 'auto' ? 'تأكيد فوري عند الإرسال.' : 'يتطلب تأكيد العيادة؛ لن يظهر كمؤكد قبل ذلك.'}</span>
        </aside>
      </div>
    </div>
  );
}

/** Hour of day (0–23) of an instant in the facility timezone. */
function hourIn(iso: string, timeZone: string): number {
  return Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone }).format(new Date(iso)));
}
