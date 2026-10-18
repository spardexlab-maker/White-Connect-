import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { MemberRole } from '@app/shared';
import { useAuth } from '../lib/auth';
import { useWorkspace } from '../lib/workspace';
import { PermissionDenied, SkeletonList } from './ui';

/*
 * Route guards are UX only: they avoid showing screens a user cannot use.
 * The real enforcement is server-side (RLS + RPC checks).
 */
export function RequireStaff({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading) return <SkeletonList />;
  if (!session) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  return <>{children}</>;
}

export function RequireWorkspaceRole({ roles, children }: { roles: MemberRole[]; children: ReactNode }) {
  const { current, loading, workspaces } = useWorkspace();
  if (loading) return <SkeletonList />;
  if (!current) return workspaces.length ? <Navigate to="/workspace" replace /> : <PermissionDenied />;
  if (!roles.includes(current.role)) return <PermissionDenied />;
  return <>{children}</>;
}

export function RequirePlatformAdmin({ children }: { children: ReactNode }) {
  const { access } = useAuth();
  if (!access) return <SkeletonList />;
  if (access.platform_admin_needs_mfa) {
    return <PermissionDenied>حساب الإدارة يحتاج تفعيل المصادقة الثنائية (MFA) قبل الوصول.</PermissionDenied>;
  }
  if (!access.is_platform_admin) return <PermissionDenied />;
  return <>{children}</>;
}
