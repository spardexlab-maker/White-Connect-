import { useRef, useState } from 'react';
import { Award, Building2, Camera, ImagePlus, UserRound } from 'lucide-react';
import { errorMessage } from '@app/shared';
import { supabase } from '../../lib/supabase';
import { useAsync } from '../../lib/useAsync';
import { useAuth } from '../../lib/auth';
import { useWorkspace } from '../../lib/workspace';
import { fetchProviderMedia, mediaUrl, uploadProviderMedia, type MediaItem } from '../../lib/media';
import { MediaGallery as Gallery } from '../../components/MediaGallery';
import { Avatar, Button, ConfirmDialog, ErrorState, PageHead, SkeletonList, TextField, useToast } from '../../components/ui';

type Kind = 'clinic_photo' | 'certificate' | 'profile_photo';

/** The doctor's public profile media: personal photo, certificates, and photos of this clinic. */
export function DoctorProfile() {
  const { access } = useAuth();
  const { current } = useWorkspace();
  const toast = useToast();
  const facilityId = current!.facility_id!;
  const me = access?.practitioner_id ?? '';
  const media = useAsync(() => fetchProviderMedia(facilityId, me), [facilityId, me]);
  const [busy, setBusy] = useState<Kind | null>(null);
  const [caption, setCaption] = useState('');
  const [removing, setRemoving] = useState<MediaItem | null>(null);

  const upload = async (kind: Kind, files: FileList | null) => {
    if (!files?.length) return;
    setBusy(kind);
    try {
      for (const f of Array.from(files)) await uploadProviderMedia(kind, kind === 'clinic_photo' ? facilityId : me, f, kind === 'certificate' ? caption : undefined);
      if (kind === 'certificate') setCaption('');
      toast('تم الرفع — تظهر الآن في صفحتك للمرضى', 'success');
      media.reload();
    } catch (e) {
      toast(errorMessage(e), 'danger');
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!removing) return;
    const { error } = await supabase.rpc('remove_provider_media', { p_media_id: removing.id });
    setRemoving(null);
    if (error) toast(errorMessage(error), 'danger'); else { toast('تم الحذف', 'success'); media.reload(); }
  };

  if (media.status === 'loading' && !media.data) return <SkeletonList />;
  if (media.status === 'error') return <ErrorState error={media.error} onRetry={media.reload} />;
  const m = media.data!;

  return (
    <div className="stack">
      <PageHead title="ملفي المهني" subtitle="الصور والشهادات تظهر للمرضى في صفحتك عند البحث والحجز" />

      <section className="card stack" aria-labelledby="photo-title">
        <h2 id="photo-title" className="section-title"><UserRound size={18} aria-hidden /> صورتي الشخصية</h2>
        <div className="row" style={{ gap: 'var(--s-4)' }}>
          <Avatar name="د" size="lg" src={mediaUrl(m.photo)} />
          <Picker label={m.photo ? 'تغيير الصورة' : 'رفع صورة'} icon={<Camera size={16} />} loading={busy === 'profile_photo'}
                  onFiles={(f) => upload('profile_photo', f)} />
        </div>
      </section>

      <section className="card stack" aria-labelledby="cert-title">
        <h2 id="cert-title" className="section-title"><Award size={18} aria-hidden /> الشهادات والإجازات</h2>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div className="grow"><TextField label="وصف الشهادة (اختياري)" value={caption} maxLength={200}
                                            placeholder="مثال: البورد العربي في طب الأطفال" onChange={(e) => setCaption(e.target.value)} /></div>
          <Picker label="رفع شهادة" icon={<ImagePlus size={16} />} loading={busy === 'certificate'} onFiles={(f) => upload('certificate', f)} />
        </div>
        <Gallery items={m.certificates} empty="لم ترفع شهادات بعد" onRemove={setRemoving} />
      </section>

      <section className="card stack" aria-labelledby="clinic-title">
        <div className="row-between">
          <h2 id="clinic-title" className="section-title"><Building2 size={18} aria-hidden /> صور العيادة — {current!.facility_name}</h2>
          <Picker label="إضافة صور" icon={<ImagePlus size={16} />} multiple loading={busy === 'clinic_photo'} onFiles={(f) => upload('clinic_photo', f)} />
        </div>
        <Gallery items={m.clinic_photos} empty="لا توجد صور للعيادة" onRemove={setRemoving} />
      </section>

      <p className="muted small">الصيغ: PNG أو JPEG أو WEBP، حتى 5 ميغابايت للصورة. الصور عامة يراها أي زائر لصفحتك — لا ترفع صوراً فيها مرضى أو بيانات شخصية.</p>

      <ConfirmDialog open={!!removing} title="حذف الصورة؟" confirmLabel="حذف" tone="danger" onConfirm={remove} onCancel={() => setRemoving(null)}>
        لن تظهر بعد الآن في صفحتك.
      </ConfirmDialog>
    </div>
  );
}

function Picker({ label, icon, loading, multiple, onFiles }: { label: string; icon: React.ReactNode; loading: boolean; multiple?: boolean; onFiles: (f: FileList | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp" multiple={multiple} hidden
             onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />
      <Button variant="secondary" size="sm" icon={icon} loading={loading} onClick={() => ref.current?.click()}>{label}</Button>
    </>
  );
}
