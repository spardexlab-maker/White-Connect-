import { Link, useParams } from 'react-router-dom';
import { ArrowRight, CalendarClock, FlaskConical, HeartPulse, Pill, Printer, Stethoscope } from 'lucide-react';
import { patientEncounterStatus, formatDate, formatDateTime, patientLabStatus, type EncounterStatus, type LabStatus } from '@app/shared';
import { supabase } from '../../lib/supabase';
import { unwrap, useAsync } from '../../lib/useAsync';
import { Alert, Badge, ErrorState, SkeletonList } from '../../components/ui';

interface Visit {
  id: string; status: EncounterStatus; started_at: string; ended_at: string | null; finished: boolean;
  patient_name: string; facility: string; doctor: string; specialty: string | null;
  reason: string | null; diagnosis: string | null; plan: string | null; follow_up: string | null;
  vitals: Partial<Record<'bp_sys' | 'bp_dia' | 'pulse' | 'temp_c' | 'spo2' | 'weight_kg', number>>;
  prescriptions: { id: string; rx_number: string; status: string }[];
  lab_orders: { id: string; order_number: string; status: LabStatus; lab: string | null; tests: string[] | null }[];
  next_visit: string | null;
}

/** The patient's copy of one doctor visit: diagnosis, advice, vitals, and what came out of it. */
export function PatientVisit() {
  const { id } = useParams();
  const v = useAsync(async () => (await unwrap(supabase.rpc('patient_visit', { p_encounter_id: id! }))) as unknown as Visit, [id]);
  const d = v.data;
  const vt = d?.vitals ?? {};
  const vitals: [string, string][] = [
    ...(vt.bp_sys && vt.bp_dia ? [['الضغط', `${vt.bp_sys}/${vt.bp_dia}`] as [string, string]] : []),
    ...(vt.pulse ? [['النبض', `${vt.pulse}`] as [string, string]] : []),
    ...(vt.temp_c ? [['الحرارة', `${vt.temp_c}°`] as [string, string]] : []),
    ...(vt.spo2 ? [['الأكسجين', `${vt.spo2}%`] as [string, string]] : []),
    ...(vt.weight_kg ? [['الوزن (كغ)', `${vt.weight_kg}`] as [string, string]] : []),
  ];

  return (
    <div className="stack">
      <div className="row-between no-print">
        <Link to="/patient/journey" className="btn btn-ghost btn-sm"><ArrowRight size={16} aria-hidden />رحلتي</Link>
        {d?.finished && <button className="btn btn-secondary btn-sm" onClick={() => window.print()}><Printer size={16} aria-hidden />حفظ نسخة PDF</button>}
      </div>
      {v.status === 'loading' && !d && <SkeletonList />}
      {v.status === 'error' && <ErrorState error={v.error} onRetry={v.reload} />}
      {d && (
        <div className="stack print-area">
          <section className="card stack-sm">
            <div className="row-between" style={{ alignItems: 'flex-start' }}>
              <div className="row" style={{ gap: 'var(--s-3)' }}>
                <span className="ai-ico" aria-hidden><Stethoscope size={20} /></span>
                <div className="stack-sm" style={{ gap: 2 }}>
                  <h1 className="section-title" style={{ margin: 0 }}>{d.doctor}</h1>
                  <span className="small muted">{[d.specialty, d.facility].filter(Boolean).join(' · ')}</span>
                </div>
              </div>
              <Badge tone={patientEncounterStatus[d.status].tone}>{patientEncounterStatus[d.status].label}</Badge>
            </div>
            <span className="small muted">{formatDateTime(d.started_at)} · {d.patient_name}</span>
          </section>

          {!d.finished && <Alert tone="info">الزيارة ما خلصت بعد. التشخيص والتعليمات تظهر هنا أول ما يكمّل الطبيب الجلسة.</Alert>}

          {d.finished && (
            <section className="card stack" aria-label="التشخيص والتعليمات">
              {d.reason && <div className="stack-sm" style={{ gap: 2 }}><span className="small muted">سبب الزيارة</span><p style={{ margin: 0 }}>{d.reason}</p></div>}
              <div className="visit-dx"><span className="small">التشخيص</span><strong>{d.diagnosis?.trim() || 'لم يُسجَّل تشخيص'}</strong></div>
              {d.plan && <div className="stack-sm" style={{ gap: 2 }}><span className="small muted">تعليمات الطبيب</span><p style={{ margin: 0, whiteSpace: 'pre-line' }}>{d.plan}</p></div>}
              {d.follow_up && <div className="stack-sm" style={{ gap: 2 }}><span className="small muted">المتابعة</span><p style={{ margin: 0 }}>{d.follow_up}</p></div>}
              {d.next_visit && <span className="row small" style={{ gap: 6, fontWeight: 600 }}><CalendarClock size={16} aria-hidden />موعدك الجاي: {formatDateTime(d.next_visit)}</span>}
            </section>
          )}

          {d.finished && vitals.length > 0 && (
            <section className="card stack-sm" aria-labelledby="vit-title">
              <h2 id="vit-title" className="section-title row" style={{ gap: 6 }}><HeartPulse size={18} aria-hidden />القياسات</h2>
              <div className="visit-vitals">
                {vitals.map(([k, val]) => <div key={k}><span className="small muted">{k}</span><strong dir="ltr">{val}</strong></div>)}
              </div>
            </section>
          )}

          {d.prescriptions.length > 0 && (
            <section className="card stack-sm" aria-labelledby="rx-title">
              <h2 id="rx-title" className="section-title row" style={{ gap: 6 }}><Pill size={18} aria-hidden />الوصفات</h2>
              {d.prescriptions.map((r) => (
                <Link key={r.id} to={`/patient/rx/${r.id}`} className="row-between visit-link">
                  <span>وصفة <bdi>{r.rx_number}</bdi></span>
                  <Badge tone={r.status === 'active' ? 'success' : 'neutral'}>{r.status === 'active' ? 'معتمدة' : 'ملغاة'}</Badge>
                </Link>
              ))}
            </section>
          )}

          {d.lab_orders.length > 0 && (
            <section className="card stack-sm" aria-labelledby="lab-title">
              <h2 id="lab-title" className="section-title row" style={{ gap: 6 }}><FlaskConical size={18} aria-hidden />التحاليل ونتائجها</h2>
              {d.lab_orders.map((o) => (
                <Link key={o.id} to={`/patient/labs/${o.id}`} className="row-between visit-link">
                  <span className="stack-sm" style={{ gap: 2 }}>
                    <span>{(o.tests ?? []).join('، ') || `طلب ${o.order_number}`}</span>
                    <span className="small muted">{o.lab ?? 'أي مختبر على أبيض'}</span>
                  </span>
                  <Badge tone={patientLabStatus[o.status].tone}>{patientLabStatus[o.status].label}</Badge>
                </Link>
              ))}
            </section>
          )}

          <p className="small muted">هذه نسخة لك من زيارتك بتاريخ {formatDate(d.started_at)}. لأي سؤال عن التشخيص أو العلاج، راجع طبيبك.</p>
        </div>
      )}
    </div>
  );
}
