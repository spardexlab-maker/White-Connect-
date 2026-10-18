import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { formatDateTime } from '@app/shared';
import { productName } from '../../lib/supabase';

export interface RxItem {
  line_no: number; display_name: string; dose: number | null; dose_unit: string | null; route: string | null;
  frequency_text: string | null; interval_hours: number | null; duration_days: number | null; start_date: string | null;
  quantity: number | null; quantity_unit: string | null; instructions: string | null; as_needed: boolean; max_daily: string | null;
}
export interface RxDoc {
  rx_number: string; version_no: number; approved_at?: string;
  practitioner: { full_name: string; title: string | null; license_number: string | null };
  facility: { name: string; branch: string; address: string | null; phone: string | null };
  patient: { full_name: string; public_code: string; sex: 'male' | 'female' | null; birth_year: number | null };
  items: RxItem[];
  status?: string; version_status?: string; verify_token?: string | null;
}

/** Written exactly as the doctor entered it — nothing is computed or interpreted. */
export function itemLine(i: RxItem): string {
  return [
    i.dose != null ? `${Number(i.dose)} ${i.dose_unit ?? ''}`.trim() : null,
    i.route, i.frequency_text,
    i.interval_hours ? `كل ${i.interval_hours} ساعة` : null,
    i.duration_days ? `لمدة ${i.duration_days} يوم` : null,
    i.as_needed ? 'عند اللزوم' : null,
    i.max_daily ? `الحد الأقصى: ${i.max_daily}` : null,
  ].filter(Boolean).join(' · ');
}

export function RxDocument({ doc, draft, size = 'A5' }: { doc: RxDoc; draft?: boolean; size?: 'A4' | 'A5' }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const verifyUrl = doc.verify_token ? `${window.location.origin}/verify/rx?token=${doc.verify_token}` : null;
  useEffect(() => {
    if (verifyUrl && canvas.current) void QRCode.toCanvas(canvas.current, verifyUrl, { width: 96, margin: 1 });
  }, [verifyUrl]);
  const age = doc.patient.birth_year ? new Date().getFullYear() - doc.patient.birth_year : null;
  return (
    <article className={`rx-doc rx-${size.toLowerCase()}`} aria-label={`وصفة ${doc.rx_number}`}>
      {draft && <div className="rx-watermark" aria-hidden>مسودة — غير صالحة للصرف</div>}
      <header className="rx-head">
        <div>
          <strong className="rx-facility">{doc.facility.name}</strong>
          <div className="small">{doc.facility.branch}{doc.facility.address ? ` — ${doc.facility.address}` : ''}</div>
          {doc.facility.phone && <div className="small"><bdi dir="ltr">{doc.facility.phone}</bdi></div>}
        </div>
        <div style={{ textAlign: 'end' }}>
          <strong>{doc.practitioner.full_name}</strong>
          <div className="small">{doc.practitioner.title}</div>
          {doc.practitioner.license_number && <div className="small">رقم الترخيص: <bdi dir="ltr">{doc.practitioner.license_number}</bdi></div>}
        </div>
      </header>
      <section className="rx-meta">
        <div><span className="label-text">المريض</span><strong>{doc.patient.full_name}</strong></div>
        <div><span className="label-text">المعرّف</span><bdi dir="ltr">{doc.patient.public_code}</bdi></div>
        {age != null && <div><span className="label-text">العمر</span>{age} سنة</div>}
        <div><span className="label-text">رقم الوصفة</span><bdi dir="ltr">{doc.rx_number}</bdi> · إصدار {doc.version_no}</div>
        <div><span className="label-text">التاريخ</span>{doc.approved_at ? formatDateTime(doc.approved_at) : '—'}</div>
      </section>
      <ol className="rx-items">
        {doc.items.map((i) => (
          <li key={i.line_no}>
            <div className="rx-drug"><bdi dir="ltr">{i.display_name}</bdi></div>
            <div className="rx-sig">{itemLine(i)}</div>
            <div className="small">
              {i.quantity != null && <>الكمية: {Number(i.quantity)} {i.quantity_unit ?? ''}</>}
              {i.start_date && <> · يبدأ {i.start_date}</>}
            </div>
            {i.instructions && <div className="small">تعليمات: {i.instructions}</div>}
          </li>
        ))}
      </ol>
      <footer className="rx-foot">
        <div className="small">
          {verifyUrl ? 'امسح الرمز للتحقق من صلاحية هذه النسخة.' : 'تظهر رمز التحقق بعد الاعتماد.'}<br />
          التوقيع/الختم: ____________ <span className="muted">(الختم لا يعني اعتماداً قانونياً تلقائياً)</span>
        </div>
        {verifyUrl && <canvas ref={canvas} aria-label="رمز التحقق من الوصفة" />}
      </footer>
      <div className="rx-brand small muted">{productName}</div>
    </article>
  );
}
