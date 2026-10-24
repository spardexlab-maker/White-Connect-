import { useState } from 'react';
import { CalendarPlus } from 'lucide-react';
import { addDays, errorMessage, formatDate, formatTime, localDateKey } from '@app/shared';
import { supabase } from '../../lib/supabase';
import { unwrap, useAsync } from '../../lib/useAsync';
import { Button, useToast } from '../ui';

/** «موعد المراجعة»: the doctor books the patient's next visit in their own free slots; the patient sees it and is reminded. */
export function FollowUpBooking({ encounterId, facilityId, practitionerId, tz }: { encounterId: string; facilityId: string; practitionerId: string; tz: string }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(() => addDays(localDateKey(new Date(), tz), 7));
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [booked, setBooked] = useState<string | null>(null);

  const service = useAsync(async () => {
    if (!open) return null;
    const rows = (await unwrap(supabase.from('clinic_services').select('id, practitioner_id, duration_minutes').eq('facility_id', facilityId).eq('is_active', true))) ?? [];
    return rows.find((r) => r.practitioner_id === practitionerId) ?? rows.find((r) => r.practitioner_id === null) ?? null;
  }, [open, facilityId, practitionerId]);
  const slots = useAsync(async () => (service.data
    ? ((await unwrap(supabase.rpc('get_available_slots', { p_facility_id: facilityId, p_practitioner_id: practitionerId, p_service_id: service.data.id, p_from: day, p_to: day }))) ?? [])
    : []) as { slot_start: string }[], [service.data?.id, day]);

  const book = async () => {
    if (!picked) return;
    setBusy(true);
    const { error } = await supabase.rpc('book_follow_up', { p_encounter_id: encounterId, p_start: picked, p_service_id: service.data?.id });
    setBusy(false);
    if (error) { toast(errorMessage(error), 'danger'); return; }
    setBooked(picked); setPicked(null); setOpen(false);
    toast('حُجز موعد المراجعة — يظهر للمريض ويصله تذكير', 'success');
  };

  if (!open) {
    return (
      <div className="stack-sm">
        {booked && <span className="small" style={{ color: 'var(--c-success)' }}>✓ موعد المراجعة: {formatDate(booked, tz)} {formatTime(booked, tz)}</span>}
        <Button variant="secondary" icon={<CalendarPlus size={18} />} onClick={() => setOpen(true)}>{booked ? 'حجز موعد آخر' : 'حجز موعد مراجعة'}</Button>
      </div>
    );
  }
  return (
    <div className="stack-sm followup">
      <label className="small" htmlFor="fu-day"><strong>موعد المراجعة</strong></label>
      <input id="fu-day" type="date" className="input" dir="ltr" value={day} min={addDays(localDateKey(new Date(), tz), 1)}
             onChange={(e) => { setDay(e.target.value); setPicked(null); }} />
      <div className="row" style={{ gap: 6 }}>
        {[7, 14, 30].map((d) => (
          <button key={d} type="button" className="chip" onClick={() => { setDay(addDays(localDateKey(new Date(), tz), d)); setPicked(null); }}>
            بعد {d === 7 ? 'أسبوع' : d === 14 ? 'أسبوعين' : 'شهر'}
          </button>
        ))}
      </div>
      {!service.data && service.status !== 'loading' && <span className="small muted">لا توجد خدمة حجز مفعّلة — أضفها من «الجدول والخدمات».</span>}
      {slots.data && slots.data.length === 0 && service.data && <span className="small muted">لا أوقات فارغة بهذا اليوم؛ اختر يوماً آخر.</span>}
      <div className="row" style={{ gap: 6 }}>
        {slots.data?.slice(0, 18).map((s) => (
          <button key={s.slot_start} type="button" className="chip" aria-pressed={picked === s.slot_start} onClick={() => setPicked(s.slot_start)}>
            {formatTime(s.slot_start, tz)}
          </button>
        ))}
      </div>
      <div className="row" style={{ gap: 6 }}>
        <Button size="sm" icon={<CalendarPlus size={16} />} disabled={!picked} loading={busy} onClick={() => void book()}>حجز</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>إلغاء</Button>
      </div>
    </div>
  );
}
