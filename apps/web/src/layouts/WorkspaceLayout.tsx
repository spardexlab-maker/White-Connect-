import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity, BarChart3, Boxes, Receipt, Building2, CalendarClock, ChevronDown, ClipboardList, FlaskConical, HeartPulse, LayoutDashboard, LogOut, Menu,
  LockKeyhole, Pill, ScrollText, Settings2, ShieldCheck, Stethoscope, Users,
} from 'lucide-react';
import { facilityTypeLabel, roleLabel, workspaceArea, formatDate } from '@app/shared';
import { useAuth } from '../lib/auth';
import { useWorkspace, type Workspace } from '../lib/workspace';
import { productName } from '../lib/supabase';
import { OfflineBanner, Sheet } from '../components/ui';

interface NavItem { to: string; label: string; icon: ReactNode; end?: boolean }

/** Short role-specific menus; forbidden features are not shown at all (§24). */
function navFor(ws: Workspace | null, isPlatformAdmin: boolean, path: string): NavItem[] {
  if (path.startsWith('/platform-admin') && isPlatformAdmin) {
    return [
      { to: '/platform-admin', label: 'نظرة عامة', icon: <LayoutDashboard size={20} />, end: true },
      { to: '/platform-admin/organizations', label: 'المجمعات والجهات', icon: <Building2 size={20} /> },
      { to: '/platform-admin/members', label: 'الحسابات والعضويات', icon: <Users size={20} /> },
      { to: '/platform-admin/reports', label: 'التقارير والمالية', icon: <BarChart3 size={20} /> },
      { to: '/platform-admin/audit', label: 'سجل التدقيق', icon: <ScrollText size={20} /> },
      { to: '/platform-admin/health', label: 'صحة النظام', icon: <Activity size={20} /> },
    ];
  }
  if (!ws) return [];
  switch (workspaceArea(ws.role)) {
    case 'reception':
      return [{ to: '/workspace/reception', label: 'لوحة اليوم', icon: <CalendarClock size={20} />, end: true }];
    case 'doctor':
      return [
        { to: '/workspace/doctor', label: 'اليوم والطابور', icon: <Stethoscope size={20} />, end: true },
        { to: '/workspace/doctor/schedule', label: 'الجدول والخدمات', icon: <Settings2 size={20} /> },
      ];
    case 'pharmacy':
      return [
        { to: '/workspace/pharmacy', label: 'وارد الوصفات', icon: <Pill size={20} />, end: true },
        { to: '/workspace/pharmacy/stock', label: 'المخزون والدفعات', icon: <Boxes size={20} /> },
        { to: '/workspace/pharmacy/sales', label: 'المبيعات والمرتجعات', icon: <Receipt size={20} /> },
        ...(ws.role === 'pharmacist' ? [{ to: '/workspace/pharmacy/reports', label: 'التقارير', icon: <BarChart3 size={20} /> }] : []),
        { to: '/workspace/pharmacy/doctors', label: 'أطباء المجمع', icon: <Users size={20} /> },
      ];
    case 'lab':
      return [
        { to: '/workspace/lab', label: 'طلبات المختبر', icon: <FlaskConical size={20} />, end: true },
        { to: '/workspace/lab/doctors', label: 'أطباء المجمع', icon: <Users size={20} /> },
      ];
    default:
      return [
        { to: '/workspace/organization', label: 'المنشأة والأعضاء', icon: <ClipboardList size={20} />, end: true },
        { to: '/workspace/organization/reports', label: 'التقارير والمالية', icon: <BarChart3 size={20} /> },
        { to: '/workspace/reception', label: 'لوحة اليوم', icon: <CalendarClock size={20} /> },
      ];
  }
}

export function WorkspaceLayout() {
  const { access, signOut } = useAuth();
  const { current, workspaces } = useWorkspace();
  const [menuOpen, setMenuOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => setMenuOpen(false), [location.pathname]);

  const nav = navFor(current, !!access?.is_platform_admin, location.pathname);
  const onAdmin = location.pathname.startsWith('/platform-admin');
  const pageTitle = [...nav].sort((a, b) => b.to.length - a.to.length).find((n) => location.pathname.startsWith(n.to))?.label
    ?? (current ? roleLabel[current.role] : '');

  return (
    <div className="w-shell">
      <a href="#main" className="skip-link">تخطَّ إلى المحتوى</a>
      <aside className="w-sidebar" data-open={menuOpen} aria-label="القائمة الجانبية">
        <div className="brand"><span className="brand-mark"><HeartPulse size={18} aria-hidden /></span>{productName}</div>
        {onAdmin ? (
          <div className="w-ws-card" aria-label="مساحة العمل الحالية">
            <span className="ws-ico"><ShieldCheck size={20} aria-hidden /></span>
            <span className="grow"><strong>إدارة المنصة</strong><span>صلاحيات المشرف العام</span></span>
          </div>
        ) : current ? (
          <button className="w-ws-card" onClick={() => setSwitcherOpen(true)} disabled={workspaces.length < 2}
                  aria-label={`مساحة العمل الحالية: ${current.facility_name ?? current.organization_name}${workspaces.length > 1 ? ' — تبديل' : ''}`}>
            <span className="ws-ico">{wsIcon(current)}</span>
            <span className="grow" style={{ minWidth: 0 }}>
              <strong className="truncate">{current.facility_name ?? current.organization_name}</strong>
              <span className="truncate">{roleLabel[current.role]}{current.branch_name ? ` · ${current.branch_name}` : ''}</span>
            </span>
            {workspaces.length > 1 && <ChevronDown size={16} aria-hidden />}
          </button>
        ) : null}
        <nav aria-label="أقسام مساحة العمل">
          <div className="w-nav-label" aria-hidden>الأقسام</div>
          <ul className="w-nav">
            {nav.map((n) => <li key={n.to}><NavLink to={n.to} end={n.end}>{n.icon}{n.label}</NavLink></li>)}
          </ul>
        </nav>
        <div className="w-sidebar-foot">
          {access?.is_platform_admin && !onAdmin && <NavLink to="/platform-admin"><ShieldCheck size={16} aria-hidden />إدارة المنصة</NavLink>}
          {access?.patient_ids?.length ? <NavLink to="/patient"><HeartPulse size={16} aria-hidden />مساحتي الشخصية كمريض</NavLink> : null}
          <NavLink to="/security"><LockKeyhole size={16} aria-hidden />الأمان والمصادقة الثنائية</NavLink>
        </div>
      </aside>
      {menuOpen && <div className="overlay" style={{ zIndex: 84 }} onClick={() => setMenuOpen(false)} aria-hidden />}

      <header className="w-topbar">
        <button className="icon-btn w-menu-btn" onClick={() => setMenuOpen(true)} aria-label="فتح القائمة"><Menu size={22} /></button>
        <div className="w-crumb">
          <strong className="truncate">{onAdmin ? 'إدارة المنصة' : current?.facility_name ?? current?.organization_name ?? ''}</strong>
          <span className="truncate">{pageTitle}</span>
        </div>
        <span className="grow" />
        <span className="muted small hide-sm">{formatDate(new Date())}</span>
        <button className="btn btn-ghost btn-sm" onClick={async () => { await signOut(); navigate('/login'); }}>
          <LogOut size={16} aria-hidden /><span className="hide-sm">خروج</span>
        </button>
      </header>

      <main id="main" className="w-main">
        <OfflineBanner />
        <div key={location.pathname} className="page"><Outlet /></div>
      </main>

      <WorkspaceSwitcher open={switcherOpen} onClose={() => setSwitcherOpen(false)} />
    </div>
  );
}

function wsIcon(w: Workspace) {
  return w.facility_type === 'pharmacy' ? <Pill size={20} aria-hidden /> : w.facility_type === 'laboratory' ? <FlaskConical size={20} aria-hidden />
    : w.facility_type === 'clinic' ? <Stethoscope size={20} aria-hidden /> : <Building2 size={20} aria-hidden />;
}

export function WorkspaceSwitcher({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { workspaces, current, select } = useWorkspace();
  const navigate = useNavigate();
  return (
    <Sheet open={open} onClose={onClose} title="اختيار مساحة العمل">
      <WorkspaceList
        workspaces={workspaces}
        currentId={current?.membership_id}
        onPick={(w) => { select(w.membership_id); onClose(); navigate(areaPath(w)); }}
      />
    </Sheet>
  );
}

export function areaPath(w: Workspace): string {
  const area = workspaceArea(w.role);
  return area === 'organization' ? '/workspace/organization' : `/workspace/${area}`;
}

export function WorkspaceList({ workspaces, currentId, onPick }: { workspaces: Workspace[]; currentId?: string; onPick: (w: Workspace) => void }) {
  return (
    <div className="card card-flush">
      <ul className="list" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
        {workspaces.map((w) => (
          <li key={w.membership_id}>
            <button className="list-item" aria-current={w.membership_id === currentId} onClick={() => onPick(w)}>
              <div className="avatar" aria-hidden>{wsIcon(w)}</div>
              <div className="grow">
                <strong className="truncate" style={{ display: 'block' }}>{w.facility_name ?? w.organization_name}</strong>
                <span className="muted small">{roleLabel[w.role]}{w.facility_type ? ` · ${facilityTypeLabel[w.facility_type]}` : ''}{w.branch_name ? ` · ${w.branch_name}` : ''}</span>
                <span className="muted small" style={{ display: 'block' }}>{w.organization_name}</span>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
