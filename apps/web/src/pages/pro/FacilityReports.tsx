import { useState } from 'react';
import { BarChart3, Plus } from 'lucide-react';
import { addDays, appointmentStatus, errorMessage, formatMoney, localDateKey, type AppointmentStatus } from '@app/shared';
import { supabase } from '../../lib/supabase';
import { unwrap, useAsync } from '../../lib/useAsync';
import { useWorkspace } from '../../lib/workspace';
import { Alert, Button, ErrorState, PageHead, SkeletonList, TextField, useToast } from '../../components/ui';

interface Rep { appointments_by_status: Record<string, number>; by_practitioner: { practitioner: string; total: number; fulfilled: number; cancelled: number; no_show: number; from_reception: number; from_app: number }[];
  walk_ins: number; invoiced_minor: number; collected_minor: number; refunded_minor: number; by_method: Record<string, number>; expenses_minor: number;
  expenses_by_category: Record<string, number>; open_invoices: number }

/** Facility operational report: attendance, cancellations, revenue, expenses — no medical data. */
export function FacilityReports() {
  const { current, workspaces } = useWorkspace();
  const toast = useToast();
  const facilities = workspaces.filter((w) => w.facility_id && w.role === 'facility_admin');
  const [facilityId, setFacilityId] = useState(current?.facility_id ?? facilities[0]?.facility_id ?? '');
  const today = localDateKey(new Date());
  const [from, setFrom] = useState(addDays(today, -30));
  const [to, setTo] = useState(today);
  const [exp, setExp] = useState({ category: '', amount: '', note: '' });
  const r = useAsync(async () => (facilityId ? ((await unwrap(supabase.rpc('facility_report', { p_facility_id: facilityId, p_from: from, p_to: to }))) as unknown as Rep) : null), [facilityId, from, to]);
  const org = useAsync(async () => (current?.role === 'organization_admin'
    ? ((await unwrap(supabase.rpc('organization_report', { p_organization_id: current.organization_id, p_from: from, p_to: to }))) as unknown as { facility: string; type: string; appointments: number; lab_orders: number; prescriptions_received: number; collected_minor: number }[])
    : null), [current?.organization_id, current?.role, from, to]);
  const addExpense = async () => {
    const { error } = await supabase.rpc('add_expense', { p_facility_id: facilityId, p_category: exp.category, p_amount_minor: Number(exp.amount), p_note: exp.note || undefined });
    if (error) toast(errorMessage(error), 'danger'); else { toast('سُجل المصروف', 'success'); setExp({ category: '', amount: '', note: '' }); r.reload(); }
  };
  return (
    <div className="stack">
      <PageHead title="التقارير والمالية التشغيلية" subtitle="أرقام تشغيلية فقط — بلا تفاصيل طبية"
                actions={facilities.length > 1 ? <select className="select" style={{ width: 'auto' }} aria-label="المنشأة" value={facilityId} onChange={(e) => setFacilityId(e.target.value)}>
                  {facilities.map((f) => <option key={f.membership_id} value={f.facility_id!}>{f.facility_name}</option>)}</select> : undefined} />
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div style={{ width: 180 }}><TextField label="من" type="date" ltr value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div style={{ width: 180 }}><TextField label="إلى" type="date" ltr value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </div>
      {org.data && (
        <section className="card card-flush"><div className="card-header"><h2>المجمع — حسب الجهة</h2></div>
          <div className="table-wrap" role="region" aria-label="حسب الجهة" tabIndex={0}><table className="table">
            <thead><tr><th>الجهة</th><th>مواعيد</th><th>طلبات مختبر</th><th>وصفات مستلمة</th><th>المحصّل</th></tr></thead>
            <tbody>{org.data.map((x) => <tr key={x.facility}><td>{x.facility}</td><td className="num">{x.appointments}</td><td className="num">{x.lab_orders}</td><td className="num">{x.prescriptions_received}</td><td>{formatMoney(x.collected_minor)}</td></tr>)}</tbody>
          </table></div></section>
      )}
      {!facilityId && !org.data && <Alert tone="info">لا توجد منشأة تديرها.</Alert>}
      {r.status === 'loading' && facilityId && <SkeletonList />}
      {r.status === 'error' && <ErrorState error={r.error} onRetry={r.reload} />}
      {r.data && (
        <>
          <div className="kpi-strip">
            <div className="kpi"><BarChart3 size={22} aria-hidden /><div><div className="kpi-v">{formatMoney(r.data.collected_minor)}</div><div className="kpi-l">المحصّل</div></div></div>
            <div className="kpi"><div><div className="kpi-v">{formatMoney(r.data.refunded_minor)}</div><div className="kpi-l">المسترد</div></div></div>
            <div className="kpi"><div><div className="kpi-v">{formatMoney(r.data.expenses_minor)}</div><div className="kpi-l">المصاريف</div></div></div>
            <div className="kpi"><div><div className="kpi-v num">{r.data.open_invoices}</div><div className="kpi-l">فواتير مستحقة</div></div></div>
          </div>
          <section className="card stack-sm"><h2 className="section-title">المواعيد حسب الحالة</h2>
            <div className="row">{Object.entries(r.data.appointments_by_status).map(([k, v]) => <span key={k} className="small">{appointmentStatus[k as AppointmentStatus]?.label ?? k}: <strong className="num">{v}</strong></span>)}
              <span className="small">مرضى عابرون: <strong className="num">{r.data.walk_ins}</strong></span></div></section>
          <section className="card card-flush"><div className="card-header"><h2>حسب الطبيب</h2></div>
            <div className="table-wrap" role="region" aria-label="حسب الطبيب" tabIndex={0}><table className="table">
              <thead><tr><th>الطبيب</th><th>الكل</th><th>تمت</th><th>ألغيت</th><th>لم يحضر</th><th>استقبال</th><th>تطبيق</th></tr></thead>
              <tbody>{r.data.by_practitioner.map((x) => <tr key={x.practitioner}><td>{x.practitioner}</td><td className="num">{x.total}</td><td className="num">{x.fulfilled}</td><td className="num">{x.cancelled}</td><td className="num">{x.no_show}</td><td className="num">{x.from_reception}</td><td className="num">{x.from_app}</td></tr>)}</tbody>
            </table></div></section>
          <section className="card stack">
            <h2 className="section-title">المصاريف</h2>
            {Object.entries(r.data.expenses_by_category).map(([k, v]) => <span key={k} className="small">{k}: {formatMoney(v)}</span>)}
            <div className="row" style={{ alignItems: 'flex-end' }}>
              <div className="grow"><TextField label="الفئة" value={exp.category} onChange={(e) => setExp({ ...exp, category: e.target.value })} placeholder="إيجار، رواتب، مستلزمات…" /></div>
              <div style={{ width: 140 }}><TextField label="المبلغ (د.ع)" inputMode="numeric" ltr value={exp.amount} onChange={(e) => setExp({ ...exp, amount: e.target.value.replace(/\D/g, '') })} /></div>
              <Button icon={<Plus size={16} />} disabled={!exp.category || !Number(exp.amount)} onClick={addExpense}>إضافة</Button>
            </div>
          </section>
          <p className="small muted">مالية تشغيلية وليست نظاماً محاسبياً قانونياً كاملاً.</p>
        </>
      )}
    </div>
  );
}
