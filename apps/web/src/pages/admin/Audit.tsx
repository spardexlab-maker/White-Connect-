import { ScrollText } from 'lucide-react';
import { formatDateTime } from '@app/shared';
import { supabase } from '../../lib/supabase';
import { unwrap, useAsync } from '../../lib/useAsync';
import { EmptyState, ErrorState, Ltr, PageHead, SkeletonList } from '../../components/ui';

/** Audit trail: actions and identifiers only — clinical content is never copied here. */
export function AdminAudit() {
  const data = useAsync(async () => (await unwrap(supabase.from('access_audit').select('id, occurred_at, actor_user_id, action, entity_type, entity_id, reason').order('occurred_at', { ascending: false }).limit(100))) ?? [], []);
  return (
    <div className="stack">
      <PageHead title="سجل التدقيق" subtitle="آخر 100 حدث" />
      <section className="card card-flush">
        {data.status === 'loading' && <SkeletonList />}
        {data.status === 'error' && <ErrorState error={data.error} onRetry={data.reload} />}
        {data.data?.length === 0 && <EmptyState icon={<ScrollText />} title="لا توجد أحداث" />}
        {!!data.data?.length && (
          <div className="table-wrap" role="region" aria-label="سجل التدقيق" tabIndex={0}>
            <table className="table">
              <thead><tr><th>الوقت</th><th>الإجراء</th><th>الكيان</th><th>المنفّذ</th><th>السبب</th></tr></thead>
              <tbody>
                {data.data.map((r) => (
                  <tr key={r.id}>
                    <td className="small">{formatDateTime(r.occurred_at)}</td>
                    <td><Ltr>{r.action}</Ltr></td>
                    <td className="small"><Ltr>{r.entity_type}:{r.entity_id?.slice(0, 8)}</Ltr></td>
                    <td className="small"><Ltr>{r.actor_user_id?.slice(0, 8) ?? 'system'}</Ltr></td>
                    <td className="small">{r.reason ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
