import { Link } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { PushToggle } from '../../components/PushToggle';
import { formatDateTime } from '@app/shared';
import { supabase } from '../../lib/supabase';
import { unwrap, useAsync } from '../../lib/useAsync';
import { useAuth } from '../../lib/auth';
import { Button, EmptyState, ErrorState, SkeletonList } from '../../components/ui';
import { SignInPrompt } from './Account';

interface N { id: string; title: string; body: string; link: string | null; read_at: string | null; created_at: string }

export function Notifications() {
  const { session } = useAuth();
  const list = useAsync(async () => (session
    ? ((await unwrap(supabase.from('notifications').select('id, title, body, link, read_at, created_at').order('created_at', { ascending: false }).limit(50))) as N[])
    : []), [session?.user.id]);
  if (!session) return <SignInPrompt title="الإشعارات" />;

  const unread = (list.data ?? []).filter((n) => !n.read_at);
  const markAll = async () => {
    if (!unread.length) return;
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', unread.map((n) => n.id));
    list.reload();
  };

  return (
    <div className="stack">
      <div className="row-between">
        <h1 style={{ fontSize: 'var(--f-h2)' }}>الإشعارات</h1>
        {unread.length > 0 && <Button variant="secondary" size="sm" icon={<CheckCheck size={16} />} onClick={markAll}>تعليم الكل كمقروء</Button>}
      </div>
      <div className="card row-between" style={{ gap: 'var(--s-2)' }}>
        <span className="small">وصول إشعارات المواعيد والنتائج والتذكيرات إلى هذا المتصفح حتى وهو مغلق.</span>
        <PushToggle />
      </div>
      <div className="card card-flush">
        {list.status === 'loading' && !list.data && <SkeletonList rows={3} />}
        {list.status === 'error' && <ErrorState error={list.error} onRetry={list.reload} />}
        {list.data && list.data.length === 0 && <EmptyState icon={<Bell />} title="لا توجد إشعارات">ستصلك هنا تحديثات الحجوزات والنتائج والوصفات. وصول الإشعار لا يعني بالضرورة قراءته.</EmptyState>}
        <ul className="list" style={{ margin: 0, padding: 0 }}>
          {list.data?.map((n) => (
            <li key={n.id} className="list-item" style={{ alignItems: 'flex-start', background: n.read_at ? undefined : 'var(--c-accent-soft)' }}>
              <Bell size={18} aria-hidden style={{ marginBlockStart: 4, color: 'var(--c-accent)' }} />
              <div className="grow">
                {n.link ? <Link to={n.link}><strong>{n.title}</strong></Link> : <strong>{n.title}</strong>}{!n.read_at && <span className="sr-only"> (غير مقروء)</span>}
                <p className="small">{n.body}</p>
                <span className="small muted">{formatDateTime(n.created_at)}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
