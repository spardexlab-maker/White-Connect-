import { Activity, RotateCcw } from 'lucide-react';
import { errorMessage, formatDateTime } from '@app/shared';
import { supabase } from '../../lib/supabase';
import { unwrap, useAsync } from '../../lib/useAsync';
import { Alert, Badge, Button, ErrorState, PageHead, SkeletonList, useToast } from '../../components/ui';

interface H { jobs: { job: string; schedule: string; last_status: string | null; last_run: string | null; failures_24h: number }[];
  outbox: { pending: number; dead: number; sent_24h: number; oldest_pending: string | null };
  dead_letters: { id: string; template: string; channel: string; attempts: number; last_error: string | null; created_at: string }[];
  attachments: { quarantine: number; rejected_7d: number }; reminders_due_backlog: number }

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
