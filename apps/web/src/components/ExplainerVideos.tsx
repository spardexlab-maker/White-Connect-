import { useState } from 'react';
import { Play } from 'lucide-react';
import { videoAudienceLabel, youtubeEmbedUrl, youtubeThumb, type ExplainerVideo, type VideoAudience } from '@app/shared';
import { supabase } from '../lib/supabase';
import { unwrap, useAsync } from '../lib/useAsync';

/** The explainer films the super admin linked from YouTube. Shows a still with a play button and loads
 *  the player only on click (no YouTube cookies or traffic until the viewer chooses to watch). */
export function ExplainerVideos({ audiences, title = 'شلون يشتغل أبيض؟' }: { audiences: VideoAudience[]; title?: string }) {
  const list = useAsync(async () => ((await unwrap(supabase.rpc('explainer_videos'))) ?? []) as unknown as ExplainerVideo[], []);
  const videos = (list.data ?? []).filter((v) => audiences.includes(v.audience));
  if (!videos.length) return null;
  return (
    <section className="stack-sm" aria-labelledby="explain-title">
      <h2 id="explain-title" className="section-title">{title}</h2>
      <div className="explainer-grid">{videos.map((v) => <VideoCard key={v.youtube_id} v={v} />)}</div>
    </section>
  );
}

function VideoCard({ v }: { v: ExplainerVideo }) {
  const [playing, setPlaying] = useState(false);
  return (
    <figure className="explainer card">
      <div className="explainer-frame">
        {playing
          ? <iframe src={youtubeEmbedUrl(v.youtube_id)} title={v.title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
          : (
            <button type="button" className="explainer-poster" onClick={() => setPlaying(true)} aria-label={`تشغيل الفيديو: ${v.title}`}>
              <img src={youtubeThumb(v.youtube_id)} alt="" loading="lazy" />
              <span className="explainer-play" aria-hidden><Play size={30} fill="currentColor" /></span>
            </button>
          )}
      </div>
      <figcaption className="row-between"><strong>{v.title}</strong><span className="small muted">{videoAudienceLabel[v.audience]}</span></figcaption>
    </figure>
  );
}
