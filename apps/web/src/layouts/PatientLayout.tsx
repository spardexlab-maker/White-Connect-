import { NavLink, Outlet, Link, useLocation } from 'react-router-dom';
import { LiveNotifications } from '../components/LiveNotifications';
import { Activity, Bell, CalendarDays, Home, Route, UserRound, Briefcase } from 'lucide-react';
import { productName } from '../lib/supabase';
import { OfflineBanner } from '../components/ui';
import { useAuth } from '../lib/auth';

const items = [
  { to: '/patient', label: 'الرئيسية', icon: Home, end: true },
  { to: '/patient/appointments', label: 'حجوزاتي', icon: CalendarDays },
  { to: '/patient/journey', label: 'رحلتي', icon: Route },
  { to: '/patient/health', label: 'صحتي', icon: Activity },
  { to: '/patient/account', label: 'حسابي', icon: UserRound },
];

export function PatientLayout() {
  const { session } = useAuth();
  const location = useLocation();
  return (
    <div className="p-shell">
      <a href="#main" className="skip-link">تخطَّ إلى المحتوى</a>
      <OfflineBanner />
      <header className="p-header">
        <div className="p-header-inner">
          <Link to="/patient" className="brand"><img className="brand-logo" src="/logo-symbol.png" alt="" width={34} height={34} />{productName}</Link>
          <nav className="p-desktop-nav" aria-label="التنقل الرئيسي">
            {items.map((i) => <NavLink key={i.to} to={i.to} end={i.end}>{i.label}</NavLink>)}
          </nav>
          <LiveNotifications />
          {session && <Link to="/patient/notifications" className="icon-btn" aria-label="الإشعارات" title="الإشعارات"><Bell size={20} aria-hidden /></Link>}
          {!session && <Link to="/login" className="btn btn-ghost btn-sm"><Briefcase size={16} aria-hidden />دخول المهنيين</Link>}
        </div>
      </header>
      <main id="main" className="p-main"><div key={location.pathname} className="page"><Outlet /></div></main>
      <nav className="p-bottomnav" aria-label="التنقل الرئيسي">
        <ul>
          {items.map(({ to, label, icon: Icon, end }) => (
            <li key={to}><NavLink to={to} end={end}><span className="ico"><Icon size={21} aria-hidden /></span>{label}</NavLink></li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
