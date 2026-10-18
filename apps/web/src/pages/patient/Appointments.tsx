import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, CalendarPlus, MapPin, Users } from 'lucide-react';
import { errorMessage, formatDateTime, formatMoney, type AppointmentStatus } from '@app/shared';
import { supabase } from '../../lib/supabase';
import { unwrap, useAsync } from '../../lib/useAsync';
import { useAuth } from '../../lib/auth';
import { AppointmentStatusBadge, Button, ConfirmDialog, EmptyState, ErrorState, SelectField, SkeletonList, Tabs, useToast } from '../../components/ui';
import { SignInPrompt } from './Account';

interface Row {
  appointment_id: string; booking_number: string; status: AppointmentStatus; starts_at: string; ends_at: string; timezone: string;
  patient_name: string; facility_name: string; branch_name: string; address: string | null; practitioner_name: string | null;
  service_name: string; price_minor: number | null; currency: string; confirmation_deadline: string | null;
  cancellation_cutoff_minutes: number; status_reason: string | null;
}

const ACTIVE: AppointmentStatus[] = ['awaiting_confirmation', 'confirmed', 'checked_in'];
const reasons = ['تعارض مع موعد آخر', 'تحسّن الحالة', 'سأحجز وقتاً آخر', 'سبب آخر'];

export function MyAppointments() {
  const { session } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [cancelling, setCancelling] = useState<Row | null>(null);
  const [reason, setReason] = useState(reasons[0]);
  const [busy, setBusy] = useState(false);
  const list = useAsync(async () => (session ? ((await unwrap(supabase.rpc('my_appointments'))) as Row[]) : []), [session?.user.id]);

  const [upcoming, past] = useMemo(() => {
    const now = Date.now();
    const rows = list.data ?? [];
    return [
      rows.filter((r) => ACTIVE.includes(r.status) && new Date(r.ends_at).getTime() > now).reverse(),
      rows.filter((r) => !(ACTIVE.includes(r.status) && new Date(r.ends_at).getTime() > now)),
    ];
  }, [list.data]);

  if (!session) return <SignInPrompt title="حجوزاتي" />;
  const rows = tab === 'upcoming' ? upcoming : past;

  const doCancel = async () => {
    if (!cancelling) return;
    setBusy(true);
    const { error } = await supabase.rpc('change_appointment_status', { p_appointment_id: cancelling.appointment_id, p_to: 'cancelled', p_reason: reason });
    setBusy(false);
    if (error) { toast(errorMessage(error), 'danger'); return; }
    toast('تم إلغاء الموعد وتحرير الوقت', 'success');
    setCancelling(null); list.reload();
  };

  return (
    <div className="stack">
      <div className="row-between">
        <h1 style={{ fontSize: 'var(--f-h2)' }}>حجوزاتي</h1>
        <Link to="/patient" className="btn btn-secondary btn-sm"><CalendarPlus size={16} aria-hidden />حجز جديد</Link>
      </div>
      <div className="card card-flush">
        <Tabs label="المواعيد" value={tab} onChange={setTab} tabs={[{ id: 'upcoming', label: `القادمة (${upcoming.length})` }, { id: 'past', label: 'السابقة' }]} />
        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
          {list.status === 'loading' && !list.data && <SkeletonList rows={3} />}
          {list.status === 'error' && <ErrorState error={list.error} onRetry={list.reload} />}
          {list.data && rows.length === 0 && (
            <EmptyState icon={<CalendarDays />} title={tab === 'upcoming' ? 'لا توجد مواعيد قادمة' : 'لا توجد مواعيد سابقة'}
                        action={tab === 'upcoming' ? <Link to="/patient" className="btn btn-primary">ابحث عن طبيب</Link> : undefined}>
              {tab === 'upcoming' ? 'احجز موعداً وسيظهر هنا مع حالته.' : undefined}
            </EmptyState>
          )}
          <ul className="list" style={{ margin: 0, padding: 0 }}>
            {rows.map((r) => {
              const canCancel = ['awaiting_confirmation', 'confirmed'].includes(r.status) && new Date(r.starts_at).getTime() > Date.now();
              const late = new Date(r.starts_at).getTime() - r.cancellation_cutoff_minutes * 60000 < Date.now();
              return (
                <li key={r.appointment_id} className="list-item" style={{ alignItems: 'flex-start' }}>
                  <div className="grow stack-sm" style={{ gap: 4 }}>
                    <div className="row-between">
                      <strong>{r.practitioner_name ?? r.facility_name}</strong>
                      <AppointmentStatusBadge status={r.status} />
                    </div>
                    <span className="small">{formatDateTime(r.starts_at, r.timezone)} · {r.service_name}</span>
                    <span className="small muted"><MapPin size={14} aria-hidden style={{ verticalAlign: '-2px' }} /> {r.facility_name} — {r.branch_name}</span>
                    <span className="small muted"><Users size={14} aria-hidden style={{ verticalAlign: '-2px' }} /> {r.patient_name} · رقم الحجز <bdi dir="ltr">{r.booking_number}</bdi> · {formatMoney(r.price_minor, r.currency)}</span>
                    {r.status === 'awaiting_confirmation' && r.confirmation_deadline && (
                      <span className="small" style={{ color: 'var(--c-warning)' }}>الوقت محجوز لك حتى تأكيد العيادة (المهلة حتى {formatDateTime(r.confirmation_deadline, r.timezone)})</span>
                    )}
                    {r.status_reason && ['cancelled', 'rejected'].includes(r.status) && <span className="small muted">السبب: {r.status_reason}</span>}
                    {canCancel && (
                      <div className="row">
                        <Button variant="danger" size="sm" onClick={() => setCancelling(r)}>إلغاء الموعد</Button>
                        {late && <span className="small muted">تجاوزت مهلة الإلغاء المجاني المحددة من العيادة.</span>}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      <ConfirmDialog open={!!cancelling} title="إلغاء الموعد؟" confirmLabel="تأكيد الإلغاء" tone="danger" loading={busy}
                     onCancel={() => setCancelling(null)} onConfirm={doCancel}>
        <p>سيتم إلغاء موعد {cancelling?.practitioner_name ?? cancelling?.facility_name} وتحرير الوقت لمرضى آخرين. يبقى الموعد في سجلك كملغى.</p>
        <SelectField label="سبب الإلغاء" value={reason} onChange={(e) => setReason(e.target.value)}>
          {reasons.map((r) => <option key={r}>{r}</option>)}
        </SelectField>
      </ConfirmDialog>
    </div>
  );
}
