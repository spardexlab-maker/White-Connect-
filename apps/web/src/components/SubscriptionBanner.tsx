import { AlertTriangle, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { unwrap, useAsync } from '../lib/useAsync';

interface Notice { state: 'expiring' | 'expired' | 'unpaid'; ends_on: string; days_left: number }
const CONTACT = { phone: '+964 788 317 3489', email: 'info@spardexlab.site' };

/** Reminder for the facility's staff: a week before the end (yellow), then red once ended or unpaid. Nothing is switched off. */
export function SubscriptionBanner({ organizationId }: { organizationId: string }) {
  const r = useAsync(async () => (await unwrap(supabase.rpc('subscription_notice', { p_organization_id: organizationId }))) as unknown as Notice | null, [organizationId]);
  const n = r.data;
  if (!n) return null;
  const day = new Intl.DateTimeFormat('ar-IQ', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${n.ends_on}T00:00:00Z`));
  const red = n.state !== 'expiring';
  const text = n.state === 'expired' ? `اشتراككم منتهي من ${day}، تواصلوا ويانا حتى نجدده.`
    : n.state === 'unpaid' ? 'اشتراككم غير مسدّد، تواصلوا ويانا.'
    : n.days_left === 0 ? 'اشتراككم يخلص اليوم، تواصلوا ويانا حتى نجدده.'
    : `اشتراككم يخلص بعد ${n.days_left} ${n.days_left >= 3 && n.days_left <= 10 ? 'أيام' : 'يوم'} (${day})، تواصلوا ويانا حتى نجدده.`;
  return (
    <div className={`sub-banner ${red ? 'danger' : 'warning'}`} role={red ? 'alert' : 'status'}>
      {red ? <AlertTriangle size={20} aria-hidden /> : <Clock size={20} aria-hidden />}
      <span className="grow">
        <strong>{text}</strong>{' '}
        <span>واتساب: <a href={`https://wa.me/${CONTACT.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"><bdi dir="ltr">{CONTACT.phone}</bdi></a> · <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a></span>
      </span>
    </div>
  );
}
