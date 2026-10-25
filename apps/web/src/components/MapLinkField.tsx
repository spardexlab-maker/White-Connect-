import { useState } from 'react';
import { Crosshair, MapPin } from 'lucide-react';
import { isShortMapLink, mapEmbedUrl, parseMapLink, type LatLng } from '@app/shared';
import { supabase } from '../lib/supabase';
import { Alert, Button, Ltr, TextField } from './ui';

/** The clinic's place from a pasted map link (Google / Apple / short share link / "lat, lng"), with a preview. */
export function MapLinkField({ value, onChange }: { value: LatLng | null; onChange: (v: LatLng | null) => void }) {
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [lat, setLat] = useState(value ? String(value.lat) : '');
  const [lng, setLng] = useState(value ? String(value.lng) : '');

  const locate = async () => {
    setError(null);
    const direct = parseMapLink(link);
    if (direct) { onChange(direct); return; }
    if (!/^https?:\/\//i.test(link.trim())) { setError('الصق رابط الموقع من خرائط Google (مشاركة ← نسخ الرابط).'); return; }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('map-link', { body: { url: link.trim() } });
    setBusy(false);
    const p = data as LatLng | null;
    if (error || !p || typeof p.lat !== 'number') {
      setError(isShortMapLink(link) ? 'ما قدرنا نقرأ هذا الرابط. افتح الموقع بالمتصفح وانسخ الرابط الطويل، أو أدخل الإحداثيات يدوياً.'
        : 'الرابط ما بيه موقع واضح. تأكد إنه رابط دبوس (موقع) من خرائط Google.');
      return;
    }
    onChange(p);
  };

  return (
    <div className="stack-sm">
      {!value && (
        <>
          <div className="row" style={{ alignItems: 'flex-end', gap: 'var(--s-2)' }}>
            <div className="grow"><TextField label="رابط الموقع على الخريطة" optional ltr placeholder="https://maps.app.goo.gl/…"
                                             hint="من خرائط Google: افتح موقع العيادة ← مشاركة ← نسخ الرابط، والصقه هنا"
                                             value={link} onChange={(e) => { setLink(e.target.value); setError(null); }} /></div>
            <Button type="button" variant="secondary" icon={<Crosshair size={16} />} loading={busy} disabled={!link.trim()} onClick={() => void locate()}>تحديد</Button>
          </div>
          {error && <Alert tone="warning">{error}</Alert>}
          {!manual && <button type="button" className="auth-more" onClick={() => setManual(true)}>إدخال الإحداثيات يدوياً</button>}
          {manual && (
            <div className="row" style={{ alignItems: 'flex-end', gap: 'var(--s-2)' }}>
              <div className="grow"><TextField label="خط العرض" ltr inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} /></div>
              <div className="grow"><TextField label="خط الطول" ltr inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} /></div>
              <Button type="button" variant="secondary" onClick={() => { const p = parseMapLink(`${lat},${lng}`); if (p) onChange(p); else setError('إحداثيات غير صحيحة.'); }}>اعتماد</Button>
            </div>
          )}
        </>
      )}
      {value && (
        <div className="map-preview stack-sm">
          <iframe title="موقع العيادة على الخريطة" src={mapEmbedUrl(value)} loading="lazy" />
          <div className="row-between">
            <span className="small row" style={{ gap: 6 }}><MapPin size={14} aria-hidden /><Ltr>{value.lat}, {value.lng}</Ltr></span>
            <Button type="button" variant="ghost" size="sm" onClick={() => { onChange(null); setLink(''); }}>تغيير الموقع</Button>
          </div>
        </div>
      )}
    </div>
  );
}
