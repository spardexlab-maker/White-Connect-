import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { cancelAllReminders } from './reminders';

export interface AccessSummary {
  user_id: string | null;
  account_status: 'active' | 'suspended' | null;
  is_platform_admin: boolean;
  practitioner_id: string | null;
  patient_ids: { patient_id: string; relationship: 'self' | 'guardian' }[];
}

interface AuthState {
  session: Session | null;
  loading: boolean;
  access: AccessSummary | null;
  refreshAccess: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [access, setAccess] = useState<AccessSummary | null>(null);

  const refreshAccess = useCallback(async () => {
    const { data, error } = await supabase.rpc('my_access_summary');
    setAccess(error ? null : (data as unknown as AccessSummary));
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) void refreshAccess();
    else setAccess(null);
  }, [session, refreshAccess]);

  const signOut = useCallback(async () => {
    // local reminders belong to this account; never leave them on a shared phone
    await cancelAllReminders();
    await supabase.auth.signOut();
  }, []);

  const value = useMemo(() => ({ session, loading, access, refreshAccess, signOut }), [session, loading, access, refreshAccess, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
