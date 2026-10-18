import { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { addDays, formatMoney, localDateKey } from '@app/shared';
import { supabase } from '../../../lib/supabase';
import { unwrap, useAsync } from '../../../lib/useAsync';
import { useWorkspace } from '../../../lib/workspace';
import { Alert, EmptyState, ErrorState, PageHead, SkeletonList, TextField } from '../../../components/ui';

interface Report {
  by_ingredient: { ingredient: string; unique_prescriptions: number; line_count: number; units_requested: number; units_dispensed: number }[];
  by_product: { name: string; sold_units: number; returned_units: number; sales_minor: number; refunds_minor: number }[];
  top_prescribers: { practitioner: string; prescriptions: number }[];
  totals: { sales_minor: number; sales_count: number }; refunds_minor: number;
}

/** Prescribed ≠ dispensed ≠ sold (§10): each figure is reported separately. */
export function PharmacyReports() {
  const { current } = useWorkspace();
  const pharmacyId = current!.facility_id!;
  const today = localDateKey(new Date());
  const [from, setFrom] = useState(addDays(today, -30));
  const [to, setTo] = useState(today);
  const r = useAsync(async () => (await unwrap(supabase.rpc('pharmacy_report', { p_pharmacy_id: pharmacyId, p_from: from, p_to: to }))) as unknown as Report, [pharmacyId, from, to]);
  return (
    <div className="stack">
      <PageHead title="التقارير" subtitle={current!.facility_name} />
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div style={{ width: 180 }}><TextField label="من" type="date" ltr value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div style={{ width: 180 }}><TextField label="إلى" type="date" ltr value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </div>
      {r.status === 'loading' && <SkeletonList />}
      {r.status === 'error' && <ErrorState error={r.error} onRetry={r.reload} />}
      {r.data && (
        <>
          <div className="kpi-strip">
            <div className="kpi"><BarChart3 size={22} aria-hidden /><div><div className="kpi-v num">{r.data.totals.sales_count}</div><div className="kpi-l">عمليات البيع</div></div></div>
            <div className="kpi"><div><div className="kpi-v">{formatMoney(r.data.totals.sales_minor)}</div><div className="kpi-l">المبيعات</div></div></div>
            <div className="kpi"><div><div className="kpi-v">{formatMoney(r.data.refunds_minor)}</div><div className="kpi-l">المرتجعات</div></div></div>
            <div className="kpi"><div><div className="kpi-v num">{r.data.by_ingredient.reduce((a, x) => a + Number(x.unique_prescriptions), 0)}</div><div className="kpi-l">وصفات مستلمة (فريدة لكل مادة)</div></div></div>
          </div>
          <section className="card card-flush">
            <div className="card-header"><h2>الوصف مقابل الصرف — حسب المادة الفعالة</h2></div>
            {r.data.by_ingredient.length === 0 ? <EmptyState icon={<BarChart3 />} title="لا توجد وصفات في الفترة" /> : (
              <div className="table-wrap" role="region" aria-label="حسب المادة" tabIndex={0}>
                <table className="table">
                  <thead><tr><th>المادة</th><th>وصفات معتمدة فريدة</th><th>مرات الإدراج</th><th>الوحدات المطلوبة</th><th>الوحدات المصروفة فعلياً</th></tr></thead>
                  <tbody>{r.data.by_ingredient.map((x) => <tr key={x.ingredient}><td><bdi dir="ltr">{x.ingredient}</bdi></td><td className="num">{x.unique_prescriptions}</td><td className="num">{x.line_count}</td><td className="num">{x.units_requested}</td><td className="num">{x.units_dispensed}</td></tr>)}</tbody>
                </table>
              </div>
            )}
          </section>
          <section className="card card-flush">
            <div className="card-header"><h2>المبيعات حسب المنتج</h2></div>
            <div className="table-wrap" role="region" aria-label="حسب المنتج" tabIndex={0}>
              <table className="table">
                <thead><tr><th>المنتج</th><th>المباع</th><th>المرتجع</th><th>المبيعات</th><th>المسترد</th></tr></thead>
                <tbody>{r.data.by_product.map((x) => <tr key={x.name}><td>{x.name}</td><td className="num">{x.sold_units}</td><td className="num">{x.returned_units}</td><td>{formatMoney(x.sales_minor)}</td><td>{formatMoney(x.refunds_minor)}</td></tr>)}</tbody>
              </table>
            </div>
          </section>
          <section className="card stack-sm">
            <h2 className="section-title">الأطباء الأكثر إرسالاً لهذه الصيدلية</h2>
            {r.data.top_prescribers.map((p) => <span key={p.practitioner} className="small">{p.practitioner}: {p.prescriptions}</span>)}
            <Alert tone="info">يعتمد فقط على الوصفات المرسلة لهذه الصيدلية، ولا يُستنتج منه أي تقييم لجودة الطبيب.</Alert>
          </section>
        </>
      )}
    </div>
  );
}
