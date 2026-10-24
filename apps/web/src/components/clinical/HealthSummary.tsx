import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, Droplet, FileText, FlaskConical, HeartPulse, History, Minus, Pill, Ruler, ShieldAlert, Weight } from 'lucide-react';
import { chartDomain, formatDate, formatDateShort, formatDateTime, formatTime, labFlag, labState, labStateColor, labStateLabel, parseRange, rangePosition, rangePositionLabel, type NumRange } from '@app/shared';
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

      <Adherence patientId={h.patient.id} />

      <section className="stack-sm">
        <h3 className="section-title">التحاليل: السابق والحالي</h3>
        <LabTrends trends={h.lab_trends} />
      </section>
    </div>
  );
}

/** Where a value sits against the lab's reference range: low zone · reference band · high zone. */
export function RangeBar({ value, range }: { value: number; range: NumRange }) {
  const [lo, hi] = chartDomain([value], range);
  const pct = (v: number) => `${Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100))}%`;
  const pos = rangePosition(value, range);
  const bandStart = range.low != null ? pct(range.low) : '0%';
  const bandEnd = range.high != null ? pct(range.high) : '100%';
  return (
    <div className="range-bar" role="img" aria-label={`${value}: ${rangePositionLabel[pos]}`}>
      <div className="range-track" dir="ltr">
        <span className="range-band" style={{ left: bandStart, right: `calc(100% - ${bandEnd})` }} />
        <span className={`range-marker pos-${pos}`} style={{ left: pct(value) }} />
      </div>
      <div className="range-scale" dir="ltr">
        <span>{range.low ?? ''}</span><span className={`range-pos pos-${pos}`}>{rangePositionLabel[pos]}</span><span>{range.high ?? ''}</span>
      </div>
    </div>
  );
}

/** Values over time with the reference band shaded (oldest → newest, left to right). */
export function TrendChart({ points, range, unit }: { points: TrendPoint[]; range: NumRange | null; unit: string | null }) {
  const pts = points.filter((p) => p.value_numeric != null).slice().reverse();
  if (pts.length < 2) return null;
  const W = 320, H = 120, P = { l: 34, r: 12, t: 10, b: 22 };
  const vals = pts.map((p) => Number(p.value_numeric));
  const [lo, hi] = chartDomain(vals, range);
  const x = (i: number) => P.l + (i * (W - P.l - P.r)) / (pts.length - 1);
  const y = (v: number) => P.t + (1 - (v - lo) / (hi - lo)) * (H - P.t - P.b);
  const bandTop = y(range?.high ?? hi), bandBottom = y(range?.low ?? lo);
  return (
    <svg className="trend-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`تطور النتيجة: ${vals.join('، ')} ${unit ?? ''}`} style={{ direction: 'ltr' }}>
      {range && <rect x={P.l} y={bandTop} width={W - P.l - P.r} height={Math.max(0, bandBottom - bandTop)} className="trend-band" />}
      {[lo, hi].map((v, i) => <text key={i} x={P.l - 6} y={y(v) + 4} className="trend-axis" textAnchor="end">{Math.round(v * 10) / 10}</text>)}
      <polyline points={pts.map((p, i) => `${x(i)},${y(Number(p.value_numeric))}`).join(' ')} className="trend-line" />
      {pts.map((p, i) => {
        const pos = range ? rangePosition(Number(p.value_numeric), range) : 'within';
        return (
          <g key={i}>
            <circle cx={x(i)} cy={y(Number(p.value_numeric))} r={4.5} className={`trend-dot pos-${pos}`} />
            <text x={x(i)} y={y(Number(p.value_numeric)) - 8} className="trend-val" textAnchor="middle">{Number(p.value_numeric)}</text>
            <text x={x(i)} y={H - 6} className="trend-axis" textAnchor="middle">{formatDateShort(p.released_at)}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Every test once as a card: current value against its reference range, the trend, the previous value and the report. */
export function LabTrends({ trends, linkBase }: { trends: Trend[]; linkBase?: string }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!trends.length) return <EmptyState icon={<FlaskConical />} title="لا توجد نتائج تحاليل منشورة بعد" />;
  return (
    <div className="stack-sm">
      <div className="lab-cards">
        {trends.map((t) => {
          const [cur, prev] = t.points;
          const range = parseRange(t.reference_range);
          const dir = cur?.value_numeric != null && prev?.value_numeric != null ? Math.sign(Number(cur.value_numeric) - Number(prev.value_numeric)) : null;
          const st = labState({ value_numeric: cur.value_numeric, reference_range: t.reference_range, flag: cur.flag });
          return (
            <article key={t.key} className="lab-card">
              <header className="row-between">
                <strong>{t.name}</strong>
                {cur.flag === 'critical' ? <Badge tone="danger">{labFlag[cur.flag]}</Badge> : st && <span className={`lab-pill lab-${st}`}>{labStateLabel[st]}</span>}
              </header>
              <div className="row-between" style={{ alignItems: 'baseline' }}>
                <span className="lab-value" style={{ color: st ? labStateColor[st] : undefined }}><Ltr>{fmtVal(cur)}</Ltr> <span className="small muted"><Ltr>{t.unit ?? ''}</Ltr></span></span>
                {prev && (
                  <span className="small muted row" style={{ gap: 4 }}>
                    {dir === 1 ? <ArrowUp size={14} aria-label="ارتفع" /> : dir === -1 ? <ArrowDown size={14} aria-label="انخفض" /> : <Minus size={14} aria-label="ثابت" />}
                    السابق <Ltr>{fmtVal(prev)}</Ltr> ({formatDateShort(prev.released_at)})
                  </span>
                )}
              </div>
              {range && cur.value_numeric != null ? <RangeBar value={Number(cur.value_numeric)} range={range} />
                : <span className="small muted">المرجع: <Ltr>{t.reference_range ?? '—'}</Ltr></span>}
              <TrendChart points={t.points} range={range} unit={t.unit} />
              <span className="small muted">{formatDate(cur.released_at)} · {cur.lab}</span>
              <div className="row" style={{ gap: 'var(--s-2)' }}>
                <Link className="btn btn-secondary btn-sm" to={`/print/lab/${cur.order_id}`}><FileText size={14} aria-hidden />تقرير PDF</Link>
                {t.points.length > 1 && <button className="btn btn-ghost btn-sm" aria-expanded={open === t.key} onClick={() => setOpen(open === t.key ? null : t.key)}><History size={14} aria-hidden />كل النتائج ({t.points.length})</button>}
              </div>
              {open === t.key && (
                <div className="stack-sm">
                  {t.points.map((p, i) => (
                    <div key={i} className="row-between small">
                      <span><span className="num" style={{ fontWeight: 600 }}><Ltr>{fmtVal(p)} {t.unit ?? ''}</Ltr></span>{p.flag ? ` · ${labFlag[p.flag] ?? p.flag}` : ''}</span>
                      <span className="muted">{formatDate(p.released_at)} · <Link to={`/print/lab/${p.order_id}`}>PDF</Link>{linkBase && <> · <Link to={`${linkBase}${p.order_id}`}>التفاصيل</Link></>}</span>
                    </div>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
      <p className="small muted">الشريط يبيّن موقع النتيجة من المجال المرجعي الذي أصدره المختبر، والرسم يبيّن تطورها. هذه مقارنة رقمية وليست تفسيراً طبياً.</p>
    </div>
  );
}

interface PlanAdherence { id: string; display_name: string; status: string; source: string; interval_hours: number | null; times: string[] | null;
  dose: number | null; dose_unit: string | null; prescribed: boolean; prescribed_by: string | null; taken_amount: number;
  due: number; taken: number; skipped: number; missed: number; last_taken_at: string | null;
  recent: { at: string; recorded_at: string | null; amount: number | null; state: 'taken' | 'skipped' | 'missed' | 'pending' }[] }
const amountLabel = (n: number | null | undefined, unit: string | null) => (n ? `${Number(n)} ${unit ?? ''}`.trim() : '');
const stateLabel = { taken: 'أخذها', skipped: 'تخطاها', missed: 'لم يسجّل', pending: 'قادمة' } as const;

/** Taken / skipped / missed doses over the last 14 days, as the patient recorded them on the phone. */
export function Adherence({ patientId }: { patientId: string }) {
  const a = useAsync(async () => (await unwrap(supabase.rpc('medication_adherence', { p_patient_id: patientId }))) as unknown as PlanAdherence[], [patientId]);
  if (!a.data?.length) return null;
  return (
    <section className="stack-sm">
      <h3 className="section-title">الالتزام بالأدوية (آخر 14 يوماً)</h3>
      {a.data.map((p) => {
        const pct = p.due ? Math.round((p.taken / p.due) * 100) : null;
        return (
          <div key={p.id} className="card stack-sm" style={{ padding: 'var(--s-3)' }}>
            <div className="row-between small">
              <span><bdi dir="auto" style={{ fontWeight: 700 }}>{p.display_name}</bdi>{p.dose ? ` · ${amountLabel(p.dose, p.dose_unit)}` : ''}{p.interval_hours ? ` · كل ${p.interval_hours} ساعات` : ''}{p.times?.length ? ` · ${p.times.join('، ')}` : ''}</span>
              <span className="row" style={{ gap: 6 }}>
                <Badge tone={p.prescribed ? 'info' : 'neutral'}>{p.prescribed ? `وصفة${p.prescribed_by ? ` ${p.prescribed_by}` : ''}` : 'أضافه المريض'}</Badge>
                {p.status !== 'active' ? <Badge tone="neutral">{p.status === 'paused' ? 'موقوف مؤقتاً' : 'منتهٍ'}</Badge> : null}
              </span>
            </div>
            <div className="row small" style={{ gap: 'var(--s-3)', flexWrap: 'wrap' }}>
              <span>أخذ: <strong>{p.taken}</strong> من {p.due}{pct != null ? ` (${pct}٪)` : ''}{p.taken_amount ? ` — ${amountLabel(p.taken_amount, p.dose_unit)}` : ''}</span>
              <span>تخطى: <strong>{p.skipped}</strong></span>
              <span style={{ color: p.missed ? 'var(--c-warning)' : undefined }}>لم يسجّل: <strong>{p.missed}</strong></span>
              {p.last_taken_at && <span className="muted">آخر جرعة: {formatDateTime(p.last_taken_at)}</span>}
            </div>
            {p.recent.length > 0 && (
              <div className="dose-strip" aria-label="آخر 7 أيام">
                {p.recent.map((d, i) => <span key={i} className={`dose-dot dose-${d.state}`} title={`${formatDateTime(d.at)} — ${stateLabel[d.state]}`} />)}
              </div>
            )}
            {p.recent.length > 0 && (
              <details className="small">
                <summary>سجل الجرعات بالأوقات</summary>
                <ul className="dose-log">
                  {[...p.recent].reverse().map((d, i) => (
                    <li key={i} className={`dose-log-${d.state}`}>
                      <span className="num">{formatDateTime(d.at)}</span>
                      <span>{stateLabel[d.state]}{d.state === 'taken' && d.recorded_at ? ` الساعة ${formatTime(d.recorded_at)}` : ''}{d.amount ? ` · ${amountLabel(d.amount, p.dose_unit)}` : ''}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        );
      })}
      <p className="small muted">كما سجّلها المريض على هاتفه («أخذت» / «تخطي»)؛ ليست تأكيداً طبياً على تناول الدواء.</p>
    </section>
  );
}
