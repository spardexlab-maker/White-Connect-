import { ImagePlus, Trash2 } from 'lucide-react';
import { mediaUrl, type MediaItem } from '../lib/media';
import { EmptyState } from './ui';

/** Grid of public images (clinic photos, certificates); opens the full image in a new tab. */
export function MediaGallery({ items, empty, onRemove }: { items: MediaItem[]; empty?: string; onRemove?: (m: MediaItem) => void }) {
  if (!items.length) return empty ? <EmptyState icon={<ImagePlus />} title={empty} /> : null;
  return (
    <ul className="media-grid">
      {items.map((it) => (
        <li key={it.id}>
          <a href={mediaUrl(it.path)!} target="_blank" rel="noreferrer noopener"><img src={mediaUrl(it.path)!} alt={it.caption ?? ''} loading="lazy" /></a>
          {it.caption && <span className="small">{it.caption}</span>}
          {onRemove && <button type="button" className="media-remove" aria-label="حذف الصورة" onClick={() => onRemove(it)}><Trash2 size={16} /></button>}
        </li>
      ))}
    </ul>
  );
}
