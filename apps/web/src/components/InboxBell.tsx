import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

/** Bell in the staff top bar with the number of unread notifications (live). */
export function InboxBell() {
  const { session } = useAuth();
  const uid = session?.user.id;
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!uid) return;
    const count = async () => {
      const { count: n } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
      setUnread(n ?? 0);
    };
    void count();
    const ch = supabase.channel(`bell:${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` }, () => void count()).subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [uid]);
  return (
    <Link to="/workspace/notifications" className="icon-btn inbox-bell" aria-label={unread ? `الإشعارات (${unread} غير مقروءة)` : 'الإشعارات'} title="الإشعارات">
      <Bell size={20} aria-hidden />{unread > 0 && <span className="dot">{unread > 99 ? '99+' : unread}</span>}
    </Link>
  );
}
