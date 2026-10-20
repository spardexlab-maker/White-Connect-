import { labFlag } from './domain';
import { formatDateTime } from './format';

export interface LabReport {
  order_number: string;
  created_at: string;
  lab: { name: string; branch: string | null; address: string | null; phone: string | null };
  patient: { full_name: string; public_code: string; sex: string | null; birth_year: number | null };
  ordering_doctor: string | null;
  specimen: { barcode: string; type: string; collected_at: string } | null;
  released_at: string | null;
  items: { name: string; value_numeric: number | null; value_text: string | null; unit: string | null; reference_range: string | null;
           flag: string | null; notes: string | null; corrected: boolean }[];
}

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/**
 * The lab report as print-ready HTML (A4), shared by the web print page and
 * the mobile PDF so both look the same. Values are shown exactly as the lab
 * released them — no interpretation.
 */
export function labReportHtml(r: LabReport): string {
  const age = r.patient.birth_year ? `${new Date().getFullYear() - r.patient.birth_year} سنة` : '—';
  const sex = r.patient.sex === 'female' ? 'أنثى' : r.patient.sex === 'male' ? 'ذكر' : '—';
  const rows = r.items.map((i) => `
    <tr>
      <td><b>${esc(i.name)}</b>${i.corrected ? '<div class="lr-muted">نتيجة مصححة</div>' : ''}</td>
      <td class="lr-val"><bdi dir="ltr">${esc(i.value_numeric ?? i.value_text)}</bdi>${i.flag ? ` <span class="lr-flag${i.flag === 'critical' ? ' lr-crit' : ''}">${esc(labFlag[i.flag] ?? i.flag)}</span>` : ''}</td>
      <td><bdi dir="ltr">${esc(i.unit ?? '—')}</bdi></td>
      <td><bdi dir="ltr">${esc(i.reference_range ?? '—')}</bdi></td>
      <td>${esc(i.notes ?? '')}</td>
    </tr>`).join('');
  return `
<div class="lab-report">
  <style>
    .lab-report{font-family:'IBM Plex Sans Arabic',Tahoma,sans-serif;color:#0E1E2E;direction:rtl;font-size:13px;line-height:1.55;max-width:780px;margin:0 auto;background:#fff;padding:28px}
    .lab-report .lr-head{display:flex;justify-content:space-between;gap:16px;border-bottom:3px solid #0F7A68;padding-bottom:12px}
    .lab-report h1{font-size:20px;margin:0} .lab-report .lr-muted{color:#5B6B78;font-size:11.5px}
    .lab-report .lr-title{text-align:left} .lab-report .lr-title b{font-size:16px;color:#0F7A68}
    .lab-report .lr-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px 16px;margin:14px 0;padding:10px 12px;background:#F4F7F8;border-radius:8px}
    .lab-report .lr-grid span{display:block;color:#5B6B78;font-size:11px}
    .lab-report table{width:100%;border-collapse:collapse;margin-top:8px}
    .lab-report th{background:#E3ECEF;text-align:right;padding:7px 8px;font-size:12px}
    .lab-report td{border-bottom:1px solid #D5DFE5;padding:8px;vertical-align:top}
    .lab-report .lr-val{font-weight:700;font-size:14px}
    .lab-report .lr-flag{font-size:11px;font-weight:600;color:#8A5300;background:#FFF1D6;border-radius:6px;padding:1px 6px}
    .lab-report .lr-crit{color:#9B1C1C;background:#FDE2E2}
    .lab-report .lr-foot{margin-top:22px;display:flex;justify-content:space-between;gap:16px;font-size:11.5px;color:#5B6B78}
    .lab-report .lr-sign{border-top:1px solid #8A99A6;padding-top:4px;min-width:200px;text-align:center}
  </style>
  <div class="lr-head">
    <div>
      <h1>${esc(r.lab.name)}</h1>
      <div class="lr-muted">${esc([r.lab.branch, r.lab.address].filter(Boolean).join(' — '))}</div>
      ${r.lab.phone ? `<div class="lr-muted">هاتف: <bdi dir="ltr">${esc(r.lab.phone)}</bdi></div>` : ''}
    </div>
    <div class="lr-title"><b>تقرير نتائج مختبرية</b><div class="lr-muted">رقم الطلب: <bdi dir="ltr">${esc(r.order_number)}</bdi></div></div>
  </div>
  <div class="lr-grid">
    <div><span>المريض</span><b>${esc(r.patient.full_name)}</b></div>
    <div><span>المعرّف</span><bdi dir="ltr">${esc(r.patient.public_code)}</bdi></div>
    <div><span>العمر · الجنس</span>${esc(age)} · ${esc(sex)}</div>
    <div><span>الطبيب الطالب</span>${esc(r.ordering_doctor ?? 'مراجعة مباشرة')}</div>
    <div><span>العينة</span>${r.specimen ? `${esc(r.specimen.type)} · <bdi dir="ltr">${esc(r.specimen.barcode)}</bdi>` : '—'}</div>
    <div><span>سحب العينة · صدور النتيجة</span>${r.specimen ? esc(formatDateTime(r.specimen.collected_at)) : '—'}<br>${r.released_at ? esc(formatDateTime(r.released_at)) : '—'}</div>
  </div>
  <table>
    <thead><tr><th>الفحص</th><th>النتيجة</th><th>الوحدة</th><th>المجال المرجعي</th><th>ملاحظة</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="lr-foot">
    <div>القيم والمجالات المرجعية كما أصدرها المختبر، والعلامات (مرتفع/منخفض) لا تُعد تشخيصاً. يُرجى مناقشة النتائج مع الطبيب.</div>
    <div class="lr-sign">توقيع وختم المختبر</div>
  </div>
</div>`;
}

/** A complete HTML document (for printing to PDF on the phone). */
export function labReportDocument(r: LabReport): string {
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>@page{size:A4;margin:12mm}body{margin:0}</style></head><body>${labReportHtml(r)}</body></html>`;
}
