import { Link } from 'react-router-dom';
import { AlertOctagon, FlaskConical, Printer } from 'lucide-react';
import { formatDateTime, labFlag, labStatus, type LabStatus } from '@app/shared';
import { Badge, Ltr } from '../ui';
import { Attachments } from './Attachments';

export interface LabResult {
  id: string; version_no: number; status: 'draft' | 'released' | 'superseded'; value_text: string | null; value_numeric: number | null;
  unit: string | null; reference_range: string | null; lab_flag: string | null; notes: string | null; released_at: string | null;
  correction_reason: string | null; supersedes_id: string | null;
}
export interface LabDetail {
  order: { id: string; order_number: string; status: LabStatus; source: 'referral' | 'direct'; created_at: string; clinical_note: string | null; lab_facility_id: string };
  lab: string; patient: { full_name: string; public_code: string; sex: string | null; birth_year: number | null };
  ordering_doctor: string | null;
  specimens: { id: string; barcode: string; specimen_type: string; status: string; collected_at: string; rejection_reason: string | null }[] | null;
  items: { id: string; name: string; status: LabStatus; released_at: string | null; catalog: { unit: string | null; reference_range_text: string | null; specimen_type: string };
           results: LabResult[] }[];
}

/** Values, units, ranges and flags exactly as entered by the lab — no automatic interpretation. */
export function LabResultView({ d }: { d: LabDetail }) {
  const released = d.items.filter((i) => i.status === 'released').length;
  return (
    <div className="stack">
      <div className="row-between">
        <div>
          <h2 className="section-title"><FlaskConical size={18} aria-hidden style={{ verticalAlign: '-3px' }} /> {d.lab} — طلب <Ltr>{d.order.order_number}</Ltr></h2>
          <span className="small muted">{d.patient.full_name} · <Ltr>{d.patient.public_code}</Ltr>{d.ordering_doctor ? ` · الطبيب الطالب: ${d.ordering_doctor}` : ' · زيارة مباشرة للمختبر'}</span>
        </div>
        <div className="row" style={{ gap: 'var(--s-2)' }}>
          {released > 0 && <Link className="btn btn-secondary btn-sm" to={`/print/lab/${d.order.id}`}><Printer size={16} aria-hidden />تقرير PDF / طباعة</Link>}
          <Badge tone={labStatus[d.order.status].tone}>{labStatus[d.order.status].label}</Badge>
        </div>
      </div>
      {released < d.items.length && released > 0 && <p className="small" style={{ color: 'var(--c-warning)' }}>نتائج جزئية: {released} من {d.items.length} فحوصات معتمدة — البقية لم تجهز بعد.</p>}
      <div className="table-wrap" role="region" aria-label="النتائج" tabIndex={0}>
        <table className="table result-table">
          <thead><tr><th>الفحص</th><th>النتيجة</th><th>الوحدة</th><th>المجال المرجعي (من المختبر)</th><th>ملاحظة المختبر</th></tr></thead>
          <tbody>
            {d.items.map((i) => {
              const r = i.results.filter((x) => x.status !== 'superseded').at(-1);
              const corrected = i.results.some((x) => x.status === 'superseded');
              return (
                <tr key={i.id}>
                  <td><strong>{i.name}</strong><br /><Badge tone={labStatus[i.status].tone}>{labStatus[i.status].label}</Badge></td>
                  <td>
                    {r ? <>
                      <span className="num" style={{ fontWeight: 700 }}>{r.value_numeric ?? r.value_text}</span>
                      {r.lab_flag && <span className={r.lab_flag === 'critical' ? 'flag-critical' : ''}> {r.lab_flag === 'critical' && <AlertOctagon size={14} aria-hidden style={{ verticalAlign: '-2px' }} />} {labFlag[r.lab_flag]}</span>}
                      {r.status === 'draft' && <div><Badge tone="warning">مسودة — غير منشورة</Badge></div>}
                      {corrected && <div><Badge tone="info">مصححة</Badge> <span className="small muted">{r.correction_reason}</span></div>}
                    </> : <span className="muted small">لم تجهز</span>}
                  </td>
                  <td className="small">{r?.unit ?? i.catalog.unit ?? '—'}</td>
                  <td className="small">{r?.reference_range ?? i.catalog.reference_range_text ?? '—'}</td>
                  <td className="small">{r?.notes ?? '—'}{r?.released_at && <div className="muted">اعتُمدت {formatDateTime(r.released_at)}</div>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Attachments kind="lab_result" refId={d.order.id} />
      <p className="small muted">لا يقدم النظام تفسيراً أو تشخيصاً آلياً للنتائج؛ يناقشها الطبيب المعالج.</p>
    </div>
  );
}
