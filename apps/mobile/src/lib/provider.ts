import { supabase } from './supabase';
import { unwrap, useAsync } from './useAsync';

export interface ProviderProfile {
  facility: {
    id: string; name: string; type: 'clinic' | 'laboratory' | 'pharmacy'; description: string | null; phone: string | null;
    opening_hours_note: string | null; organization_name: string; branch_name: string; area: string | null;
    address: string | null; city: string | null; latitude: number | null; longitude: number | null; timezone: string;
  };
  practitioner: { id: string; full_name: string; title: string | null; bio: string | null; specialty: string | null; license_verified: boolean } | null;
  services: { id: string; name: string; description: string | null; duration_minutes: number; price_minor: number | null; currency: string; preparation_note: string | null }[];
  weekly_hours: { weekday: number; start: string; end: string }[];
  policy: { confirmation_mode: 'manual' | 'auto'; confirmation_timeout_minutes: number; cancellation_cutoff_minutes: number; cancellation_policy_text: string | null; booking_window_days: number };
}

export function useProviderProfile(facilityId?: string, practitionerId?: string) {
  return useAsync(async () => {
    const data = await unwrap(supabase.rpc('get_provider_profile', { p_facility_id: facilityId!, p_practitioner_id: practitionerId }));
    return data as unknown as ProviderProfile | null;
  }, [facilityId, practitionerId]);
}

/** Saturday-first week order common in Iraq. */
export function groupHours(rows: ProviderProfile['weekly_hours']): [number, string][] {
  const map = new Map<number, string[]>();
  for (const r of rows) map.set(r.weekday, [...(map.get(r.weekday) ?? []), `${r.start.slice(0, 5)} – ${r.end.slice(0, 5)}`]);
  return [6, 0, 1, 2, 3, 4, 5].filter((d) => map.has(d)).map((d) => [d, map.get(d)!.join('، ')]);
}
