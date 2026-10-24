import { FileText, Hourglass } from 'lucide-react';
import { formatDateTime, labState, labStateColor, labStateLabel, type LabReport } from '@app/shared';
import { supabase } from '../../lib/supabase';
import { unwrap, useAsync } from '../../lib/useAsync';
import { Badge, Ltr, SkeletonList } from '../ui';

interface Order { id: string; order_number: string; status: string; lab: string; items: { name: string; status: string }[] }

/** Results of the tests ordered in this session, as soon as the lab publishes them (high/low red, normal blue). */
export function EncounterLabResults({ orders }: { orders: Order[] }) {
  if (!orders.length) return null;
  return (
    <div className="stack">
      {orders.map((o) => <OrderResults key={o.id} order={o} />)}
    </div>
  );
}

function OrderResults({ order }: { order: Order }) {
  const released = order.items.some((i) => i.status === 'released');
  const report = useAsync(async () => (released ? ((await unwrap(supabase.rpc('lab_report', { p_order_id: order.id }))) as unknown as LabReport) : null), [order.id, released]);
  return (
    <section className="card stack-sm">
      <div className="row-between">
        <strong>طلب <Ltr>{order.order_number}</Ltr> — {order.lab}</strong>
        {released
          ? <a className="btn btn-secondary btn-sm" href={`/print/lab/${order.id}`} target="_blank" rel="noreferrer"><FileText size={16} aria-hidden />تقرير PDF</a>
          : <Badge tone="warning" icon={<Hourglass aria-hidden />}>بانتظار النتيجة</Badge>}
      </div>
      {!released && <p className="small muted">{order.items.map((i) => i.name).join('، ')}</p>}
      {released && report.status === 'loading' && !report.data && <SkeletonList rows={2} />}
      {report.data && (
        <>
          <table className="lab-table">
            <thead><tr><th>الفحص</th><th>النتيجة</th><th>المجال الطبيعي</th><th>الحالة</th></tr></thead>
            <tbody>
              {report.data.items.map((i, k) => {
                const st = labState(i);
                return (
                  <tr key={k}>
                    <td>{i.name}</td>
                    <td><bdi dir="ltr" style={{ fontWeight: 700, color: st ? labStateColor[st] : undefined }}>{i.value_numeric ?? i.value_text ?? '—'} {i.unit ?? ''}</bdi></td>
                    <td className="muted"><bdi dir="ltr">{i.reference_range ?? '—'}</bdi></td>
                    <td>{st ? <span className={`lab-pill lab-${st}`}>{labStateLabel[st]}</span> : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {report.data.released_at && <span className="small muted">صدرت {formatDateTime(report.data.released_at)}</span>}
        </>
      )}
    </section>
  );
}
