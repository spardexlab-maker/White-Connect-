import { Link } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { formatDateTime } from '@app/shared';
import { supabase } from '../../lib/supabase';
import { unwrap, useAsync } from '../../lib/useAsync';
import { Button, EmptyState, ErrorState, PageHead, SkeletonList } from '../../components/ui';

interface N { id: string; title: string; body: string; link: string | null; read_at: string | null; created_at: string }

/** Staff notifications (pharmacy notes, results to review, new home-visit requests…); each opens its page. */
export function StaffInbox() {
  const list = useAsync(async () => ((await unwrap(supabase.from('notifications').select('id, title, body, link, read_at, created_at')
    .order('created_at', { ascending: false }).limit(60))) ?? []) as N[], []);
  const unread = (list.data ?? []).filter((n) => !n.read_at);
  const read = async (ids: string[]) => {
    if (!ids.length) return;
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids);
    list.reload();
  };
  return (
    <div className="stack">
      <PageHead title="الإشعارات" actions={unread.length > 0 && <Button size="sm" variant="secondary" icon={<CheckCheck size={16} />} onClick={() => void read(unread.map((n) => n.id))}>تعليم الكل كمقروء</Button>} />
      <div className="card card-flush">
        {list.status === 'loading' && !list.data && <SkeletonList rows={3} />}
        {list.status === 'error' && <ErrorState error={list.error} onRetry={list.reload} />}
        {list.data?.length === 0 && <EmptyState icon={<Bell />} title="لا توجد إشعارات" />}
        <ul className="list" style={{ margin: 0, padding: 0 }}>
          {list.data?.map((n) => (
            <li key={n.id} className="list-item" style={{ alignItems: 'flex-start', background: n.read_at ? undefined : 'var(--c-accent-soft)' }}>
              <Bell size={18} aria-hidden style={{ marginBlockStart: 4, color: 'var(--c-accent)' }} />
              <div className="grow stack-sm" style={{ gap: 2 }}>
                <strong>{n.title}</strong>
                <span className="small">{n.body}</span>
                <span className="small muted">{formatDateTime(n.created_at)}</span>
              </div>
              {n.link && n.link.startsWith('/workspace') && <Link className="btn btn-secondary btn-sm" to={n.link} onClick={() => void read([n.id])}>فتح</Link>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
