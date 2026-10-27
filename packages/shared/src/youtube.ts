/** Explainer films hosted on YouTube (set by the super admin, shown in the app and on the site). */
export type VideoAudience = 'patient' | 'doctor' | 'lab' | 'pharmacy';
export interface ExplainerVideo { audience: VideoAudience; title: string; youtube_id: string }

export const videoAudienceLabel: Record<VideoAudience, string> = {
  patient: 'للمرضى', doctor: 'للأطباء', lab: 'للمختبرات', pharmacy: 'للصيدليات',
};

/** The 11-character id from any YouTube link (watch, youtu.be, shorts, embed, live) or a bare id. */
export function youtubeId(input: string): string | null {
  const s = (input ?? '').trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  const m = s.match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

export const youtubeWatchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;
export const youtubeEmbedUrl = (id: string) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&hl=ar`;
export const youtubeThumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
