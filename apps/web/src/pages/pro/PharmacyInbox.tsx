import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCheck, Inbox, Printer, RefreshCw, ShieldAlert } from 'lucide-react';
import { errorMessage, formatDateTime, rxDispatchStatus } from '@app/shared';
import { supabase } from '../../lib/supabase';
import { unwrap, useAsync } from '../../lib/useAsync';
import { useWorkspace } from '../../lib/workspace';
import { Alert, Badge, Button, EmptyState, ErrorState, Ltr, PageHead, Sheet, SkeletonList, useToast } from '../../components/ui';
import { RxDocument, type RxDoc } from '../../components/clinical/RxDocument';
import { DispensePanel } from './pharmacy/DispensePanel';

interface InboxRow {
  dispatch_id: string; prescription_id: string; rx_number: string; status: string; rx_status: 'active' | 'cancelled' | 'draft';
  version_no: number; sent_at: string; received_at: string | null; patient_name: string; patient_code: string;
  practitioner_name: string; facility_name: string; item_count: number; printed_count: number; revised: boolean;
}
type Detail = RxDoc & { dispatch_id: string; dispatch_status: string; rx_status: string; prescription_id: string; version_status: string;
  revision_reason: string | null; allergies: { substance: string; severity: string | null }[]; events: { event: string; at: string }[] };

const FILTERS: [string | null, string][] = [[null, 'الكل'], ['sent', 'جديدة'], ['received', 'مستلمة'], ['partially_dispensed', 'مصروفة جزئياً'], ['dispensed', 'مصروفة'], ['cancelled', 'ملغاة']];

/** Pharmacy inbox: only prescriptions explicitly sent to THIS pharmacy. */
export function PharmacyInbox() {
  const { current } = useWorkspace();
  const toast = useToast();
  const pharmacyId = current!.facility_id!;
  const [filter, setFilter] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const inbox = useAsync(async () => (await unwrap(supabase.rpc('pharmacy_inbox', { p_pharmacy_id: pharmacyId, p_status: filter ?? undefined }))) as InboxRow[], [pharmacyId, filter]);
  const reload = useCallback(() => inbox.reload(), [inbox.reload]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const ch = supabase.channel(`pharmacy:${pharmacyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prescription_dispatches', filter: `pharmacy_id=eq.${pharmacyId}` }, reload)
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [pharmacyId, reload]);

  return (
    <div className="stack">
      <PageHead title="وارد الوصفات" subtitle={current!.facility_name} actions={<Button variant="secondary" size="sm" icon={<RefreshCw size={16} />} onClick={reload}>تحديث</Button>} />
      <div className="chips" role="group" aria-label="تصفية الحالة">
        {FILTERS.map(([v, l]) => <button key={l} className="chip" aria-pressed={filter === v} onClick={() => setFilter(v)}>{l}</button>)}
      </div>
      <section className="card card-flush">
        {inbox.status === 'loading' && !inbox.data && <SkeletonList rows={4} />}
        {inbox.status === 'error' && <ErrorState error={inbox.error} onRetry={reload} />}
        {inbox.data?.length === 0 && <EmptyState icon={<Inbox />} title="لا توجد وصفات">تظهر هنا الوصفات التي أرسلها الأطباء صراحةً إلى هذه الصيدلية.</EmptyState>}
        {!!inbox.data?.length && (
          <div className="table-wrap" role="region" aria-label="الوصفات الواردة" tabIndex={0}>
            <table className="table">
              <thead><tr><th>الوصفة</th><th>المريض</th><th>الطبيب والجهة</th><th>الوقت</th><th>الحالة</th><th><span className="sr-only">فتح</span></th></tr></thead>
              <tbody>
                {inbox.data.map((r) => {
                  const st = r.rx_status === 'cancelled' ? rxDispatchStatus.cancelled : rxDispatchStatus[r.status] ?? { label: r.status, tone: 'neutral' as const };
                  return (
                    <tr key={r.dispatch_id}>
                      <td><Ltr>{r.rx_number}</Ltr><div className="small muted">{r.item_count} صنف · إصدار {r.version_no}</div></td>
                      <td>{r.patient_name}<div className="small muted"><Ltr>{r.patient_code}</Ltr></div></td>
                      <td className="small">{r.practitioner_name}<div className="muted">{r.facility_name}</div></td>
                      <td className="small">{formatDateTime(r.sent_at)}</td>
                      <td>
                        <div className="row" style={{ gap: 4 }}>
                          <Badge tone={st.tone}>{st.label}</Badge>
                          {r.revised && <Badge tone="warning">معدّلة</Badge>}
                          {r.printed_count > 0 && <Badge tone="neutral">طُبعت ×{r.printed_count}</Badge>}
                        </div>
                      </td>
                      <td><Button size="sm" variant="secondary" onClick={() => setOpenId(r.dispatch_id)}>فتح</Button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {openId && <PharmacyDetail dispatchId={openId} pharmacyId={pharmacyId} onClose={() => { setOpenId(null); reload(); }} onChanged={reload} toast={toast} />}
    </div>
  );
}

function PharmacyDetail({ dispatchId, pharmacyId, onClose, onChanged, toast }: { dispatchId: string; pharmacyId: string; onClose: () => void; onChanged: () => void; toast: ReturnType<typeof useToast> }) {
  const d = useAsync(async () => (await unwrap(supabase.rpc('pharmacy_prescription', { p_dispatch_id: dispatchId }))) as unknown as Detail, [dispatchId]);
  const receive = async () => {
    const { error } = await supabase.rpc('pharmacy_mark_received', { p_dispatch_id: dispatchId });
    if (error) toast(errorMessage(error), 'danger'); else { toast('سُجل الاستلام', 'success'); d.reload(); onChanged(); }
  };
  const cancelled = d.data?.rx_status === 'cancelled';
  return (
    <Sheet open size="lg" onClose={onClose} title={d.data ? `وصفة ${d.data.rx_number}` : 'وصفة'}
           footer={d.data && !cancelled ? <>
             {d.data.dispatch_status === 'sent' && <Button icon={<CheckCheck size={18} />} onClick={receive}>تسجيل الاستلام</Button>}
             <Link className="btn btn-secondary" to={`/print/rx/${d.data.prescription_id}?facility=${pharmacyId}`}><Printer size={18} aria-hidden />طباعة</Link>
           </> : undefined}>
      {d.status === 'loading' && <SkeletonList />}
      {d.status === 'error' && <ErrorState error={d.error} onRetry={d.reload} />}
      {d.data && (
        <div className="stack">
          {cancelled && <Alert tone="danger" title="وصفة ملغاة">لا يجوز صرفها.</Alert>}
          {d.data.version_no > 1 && <Alert tone="warning" title={`إصدار معدّل (${d.data.version_no})`}>{d.data.revision_reason ?? ''} — الإصدارات السابقة باطلة للصرف.</Alert>}
          <div className="allergy-strip">
            {d.data.allergies.length
              ? d.data.allergies.map((a) => <Badge key={a.substance} tone="danger" icon={<ShieldAlert aria-hidden />}>حساسية موثقة: <bdi dir="auto">{a.substance}</bdi></Badge>)
              : <Badge tone="neutral">لا توجد حساسية موثقة متاحة للصيدلية</Badge>}
          </div>
          {!cancelled && d.data.dispatch_status !== 'sent' && <DispensePanel dispatchId={d.data.dispatch_id} status={d.data.dispatch_status} prescriptionId={d.data.prescription_id} items={d.data.items} onChanged={() => { d.reload(); onChanged(); }} />}
          {d.data.dispatch_status === 'sent' && !cancelled && <Alert tone="info">سجّل الاستلام أولاً ثم ابدأ التحضير والصرف.</Alert>}
          <RxDocument doc={d.data} />
          <div className="stack-sm">
            <h3 className="section-title">سجل الأحداث</h3>
            {d.data.events.map((e, i) => <span key={i} className="small">{formatDateTime(e.at)} — {eventLabel[e.event] ?? e.event}</span>)}
          </div>
        </div>
      )}
    </Sheet>
  );
}
const eventLabel: Record<string, string> = { approved: 'اعتمدها الطبيب', revised: 'عدّلها الطبيب (إصدار جديد)', sent: 'أُرسلت لهذه الصيدلية', received: 'استُلمت', printed: 'طُبعت', preparing: 'قيد التحضير (حجز)', partially_dispensed: 'صرف جزئي', dispensed: 'صُرفت', not_available: 'غير متوفرة', cancelled: 'أُلغيت' };
