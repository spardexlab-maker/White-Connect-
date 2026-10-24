import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { refreshPush } from '../lib/webPush';
import { useToast } from './ui';

/** While the site is open a new notification pops up at once (realtime); also keeps this browser's push subscription tied to the user. */
export function LiveNotifications() {
  const { session } = useAuth();
  const toast = useToast();
  const uid = session?.user.id;
  useEffect(() => {
    if (!uid) return;
    void refreshPush();
    const ch = supabase.channel(`inbox:${uid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` }, (p) => {
        const n = p.new as { title: string; body: string; link: string | null };
        toast(`${n.title} — ${n.body}`, 'default');
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [uid, toast]);
  return null;
}
