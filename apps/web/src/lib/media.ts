import { supabase } from './supabase';

export interface MediaItem { id: string; path: string; caption: string | null }
export interface ProviderMedia { clinic_photos: MediaItem[]; certificates: MediaItem[]; photo: string | null }

/** Public URL of a file in the `public-media` bucket. */
export const mediaUrl = (path: string | null | undefined) =>
  path ? supabase.storage.from('public-media').getPublicUrl(path).data.publicUrl : null;

export async function fetchProviderMedia(facilityId: string, practitionerId?: string | null): Promise<ProviderMedia> {
  const { data, error } = await supabase.rpc('provider_media', { p_facility_id: facilityId, p_practitioner_id: practitionerId ?? undefined });
  if (error) throw error;
  return data as unknown as ProviderMedia;
}

const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

/** Upload one image and register it (clinic photo, certificate or profile photo). */
export async function uploadProviderMedia(kind: 'clinic_photo' | 'certificate' | 'profile_photo', targetId: string, file: File, caption?: string) {
  const ext = EXT[file.type];
  if (!ext) throw new Error('الصيغ المسموحة: PNG أو JPEG أو WEBP');
  if (file.size > 5 * 1024 * 1024) throw new Error('الحد الأقصى لحجم الصورة 5 ميغابايت');
  const folder = kind === 'clinic_photo' ? 'facilities' : 'practitioners';
  const path = `${folder}/${targetId}/${crypto.randomUUID()}.${ext}`;
  const up = await supabase.storage.from('public-media').upload(path, file, { contentType: file.type, upsert: false });
  if (up.error) throw up.error;
  const { error } = await supabase.rpc('add_provider_media', { p_kind: kind, p_target_id: targetId, p_storage_path: path, p_caption: caption || undefined });
  if (error) throw error;
}
