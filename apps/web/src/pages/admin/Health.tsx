import { Activity, AlertTriangle, CheckCircle2, Globe, RotateCcw, Smartphone, XCircle } from 'lucide-react';
import { errorMessage, formatDateTime } from '@app/shared';
import { supabase } from '../../lib/supabase';
import { unwrap, useAsync } from '../../lib/useAsync';
import { Alert, Badge, Button, ErrorState, PageHead, SkeletonList, useToast } from '../../components/ui';

interface H { jobs: { job: string; schedule: string; last_status: string | null; last_run: string | null; failures_24h: number }[];
  outbox: { pending: number; dead: number; sent_24h: number; oldest_pending: string | null };
  dead_letters: { id: string; template: string; channel: string; attempts: number; last_error: string | null; created_at: string }[];
  attachments: { quarantine: number; rejected_7d: number }; reminders_due_backlog: number }

interface M {
  targets: { key: string; label: string; down: boolean; uptime_24h: number | null; uptime_7d: number | null; last: { ok: boolean; at: string; status: number | null; error: string | null } | null }[];
  incidents: { target: string; started_at: string; ended_at: string | null; error: string | null }[];
  errors: { fingerprint: string; source: 'web' | 'android' | 'ios'; message: string; url: string | null; app_version: string | null; stack: string | null; count: number; users: number; first_at: string; last_at: string }[];
  errors_24h: number;
}
const sourceLabel = { web: 'الموقع', android: 'أندرويد', ios: 'آيفون' } as const;

/** Is the website / API up (checked every 5 minutes), and which errors did the apps hit. */
function Monitor() {
  const m = useAsync(async () => (await unwrap(supabase.rpc('admin_monitor'))) as unknown as M, []);
  if (m.status === 'loading') return <SkeletonList rows={2} />;
  if (m.status === 'error') return <ErrorState error={m.error} onRetry={m.reload} />;
  const d = m.data!;
  const pct = (v: number | null) => (v == null ? '—' : `${v}%`);
  return (
    <>
      {d.targets.some((t) => t.down) && <Alert tone="danger" title="خدمة متوقفة الآن">{d.targets.filter((t) => t.down).map((t) => t.label).join('، ')} — وصلك إشعار على الجرس والموبايل.</Alert>}
      <section className="card stack">
        <div className="row-between"><h2 className="section-title row"><Globe size={20} aria-hidden />توفّر الخدمة</h2><span className="small muted">فحص كل 5 دقائق</span></div>
        <div className="monitor-grid">
          {d.targets.map((t) => (
            <div key={t.key} className={`monitor-card ${t.down ? 'is-down' : t.last?.ok ? 'is-up' : ''}`}>
              <div className="row" style={{ gap: 8 }}>
                {t.down ? <XCircle size={20} color="var(--c-danger)" aria-hidden /> : t.last?.ok ? <CheckCircle2 size={20} color="var(--c-success)" aria-hidden /> : <AlertTriangle size={20} color="var(--c-warning)" aria-hidden />}
                <strong className="grow">{t.label}</strong>
                <Badge tone={t.down ? 'danger' : t.last?.ok ? 'success' : 'warning'}>{t.down ? 'متوقف' : t.last?.ok ? 'يعمل' : t.last ? 'فشل آخر فحص' : 'بانتظار أول فحص'}</Badge>
              </div>
              <div className="row small muted" style={{ gap: 'var(--s-4)', flexWrap: 'wrap' }}>
                <span>آخر 24 ساعة: <strong className="num">{pct(t.uptime_24h)}</strong></span>
                <span>آخر 7 أيام: <strong className="num">{pct(t.uptime_7d)}</strong></span>
                {t.last && <span>آخر فحص: {formatDateTime(t.last.at)}</span>}
              </div>
              {t.last && !t.last.ok && <span className="small"><bdi dir="ltr">{t.last.status ?? t.last.error}</bdi></span>}
            </div>
          ))}
        </div>
        {d.incidents.length > 0 && (
          <details>
            <summary className="small">سجل الانقطاعات ({d.incidents.length})</summary>
            <ul className="small stack-sm" style={{ marginTop: 8 }}>
              {d.incidents.map((i) => <li key={i.started_at + i.target}>{i.target}: من {formatDateTime(i.started_at)} {i.ended_at ? `إلى ${formatDateTime(i.ended_at)}` : '— مستمر'}{i.error && <span className="muted"> · <bdi dir="ltr">{i.error}</bdi></span>}</li>)}
            </ul>
          </details>
        )}
      </section>
      <section className="card card-flush">
        <div className="card-header row-between"><h2 className="row" style={{ gap: 8 }}><Smartphone size={20} aria-hidden />أعطال التطبيق والموقع</h2><span className="small muted">آخر 24 ساعة: <span className="num">{d.errors_24h}</span></span></div>
        {d.errors.length === 0 ? <p className="small muted" style={{ padding: 'var(--s-4)' }}>ما في أعطال خلال آخر 7 أيام.</p> : (
          <div className="stack-sm" style={{ padding: 'var(--s-3) var(--s-4) var(--s-4)' }}>
            {d.errors.map((e) => (
              <details key={e.fingerprint + e.source} className="monitor-error">
                <summary>
                  <Badge tone={e.source === 'web' ? 'neutral' : 'info'}>{sourceLabel[e.source]}</Badge>
                  <bdi dir="ltr" className="grow small monitor-msg">{e.message}</bdi>
                  <span className="small muted num">×{e.count}</span>
                  <span className="small muted">{formatDateTime(e.last_at)}</span>
                </summary>
                <div className="small stack-sm" style={{ paddingTop: 8 }}>
                  <span>الصفحة: <bdi dir="ltr">{e.url ?? '—'}</bdi> · النسخة: <bdi dir="ltr">{e.app_version ?? '—'}</bdi> · مستخدمون متأثرون: <span className="num">{e.users}</span> · أول ظهور: {formatDateTime(e.first_at)}</span>
                  {e.stack && <pre className="monitor-stack" dir="ltr">{e.stack}</pre>}
                </div>
              </details>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

/** Jobs, notification backlog/dead letters, file quarantine — no patient data. */
export function AdminHealth() {
  const toast = useToast();
  const h = useAsync(async () => (await unwrap(supabase.rpc('system_health'))) as unknown as H, []);
  const retry = async (id: string) => {
    const { error } = await supabase.rpc('admin_retry_dead_notification', { p_id: id });
    if (error) toast(errorMessage(error), 'danger'); else { toast('أُعيدت للمحاولة', 'success'); h.reload(); }
  };
  return (
    <div className="stack">
      <PageHead title="صحة النظام" actions={<Button variant="secondary" size="sm" onClick={h.reload}>تحديث</Button>} />
      {h.status === 'loading' && <SkeletonList />}
      {h.status === 'error' && <ErrorState error={h.error} onRetry={h.reload} />}
      <Monitor />
      {h.data && (
        <>
          <div className="kpi-strip">
            <div className="kpi"><Activity size={22} aria-hidden /><div><div className="kpi-v num">{h.data.outbox.pending}</div><div className="kpi-l">إشعارات بالانتظار</div></div></div>
            <div className="kpi"><div><div className="kpi-v num">{h.data.outbox.dead}</div><div className="kpi-l">إشعارات فاشلة نهائياً</div></div></div>
            <div className="kpi"><div><div className="kpi-v num">{h.data.attachments.quarantine}</div><div className="kpi-l">ملفات قيد الفحص</div></div></div>
            <div className="kpi"><div><div className="kpi-v num">{h.data.reminders_due_backlog}</div><div className="kpi-l">تذكيرات متأخرة</div></div></div>
          </div>
          {(h.data.reminders_due_backlog > 0 || h.data.jobs.some((j) => j.failures_24h > 0)) && <Alert tone="warning">توجد مهام متأخرة أو فاشلة — راجع الجدول أدناه وسجلات Edge Functions.</Alert>}
          <section className="card card-flush"><div className="card-header"><h2>المهام المجدولة</h2></div>
            <div className="table-wrap" role="region" aria-label="المهام" tabIndex={0}><table className="table">
              <thead><tr><th>المهمة</th><th>الجدول</th><th>آخر تشغيل</th><th>الحالة</th><th>فشل خلال 24 ساعة</th></tr></thead>
              <tbody>{h.data.jobs.map((j) => <tr key={j.job}><td><bdi dir="ltr">{j.job}</bdi></td><td><bdi dir="ltr">{j.schedule}</bdi></td><td className="small">{j.last_run ? formatDateTime(j.last_run) : '—'}</td>
                <td>{j.last_status === 'succeeded' ? <Badge tone="success">ناجح</Badge> : j.last_status ? <Badge tone="danger">{j.last_status}</Badge> : <Badge tone="neutral">لم يعمل</Badge>}</td><td className="num">{j.failures_24h}</td></tr>)}</tbody>
            </table></div></section>
          <section className="card card-flush"><div className="card-header"><h2>الإشعارات الفاشلة (للمراجعة)</h2></div>
            {h.data.dead_letters.length === 0 ? <p className="small muted" style={{ padding: 'var(--s-4)' }}>لا توجد.</p> : (
              <div className="table-wrap" role="region" aria-label="الفاشلة" tabIndex={0}><table className="table">
                <thead><tr><th>القالب</th><th>القناة</th><th>المحاولات</th><th>آخر خطأ</th><th><span className="sr-only">إعادة</span></th></tr></thead>
                <tbody>{h.data.dead_letters.map((d) => <tr key={d.id}><td><bdi dir="ltr">{d.template}</bdi></td><td>{d.channel}</td><td className="num">{d.attempts}</td><td className="small"><bdi dir="ltr">{d.last_error}</bdi></td>
                  <td><Button size="sm" variant="ghost" icon={<RotateCcw size={14} />} onClick={() => retry(d.id)}>إعادة</Button></td></tr>)}</tbody>
              </table></div>)}
          </section>
        </>
      )}
    </div>
  );
}
