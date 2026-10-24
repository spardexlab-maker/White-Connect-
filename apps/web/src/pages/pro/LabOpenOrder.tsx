import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Camera, CheckCircle2, QrCode, Search } from 'lucide-react';
import { errorMessage, formatDate, formatMoney } from '@app/shared';
import { supabase } from '../../lib/supabase';
import { useWorkspace } from '../../lib/workspace';
import { Alert, Badge, Button, Ltr, PageHead, TextField, useToast } from '../../components/ui';
import type { OpenOrder } from '../../components/clinical/OpenLabOrder';

type Lookup = OpenOrder & { matches: Record<string, { test_id: string; name: string; price_minor: number | null } | null>;
  lab_tests: { id: string; name: string; price_minor: number | null }[]; birth_date: string | null; sex: string | null };

/** «طلب برمز»: the patient shows the doctor's code (or QR); the lab takes the tests it does and the rest stays open. */
export function LabOpenOrder() {
  const { current } = useWorkspace();
  const labId = current!.facility_id!;
  const toast = useToast();
  const [params] = useSearchParams();
  const [code, setCode] = useState(params.get('code') ?? '');
  const [o, setO] = useState<Lookup | null>(null);
  const [pick, setPick] = useState<Record<string, string>>({});   // item id → this lab's test id ('' = not done here)
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ order_number: string; left_open: number } | null>(null);
  const [scan, setScan] = useState(false);

  const lookup = async (c = code) => {
    setBusy(true); setDone(null);
    const { data, error } = await supabase.rpc('lab_lookup_open_order', { p_lab_facility_id: labId, p_code: c });
    setBusy(false);
    if (error) { setO(null); toast(errorMessage(error), 'danger'); return; }
    const d = data as unknown as Lookup;
    setO(d); setCode(d.code);
    setPick(Object.fromEntries(d.items.filter((i) => i.status === 'open').map((i) => [i.id, d.matches[i.id]?.test_id ?? ''])));
  };
  useEffect(() => { if (params.get('code')) void lookup(params.get('code')!); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const claim = async () => {
    const chosen = Object.entries(pick).filter(([, t]) => t).map(([item_id, test_id]) => ({ item_id, test_id }));
    setBusy(true);
    const { data, error } = await supabase.rpc('lab_claim_open_order', { p_lab_facility_id: labId, p_code: code, p_pick: chosen });
    setBusy(false);
    if (error) { toast(errorMessage(error), 'danger'); return; }
    setDone(data as { order_number: string; left_open: number }); setO(null);
  };
  const total = o ? Object.values(pick).filter(Boolean).reduce((s, t) => s + (o.lab_tests.find((x) => x.id === t)?.price_minor ?? 0), 0) : 0;

  return (
    <div className="stack">
      <PageHead title="استلام طلب تحاليل برمز" subtitle="المريض يعرض رمز طلب طبيبه في هاتفه أو على الورقة — أدخل الرمز أو امسح الـ QR." />
      <div className="card stack-sm">
        <div className="row" style={{ gap: 'var(--s-2)', alignItems: 'flex-end' }}>
          <div className="grow"><TextField label="رمز الطلب" ltr placeholder="ABCD-1234" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
                                         onKeyDown={(e) => { if (e.key === 'Enter' && code.trim()) void lookup(); }} /></div>
          <Button icon={<Search size={16} />} loading={busy && !o} disabled={code.trim().length < 4} onClick={() => void lookup()}>عرض الطلب</Button>
          {'BarcodeDetector' in window && <Button variant="secondary" icon={<Camera size={16} />} onClick={() => setScan(!scan)}>{scan ? 'إيقاف الكاميرا' : 'مسح QR'}</Button>}
        </div>
        {scan && <QrScanner onCode={(c) => { setScan(false); setCode(c); void lookup(c); }} />}
      </div>

      {done && (
        <Alert tone="success" title={`أُضيف الطلب — رقم ${done.order_number}`}
               action={<Link className="btn btn-secondary btn-sm" to="/workspace/lab">افتحه في «طلبات المختبر»</Link>}>
          {done.left_open ? `بقي ${done.left_open} تحليل مفتوح بنفس الرمز ليجريه المريض في مختبر آخر.` : 'أُخذت كل تحاليل الطلب.'}
        </Alert>
      )}

      {o && (
        <section className="card stack">
          <div className="row-between">
            <div className="stack-sm" style={{ gap: 2 }}>
              <strong style={{ fontSize: 'var(--f-h3)' }}>{o.patient_name} <span className="small muted"><Ltr>{o.public_code}</Ltr></span></strong>
              <span className="small">الطبيب: {o.doctor} — {o.clinic}</span>
              <span className="small muted">رمز <Ltr>{o.code}</Ltr> · صالح حتى {formatDate(o.expires_at)}</span>
            </div>
            <QrCode aria-hidden />
          </div>
          {o.note && <Alert tone="info">ملاحظة الطبيب: {o.note}</Alert>}
          <table className="table">
            <thead><tr><th>التحليل المطلوب</th><th>يقابله عندكم</th><th>السعر</th></tr></thead>
            <tbody>
              {o.items.map((i) => (
                <tr key={i.id}>
                  <td>{i.name}{i.code ? <span className="small muted"> · <Ltr>{i.code}</Ltr></span> : null}</td>
                  <td>
                    {i.status === 'open' ? (
                      <select className="select" aria-label={`يقابل ${i.name}`} value={pick[i.id] ?? ''} onChange={(e) => setPick({ ...pick, [i.id]: e.target.value })}>
                        <option value="">— لا نجريه —</option>
                        {o.lab_tests.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    ) : <Badge tone="neutral">{i.status === 'at_lab' ? `أُجري في ${i.lab}` : 'أدخله المريض'}</Badge>}
                  </td>
                  <td className="small">{pick[i.id] ? formatMoney(o.lab_tests.find((t) => t.id === pick[i.id])?.price_minor ?? null) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="row-between">
            <span>المجموع: <strong>{formatMoney(total)}</strong></span>
            <Button icon={<CheckCircle2 size={18} />} loading={busy} disabled={!Object.values(pick).some(Boolean)} onClick={() => void claim()}>
              استلام {Object.values(pick).filter(Boolean).length} تحليل
            </Button>
          </div>
          <span className="small muted">التحاليل التي لا تجرونها تبقى مفتوحة للمريض في مختبر آخر. النتيجة تصل للمريض والطبيب الطالب كالمعتاد.</span>
        </section>
      )}
    </div>
  );
}

/** Camera QR reading with the browser's own detector (Chrome / Edge / Android). */
function QrScanner({ onCode }: { onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const found = useRef(onCode);
  found.current = onCode;
  useEffect(() => {
    let stream: MediaStream | null = null, stop = false, timer = 0;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (!video.current) return;
        video.current.srcObject = stream; await video.current.play();
        const Detector = (window as unknown as { BarcodeDetector: new (o: { formats: string[] }) => { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
        const det = new Detector({ formats: ['qr_code'] });
        const tick = async () => {
          if (stop || !video.current) return;
          const hits = await det.detect(video.current).catch(() => []);
          const raw = hits[0]?.rawValue;
          if (raw) { found.current((raw.match(/code=([A-Za-z0-9-]+)/)?.[1] ?? raw).toUpperCase()); return; }
          timer = window.setTimeout(() => void tick(), 300);
        };
        void tick();
      } catch { setErr('تعذّر فتح الكاميرا — اكتب الرمز يدوياً.'); }
    })();
    return () => { stop = true; window.clearTimeout(timer); stream?.getTracks().forEach((t) => t.stop()); };
  }, []);
  return err ? <Alert tone="warning">{err}</Alert> : <video ref={video} muted playsInline style={{ width: '100%', maxWidth: 360, borderRadius: 12 }} />;
}
