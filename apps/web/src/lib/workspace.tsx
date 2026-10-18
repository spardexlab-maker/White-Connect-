import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { FacilityType, MemberRole } from '@app/shared';
import { supabase } from './supabase';
import { useAuth } from './auth';

export interface Workspace {
  membership_id: string;
  role: MemberRole;
  organization_id: string;
  organization_name: string;
  facility_id: string | null;
  facility_name: string | null;
  facility_type: FacilityType | null;
  branch_id: string | null;
  branch_name: string | null;
  timezone: string;
  default_pharmacy_id: string | null;
  default_lab_id: string | null;
}

interface WorkspaceState {
  workspaces: Workspace[];
  loading: boolean;
  error: unknown;
  current: Workspace | null;
  select: (membershipId: string) => void;
  reload: () => Promise<void>;
}

const Ctx = createContext<WorkspaceState | null>(null);

/**
 * Memberships always come from the server (my_workspaces). The selected
 * workspace id kept in sessionStorage is only a UI preference — every RPC
 * re-checks the membership server-side, so tampering grants nothing.
 */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [currentId, setCurrentId] = useState<string | null>(() => sessionStorage.getItem('ws.current'));

  const reload = useCallback(async () => {
    if (!session) { setWorkspaces([]); setLoading(false); return; }
    setLoading(true);
    const { data, error: err } = await supabase.rpc('my_workspaces');
    setError(err);
    setWorkspaces((data as Workspace[] | null) ?? []);
    setLoading(false);
  }, [session]);

  useEffect(() => { void reload(); }, [reload]);

  const current = useMemo(() => {
    const found = workspaces.find((w) => w.membership_id === currentId);
    if (found) return found;
    return workspaces.length === 1 ? workspaces[0] : null;
  }, [workspaces, currentId]);

  const select = useCallback((id: string) => {
    sessionStorage.setItem('ws.current', id);
    setCurrentId(id);
  }, []);

  const value = useMemo(() => ({ workspaces, loading, error, current, select, reload }), [workspaces, loading, error, current, select, reload]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkspace(): WorkspaceState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useWorkspace outside WorkspaceProvider');
  return ctx;
}
