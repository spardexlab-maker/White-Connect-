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
        chime();
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [uid, toast]);
  return null;
}

/** Two soft tones (no audio file needed); silent if the browser blocks sound before any click. */
function chime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [[880, 0], [1320, 0.18]].forEach(([f, t]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = f; o.type = 'sine';
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.35);
      o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.4);
    });
    window.setTimeout(() => void ctx.close(), 1000);
  } catch { /* no sound available */ }
}
