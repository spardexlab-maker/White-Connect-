import { supabase } from './supabase';
import { useAsync } from './useAsync';

export interface MediaItem { id: string; path: string; caption: string | null }
export interface ProviderMedia { clinic_photos: MediaItem[]; certificates: MediaItem[]; photo: string | null }

/** Public URL of a file in the `public-media` bucket. */
export const mediaUrl = (path: string | null | undefined) =>
  path ? supabase.storage.from('public-media').getPublicUrl(path).data.publicUrl : null;

export function useProviderMedia(facilityId?: string, practitionerId?: string) {
  return useAsync(async () => {
    if (!facilityId) return null;
    const { data, error } = await supabase.rpc('provider_media', { p_facility_id: facilityId, p_practitioner_id: practitionerId });
    if (error) throw error;
    return data as unknown as ProviderMedia;
  }, [facilityId, practitionerId]);
}
