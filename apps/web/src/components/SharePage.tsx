import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Download, ExternalLink, Share2 } from 'lucide-react';
import { doctorPath, type DirDoctor } from '@app/shared';
import { useAsync } from '../lib/useAsync';
import { loadDirectory } from '../pages/Directory';
import { Alert, Button, SkeletonList, useToast } from './ui';

const ORIGIN = 'https://white.spardexlab.site';

/** The doctor's public page: link to copy or send on WhatsApp, and a QR poster to print for the clinic. */
export function ShareMyPage({ practitionerId }: { practitionerId: string }) {
  const toast = useToast();
  const dir = useAsync(loadDirectory, []);
  const doc = dir.data?.doctors.find((d) => d.practitioner_id === practitionerId);
  const url = doc ? `${ORIGIN}${doctorPath(doc)}` : null;
  const qr = useRef<HTMLCanvasElement>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (url && qr.current) void QRCode.toCanvas(qr.current, url, { width: 280, margin: 1, color: { dark: '#123B5D' } }); }, [url]);

  if (dir.status === 'loading' && !dir.data) return <section className="card"><SkeletonList rows={2} /></section>;
  if (!doc || !url) {
    return (
      <section className="card stack-sm">
        <h2 className="section-title"><Share2 size={18} aria-hidden /> صفحتي العامة</h2>
        <Alert tone="info">صفحتك العامة تطلع بعد ما تتفعّل عيادتك وتصير ظاهرة للمرضى. إذا عيادتك فعّالة وما طلعت، ارجع بعد ربع ساعة.</Alert>
      </section>
    );
  }
  const copy = async () => { await navigator.clipboard.writeText(url); toast('انتسخ الرابط', 'success'); };
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`احجز موعدك عندي على أبيض:\n${url}`)}`;
  const poster = async () => { setBusy(true); try { await downloadPoster(doc, url); } finally { setBusy(false); } };

  return (
    <section className="card stack share-card" aria-labelledby="share-title">
      <h2 id="share-title" className="section-title"><Share2 size={18} aria-hidden /> صفحتي العامة</h2>
      <p className="small muted">هاي صفحتك اللي يلكاها المرضى بـ Google. دزّها لمرضاك أو حطها بالانستغرام، واطبع الملصق وعلّقه بالعيادة حتى يمسحونه ويحجزون.</p>
      <div className="row" style={{ gap: 'var(--s-4)', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <canvas ref={qr} className="qr" aria-label="رمز QR لصفحتي" />
        <div className="stack-sm grow" style={{ minWidth: 240 }}>
          <a href={url} target="_blank" rel="noreferrer" dir="ltr" className="small" style={{ wordBreak: 'break-all' }}>{url}</a>
          <div className="row" style={{ gap: 'var(--s-2)', flexWrap: 'wrap' }}>
            <Button size="sm" variant="secondary" icon={<Copy size={14} aria-hidden />} onClick={() => void copy()}>نسخ الرابط</Button>
            <a className="btn btn-secondary btn-sm" href={whatsapp} target="_blank" rel="noreferrer"><Share2 size={14} aria-hidden />إرسال بالواتساب</a>
            <a className="btn btn-ghost btn-sm" href={url} target="_blank" rel="noreferrer"><ExternalLink size={14} aria-hidden />فتح الصفحة</a>
          </div>
          <div><Button size="sm" icon={<Download size={14} aria-hidden />} loading={busy} onClick={() => void poster()}>تنزيل ملصق للطباعة</Button></div>
        </div>
      </div>
    </section>
  );
}

/** A4-proportioned PNG: brand, the doctor's name and specialty, a big QR and «امسح واحجز». */
async function downloadPoster(doc: DirDoctor, url: string) {
  const W = 1240, H = 1754;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  await document.fonts.ready;
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#123B5D'); bg.addColorStop(1, '#0B2A43');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.direction = 'rtl'; g.textAlign = 'center'; g.fillStyle = '#fff';
  const logo = await loadImg('/logo-full-light.png').catch(() => null);
  if (logo) { const lw = 300, lh = (logo.height / logo.width) * lw; g.drawImage(logo, (W - lw) / 2, 110, lw, lh); }
  g.font = '700 84px Alexandria, "IBM Plex Sans Arabic", sans-serif';
  g.fillText(doc.name, W / 2, 620);
  g.font = '500 48px "IBM Plex Sans Arabic", sans-serif'; g.fillStyle = '#CDEAE4';
  g.fillText([doc.specialty, doc.clinics[0]?.facility_name].filter(Boolean).join(' · '), W / 2, 700);
  const q = document.createElement('canvas');
  await QRCode.toCanvas(q, url, { width: 640, margin: 2, color: { dark: '#123B5D', light: '#ffffff' } });
  g.fillStyle = '#fff'; roundRect(g, (W - 700) / 2, 770, 700, 700, 40); g.fill();
  g.drawImage(q, (W - 640) / 2, 800, 640, 640);
  g.fillStyle = '#5EEAD4'; g.font = '700 72px Alexandria, "IBM Plex Sans Arabic", sans-serif';
  g.fillText('امسح الرمز واحجز موعدك', W / 2, 1580);
  g.fillStyle = '#CDEAE4'; g.font = '500 34px "IBM Plex Sans Arabic", sans-serif';
  g.fillText('بدون اتصال وبدون انتظار — على تطبيق أبيض', W / 2, 1650);
  const a = document.createElement('a');
  a.download = `abyad-${doc.slug}.png`; a.href = c.toDataURL('image/png'); a.click();
}
const loadImg = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
