import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, Droplet, FlaskConical, HeartPulse, Minus, Pill, Ruler, ShieldAlert, Weight } from 'lucide-react';
import { formatDate, labFlag } from '@app/shared';
import { supabase } from '../../lib/supabase';
import { unwrap, useAsync } from '../../lib/useAsync';
import { Badge, EmptyState, Ltr } from '../ui';

export interface TrendPoint { value_numeric: number | null; value_text: string | null; flag: string | null; released_at: string; lab: string; order_id: string }
export interface Trend { key: string; name: string; unit: string | null; reference_range: string | null; latest_at: string; points: TrendPoint[] }
export interface Health {
  patient: { id: string; full_name: string; public_code: string; sex: string | null; birth_date: string | null; birth_year: number | null };
  profile: { height_cm: number | null; weight_kg: number | null; blood_type: string | null; notes: string | null; updated_at: string | null };
  last_vitals: { vitals: Record<string, string | number>; at: string } | null;
  conditions: { id: string; name: string; since_year: number | null; status: 'active' | 'resolved'; source: 'patient_reported' | 'clinician' }[];
  medications: { id: string; name: string; dose_text: string | null; started_on: string | null }[];
  prescribed: { name: string; dose: number | null; dose_unit: string | null; frequency: string | null; until: string | null; doctor: string }[];
  allergies_recorded: boolean;
  allergies: { id: string; substance: string; reaction: string | null; severity: string | null; source: string }[];
  lab_trends: Trend[];
}

export function useHealth(patientId: string) {
  return useAsync(async () => (await unwrap(supabase.rpc('health_profile', { p_patient_id: patientId }))) as unknown as Health, [patientId]);
}

export function ageOf(h: Health): number | null {
  if (h.patient.birth_date) {
    const b = new Date(h.patient.birth_date), n = new Date();
    return n.getFullYear() - b.getFullYear() - (n < new Date(n.getFullYear(), b.getMonth(), b.getDate()) ? 1 : 0);
  }
  return h.patient.birth_year ? new Date().getFullYear() - h.patient.birth_year : null;
}
const fmtVal = (p: TrendPoint) => (p.value_numeric != null ? String(Number(p.value_numeric)) : p.value_text ?? '—');
const src = (s: string) => (s === 'patient_reported' ? 'ذكرها المريض' : 'سجّلها طبيب');

/** One line of the essentials, under the patient's name in the session. */
export function HealthStrip({ h }: { h: Health }) {
  const age = ageOf(h);
  const active = h.conditions.filter((c) => c.status === 'active');
  const meds = h.medications.length + h.prescribed.length;
  return (
    <div className="health-strip" aria-label="ملف المريض الصحي">
      <span><HeartPulse size={14} aria-hidden /> {age != null ? `${age} سنة` : 'العمر غير مسجل'}</span>
      <span><Ruler size={14} aria-hidden /> {h.profile.height_cm ? `${Number(h.profile.height_cm)} سم` : 'الطول —'}</span>
      <span><Weight size={14} aria-hidden /> {h.profile.weight_kg ? `${Number(h.profile.weight_kg)} كغ` : 'الوزن —'}</span>
      <span><Droplet size={14} aria-hidden /> {h.profile.blood_type ? <Ltr>{h.profile.blood_type}</Ltr> : 'الفصيلة —'}</span>
      {active.length > 0 && <span><strong>أمراض مزمنة:</strong> {active.map((c) => c.name).join('، ')}</span>}
      <span><Pill size={14} aria-hidden /> {meds ? `${meds} دواء مستمر` : 'لا أدوية مستمرة مسجلة'}</span>
    </div>
  );
}

/** The full health profile as recorded by the patient and doctors (read-only). */
export function HealthSummary({ h }: { h: Health }) {
  const age = ageOf(h);
  const w = h.last_vitals?.vitals?.weight_kg;
  return (
    <div className="stack">
      <div className="kpi-strip">
        <div className="kpi"><div><div className="kpi-v">{age ?? '—'}</div><div className="kpi-l">العمر</div>{h.patient.birth_date && <span className="small muted"><Ltr>{h.patient.birth_date}</Ltr></span>}</div></div>
        <div className="kpi"><div><div className="kpi-v">{h.profile.height_cm ? Number(h.profile.height_cm) : '—'}</div><div className="kpi-l">الطول (سم)</div></div></div>
        <div className="kpi"><div><div className="kpi-v">{h.profile.weight_kg ? Number(h.profile.weight_kg) : '—'}</div><div className="kpi-l">الوزن (كغ)</div>
          {w && <span className="small muted">آخر وزن في العيادة: {w} ({formatDate(h.last_vitals!.at)})</span>}</div></div>
        <div className="kpi"><div><div className="kpi-v"><Ltr>{h.profile.blood_type ?? '—'}</Ltr></div><div className="kpi-l">فصيلة الدم</div></div></div>
      </div>
      {h.profile.updated_at && <p className="small muted">آخر تحديث للبيانات: {formatDate(h.profile.updated_at)}</p>}

      <div className="two-col">
        <section className="stack-sm">
          <h3 className="section-title">الأمراض المزمنة</h3>
          {h.conditions.length === 0 ? <p className="small muted">لم يُسجَّل شيء.</p> : h.conditions.map((c) => (
            <div key={c.id} className="row-between small"><span><strong>{c.name}</strong>{c.since_year ? ` · منذ ${c.since_year}` : ''}</span>
              <span>{c.status === 'resolved' ? <Badge tone="neutral">زال</Badge> : null} <span className="muted">{src(c.source)}</span></span></div>
          ))}
        </section>
        <section className="stack-sm">
          <h3 className="section-title">الحساسية</h3>
          {h.allergies.length === 0
            ? <p className="small muted">{h.allergies_recorded ? 'لا حساسية فعّالة.' : 'لم تُسجَّل — هذا لا يعني عدم وجودها.'}</p>
            : h.allergies.map((a) => <div key={a.id} className="small"><Badge tone="danger" icon={<ShieldAlert aria-hidden />}>{a.substance}</Badge> {a.reaction ?? ''} <span className="muted">· {src(a.source)}</span></div>)}
        </section>
      </div>

      <section className="stack-sm">
        <h3 className="section-title">الأدوية المستمرة</h3>
        {h.medications.length + h.prescribed.length === 0 && <p className="small muted">لا أدوية مستمرة مسجلة.</p>}
        {h.prescribed.map((m, i) => (
          <div key={`p${i}`} className="row-between small"><span><bdi dir="ltr" style={{ fontWeight: 600 }}>{m.name}</bdi>{m.frequency ? ` · ${m.frequency}` : ''}</span>
            <span className="muted">وصفة {m.doctor}{m.until ? ` · حتى ${formatDate(m.until)}` : ''}</span></div>
        ))}
        {h.medications.map((m) => (
          <div key={m.id} className="row-between small"><span><bdi dir="auto" style={{ fontWeight: 600 }}>{m.name}</bdi>{m.dose_text ? ` · ${m.dose_text}` : ''}</span>
            <span className="muted">ذكرها المريض</span></div>
        ))}
      </section>

      {h.profile.notes && <section className="stack-sm"><h3 className="section-title">ملاحظات المريض</h3><p className="small">{h.profile.notes}</p></section>}

      <section className="stack-sm">
        <h3 className="section-title">التحاليل: السابق والحالي</h3>
        <LabTrends trends={h.lab_trends} />
      </section>
    </div>
  );
}

/** Every test once: latest value, the previous one, and the full history on demand. */
export function LabTrends({ trends, linkBase }: { trends: Trend[]; linkBase?: string }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!trends.length) return <EmptyState icon={<FlaskConical />} title="لا توجد نتائج تحاليل منشورة بعد" />;
  return (
    <div className="table-wrap" role="region" aria-label="التحاليل" tabIndex={0}>
      <table className="table">
        <thead><tr><th>التحليل</th><th>الحالي</th><th>السابق</th><th>التغيّر</th><th>المرجع</th><th><span className="sr-only">السجل</span></th></tr></thead>
        <tbody>
          {trends.map((t) => {
            const [cur, prev] = t.points;
            const dir = cur?.value_numeric != null && prev?.value_numeric != null ? Math.sign(Number(cur.value_numeric) - Number(prev.value_numeric)) : null;
            return (
              <Fragment key={t.key}>
                <tr>
                  <td><strong>{t.name}</strong></td>
                  <td><span className="num" style={{ fontWeight: 700 }}><Ltr>{fmtVal(cur)} {t.unit ?? ''}</Ltr></span>
                    {cur.flag && <> <Badge tone={cur.flag === 'critical' ? 'danger' : 'warning'}>{labFlag[cur.flag] ?? cur.flag}</Badge></>}
                    <div className="small muted">{formatDate(cur.released_at)}</div></td>
                  <td>{prev ? <><span className="num"><Ltr>{fmtVal(prev)}</Ltr></span><div className="small muted">{formatDate(prev.released_at)}</div></> : <span className="small muted">—</span>}</td>
                  <td aria-label={dir === 1 ? 'ارتفع' : dir === -1 ? 'انخفض' : 'بدون تغيّر'}>
                    {dir === 1 ? <span className="row small" style={{ gap: 4 }}><ArrowUp size={16} aria-hidden />ارتفع</span>
                      : dir === -1 ? <span className="row small" style={{ gap: 4 }}><ArrowDown size={16} aria-hidden />انخفض</span>
                      : dir === 0 ? <span className="row small" style={{ gap: 4 }}><Minus size={16} aria-hidden />ثابت</span> : <span className="small muted">—</span>}</td>
                  <td className="small"><Ltr>{t.reference_range ?? '—'}</Ltr></td>
                  <td>{t.points.length > 1 && <button className="btn btn-ghost btn-sm" aria-expanded={open === t.key} onClick={() => setOpen(open === t.key ? null : t.key)}>السجل ({t.points.length})</button>}</td>
                </tr>
                {open === t.key && (
                  <tr><td colSpan={6} style={{ background: 'var(--c-surface-sunken)' }}>
                    <div className="stack-sm">
                      {t.points.map((p, i) => (
                        <div key={i} className="row-between small">
                          <span><span className="num" style={{ fontWeight: 600 }}><Ltr>{fmtVal(p)} {t.unit ?? ''}</Ltr></span>{p.flag ? ` · ${labFlag[p.flag] ?? p.flag}` : ''}</span>
                          <span className="muted">{formatDate(p.released_at)} · {p.lab}{linkBase && <> · <Link to={`${linkBase}${p.order_id}`}>التقرير</Link></>}</span>
                        </div>
                      ))}
                    </div>
                  </td></tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      <p className="small muted">«ارتفع/انخفض» مقارنة رقمية بين آخر نتيجتين فقط، وليست تفسيراً طبياً.</p>
    </div>
  );
}
