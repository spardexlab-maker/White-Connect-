import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, CalendarCheck, CalendarDays, CreditCard, Stethoscope, TrendingDown, TrendingUp, UserPlus } from 'lucide-react';
import { errorMessage } from '@app/shared';
import { supabase } from '../../lib/supabase';
import { unwrap, useAsync } from '../../lib/useAsync';
import { Alert, Button, ErrorState, SkeletonList, TextField, useToast } from '../../components/ui';

interface G {
  today: string;
  bookings: { today: number; month: number; prev_month: number; fulfilled_month: number; cancelled_month: number; by_source_month: Partial<Record<'app' | 'web' | 'reception', number>> };
  patients: { today: number; month: number; prev_month: number; total: number; with_app: number };
  daily: { day: string; bookings: number; patients: number }[];
  top_doctors: { name: string; specialty: string | null; facilities: string | null; bookings: number; fulfilled: number }[];
  ai: { today: number; month: number; prev_month: number; users_month: number; cost_per_message_usd: number; cost_month_usd: number };
  subscriptions: { expiring: number; expired: number; unpaid: number; without: number; paid_month_iqd: number };
}

const n = (v: number) => v.toLocaleString('en-US');
const usd = (v: number) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dayLabel = (d: string) => new Intl.DateTimeFormat('ar-IQ', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${d}T00:00:00Z`));
const SOURCE: Record<string, string> = { app: 'التطبيق', web: 'الموقع', reception: 'الاستقبال' };

/** How the platform is growing: counts only, no names of patients and nothing medical. */
export function GrowthDashboard() {
  const g = useAsync(async () => (await unwrap(supabase.rpc('admin_growth'))) as unknown as G, []);
  if (g.status === 'loading' && !g.data) return <SkeletonList rows={3} />;
  if (g.status === 'error') return <ErrorState error={g.error} onRetry={g.reload} />;
  const d = g.data!;
  const subsAttention = d.subscriptions.expiring + d.subscriptions.expired + d.subscriptions.unpaid;
  return (
    <div className="stack growth">
      {subsAttention > 0 && (
        <Alert tone="warning" title="اشتراكات تحتاج متابعة" action={<Link to="/platform-admin/subscriptions" className="btn btn-secondary btn-sm">فتح الاشتراكات</Link>}>
          {[d.subscriptions.expiring && `${n(d.subscriptions.expiring)} تخلص قريباً`, d.subscriptions.unpaid && `${n(d.subscriptions.unpaid)} غير مدفوعة`, d.subscriptions.expired && `${n(d.subscriptions.expired)} منتهية`].filter(Boolean).join(' · ')}
        </Alert>
      )}
      <div className="kpi-strip">
        <Kpi icon={<CalendarCheck size={22} aria-hidden />} value={d.bookings.today} label="حجوزات اليوم" />
        <Kpi icon={<CalendarDays size={22} aria-hidden />} value={d.bookings.month} label="حجوزات هذا الشهر" prev={d.bookings.prev_month} />
        <Kpi icon={<UserPlus size={22} aria-hidden />} value={d.patients.month} label="مرضى جدد هذا الشهر" prev={d.patients.prev_month} sub={`اليوم: ${n(d.patients.today)}`} />
        <Kpi icon={<Bot size={22} aria-hidden />} value={d.ai.month} label="رسائل المساعد الذكي هذا الشهر" prev={d.ai.prev_month} sub={`الكلفة التقريبية: ${usd(d.ai.cost_month_usd)}`} />
      </div>

      <div className="two-col">
        <section className="card stack-sm">
          <h2 className="section-title">الحجوزات — آخر ٣٠ يوم</h2>
          <Bars data={d.daily.map((x) => ({ day: x.day, v: x.bookings }))} unit="حجز" />
          <p className="small muted">
            هذا الشهر: تمّت {n(d.bookings.fulfilled_month)} · ملغية أو ما حضر {n(d.bookings.cancelled_month)}
            {Object.keys(d.bookings.by_source_month).length > 0 && <> · المصدر: {Object.entries(d.bookings.by_source_month).map(([k, v]) => `${SOURCE[k] ?? k} ${n(v ?? 0)}`).join('، ')}</>}
          </p>
        </section>
        <section className="card stack-sm">
          <h2 className="section-title">المرضى الجدد — آخر ٣٠ يوم</h2>
          <Bars data={d.daily.map((x) => ({ day: x.day, v: x.patients }))} unit="مريض" />
          <p className="small muted">كل المرضى: {n(d.patients.total)} · عندهم حساب بالتطبيق: {n(d.patients.with_app)}</p>
        </section>
      </div>

      <section className="card card-flush">
        <div className="card-header"><h2 className="row" style={{ gap: 8 }}><Stethoscope size={20} aria-hidden />أكثر الأطباء حجزاً هذا الشهر</h2></div>
        {d.top_doctors.length === 0 ? <p className="small muted" style={{ padding: 'var(--s-4)' }}>ماكو حجوزات هذا الشهر بعد.</p> : (
          <div className="table-wrap" role="region" aria-label="أكثر الأطباء حجزاً" tabIndex={0}>
            <table className="table">
              <thead><tr><th>#</th><th>الطبيب</th><th>الحجوزات</th><th>تمّت</th></tr></thead>
              <tbody>
                {d.top_doctors.map((t, i) => (
                  <tr key={t.name + i}>
                    <td className="num">{n(i + 1)}</td>
                    <td><strong>{t.name}</strong><div className="small muted">{[t.specialty, t.facilities].filter(Boolean).join(' · ')}</div></td>
                    <td style={{ minWidth: 160 }}>
                      <div className="inline-bar"><span style={{ inlineSize: `${(t.bookings / d.top_doctors[0].bookings) * 100}%` }} /><b className="num">{n(t.bookings)}</b></div>
                    </td>
                    <td className="num">{n(t.fulfilled)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <AiCost ai={d.ai} onSaved={g.reload} />
      {d.subscriptions.without > 0 && (
        <p className="small muted row" style={{ gap: 6 }}><CreditCard size={14} aria-hidden />{n(d.subscriptions.without)} جهات بلا اشتراك مسجّل — <Link to="/platform-admin/subscriptions">سجّلها</Link></p>
      )}
    </div>
  );
}

function Kpi({ icon, value, label, prev, sub }: { icon: JSX.Element; value: number; label: string; prev?: number; sub?: string }) {
  const diff = prev == null ? null : value - prev;
  return (
    <div className="kpi">
      {icon}
      <div>
        <div className="kpi-v num">{n(value)}</div>
        <div className="kpi-l">{label}</div>
        {diff != null && (
          <div className={`kpi-trend ${diff > 0 ? 'up' : diff < 0 ? 'down' : ''}`}>
            {diff > 0 ? <TrendingUp size={14} aria-hidden /> : diff < 0 ? <TrendingDown size={14} aria-hidden /> : null}
            الشهر الماضي: {n(prev!)}
          </div>
        )}
        {sub && <div className="kpi-trend">{sub}</div>}
      </div>
    </div>
  );
}

/** One series of daily counts: thin bars from the baseline, value on hover/focus, table for screen readers. */
function Bars({ data, unit }: { data: { day: string; v: number }[]; unit: string }) {
  const max = Math.max(1, ...data.map((x) => x.v));
  const total = data.reduce((s, x) => s + x.v, 0);
  return (
    <>
      <div className="bars" role="img" aria-label={`المجموع ${n(total)} ${unit} خلال ٣٠ يوم، أعلى يوم ${n(max)}`}>
        <span className="bars-max num" aria-hidden>{n(max)}</span>
        {data.map((x) => (
          <span key={x.day} className="bar" tabIndex={-1} data-tip={`${dayLabel(x.day)}: ${n(x.v)} ${unit}`}>
            <i style={{ blockSize: `${(x.v / max) * 100}%` }} className={x.v === 0 ? 'zero' : ''} />
          </span>
        ))}
      </div>
      <div className="bars-axis small muted" aria-hidden><span>{dayLabel(data[0].day)}</span><span>اليوم</span></div>
      <details className="small">
        <summary>عرض كجدول</summary>
        <table className="table"><thead><tr><th>اليوم</th><th>العدد</th></tr></thead>
          <tbody>{[...data].reverse().map((x) => <tr key={x.day}><td>{dayLabel(x.day)}</td><td className="num">{n(x.v)}</td></tr>)}</tbody></table>
      </details>
    </>
  );
}

function AiCost({ ai, onSaved }: { ai: G['ai']; onSaved: () => void }) {
  const toast = useToast();
  const [rate, setRate] = useState(String(ai.cost_per_message_usd));
  const [busy, setBusy] = useState(false);
  const r = Number(rate);
  const bad = !rate.trim() || Number.isNaN(r) || r < 0 || r > 1;
  const save = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('admin_set_ai_cost', { p_usd: r });
    setBusy(false);
    toast(error ? errorMessage(error) : 'انحفظ سعر الرسالة', error ? 'danger' : 'success');
    if (!error) onSaved();
  };
  return (
    <section className="card stack-sm">
      <h2 className="section-title row" style={{ gap: 8 }}><Bot size={18} aria-hidden />المساعد الذكي</h2>
      <p className="small">
        اليوم: <b className="num">{n(ai.today)}</b> رسالة · هذا الشهر: <b className="num">{n(ai.month)}</b> رسالة من <b className="num">{n(ai.users_month)}</b> مستخدم ·
        الكلفة التقريبية هذا الشهر: <b className="num">{usd(ai.cost_month_usd)}</b>
      </p>
      <p className="small muted">الكلفة تقديرية: عدد الرسائل × سعر الرسالة الواحدة. الرقم الحقيقي بحساب Google AI Studio (Billing). إذا تغيّر السعر عدّله هنا.</p>
      <div className="row" style={{ gap: 'var(--s-3)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ maxWidth: 240 }}>
          <TextField label="سعر الرسالة الواحدة (دولار)" ltr inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} error={bad ? 'رقم بين 0 و 1' : undefined} />
        </div>
        <Button variant="secondary" loading={busy} disabled={bad || r === ai.cost_per_message_usd} onClick={() => void save()}>حفظ</Button>
      </div>
    </section>
  );
}
