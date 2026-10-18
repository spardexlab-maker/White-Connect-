import { useState } from 'react';
import { Building2, Plus } from 'lucide-react';
import { errorMessage, facilityTypeLabel, reasonSchema, type FacilityType } from '@app/shared';
import { supabase } from '../../lib/supabase';
import { unwrap, useAsync } from '../../lib/useAsync';
import { Badge, Button, ConfirmDialog, EmptyState, ErrorState, PageHead, SelectField, SkeletonList, TextField, TextareaField, useToast } from '../../components/ui';

type Status = 'pending' | 'active' | 'suspended' | 'closed';
const statusLabel: Record<Status, { label: string; tone: 'warning' | 'success' | 'danger' | 'neutral' }> = {
  pending: { label: 'بانتظار التحقق', tone: 'warning' }, active: { label: 'فعّال', tone: 'success' },
  suspended: { label: 'معلّق', tone: 'danger' }, closed: { label: 'مغلق', tone: 'neutral' },
};

export function AdminOrganizations() {
  const toast = useToast();
  const data = useAsync(async () => {
    const [orgs, branches, facs, cities] = await Promise.all([
      unwrap(supabase.from('organizations').select('id, name, status, kind').order('name')),
      unwrap(supabase.from('branches').select('id, organization_id, name, area')),
      unwrap(supabase.from('facilities').select('id, organization_id, branch_id, name, type, status').order('name')),
      unwrap(supabase.from('cities').select('id, name_ar')),
    ]);
    return { orgs: orgs ?? [], branches: branches ?? [], facs: facs ?? [], cities: cities ?? [] };
  }, []);
  const [orgName, setOrgName] = useState('');
  const [branch, setBranch] = useState({ org: '', name: '', city: '', area: '', lat: '', lng: '' });
  const [fac, setFac] = useState({ org: '', branch: '', type: 'clinic' as FacilityType, name: '' });
  const [statusChange, setStatusChange] = useState<{ entity: 'organization' | 'facility'; id: string; name: string; to: Status } | null>(null);
  const [reason, setReason] = useState('');
  const [reasonErr, setReasonErr] = useState<string>();

  const run = async (p: PromiseLike<{ error: unknown }>, ok: string) => {
    const { error } = await p;
    if (error) { toast(errorMessage(error), 'danger'); return false; }
    toast(ok, 'success'); data.reload(); return true;
  };

  const applyStatus = async () => {
    const parsed = reasonSchema.safeParse(reason);
    if (!parsed.success) { setReasonErr(parsed.error.issues[0].message); return; }
    if (await run(supabase.rpc('admin_set_entity_status', { p_entity: statusChange!.entity, p_id: statusChange!.id, p_status: statusChange!.to, p_reason: reason }), 'تم تحديث الحالة وتسجيلها في التدقيق')) {
      setStatusChange(null); setReason('');
    }
  };

  return (
    <div className="stack">
      <PageHead title="المجمعات والجهات" />
      {data.status === 'loading' && <SkeletonList />}
      {data.status === 'error' && <ErrorState error={data.error} onRetry={data.reload} />}
      {data.data && (
        <div className="two-col">
          <section className="card card-flush">
            <div className="card-header"><h2>الهيكل</h2></div>
            {data.data.orgs.length === 0 && <EmptyState icon={<Building2 />} title="لا توجد مجمعات بعد" />}
            {data.data.orgs.map((o) => (
              <div key={o.id} style={{ borderBlockEnd: '1px solid var(--c-border)' }}>
                <div className="list-item" style={{ borderBlockEnd: 0 }}>
                  <Building2 size={18} aria-hidden />
                  <strong className="grow">{o.name}</strong>
                  <Badge tone={statusLabel[o.status as Status].tone}>{statusLabel[o.status as Status].label}</Badge>
                  <StatusMenu current={o.status as Status} onPick={(to) => setStatusChange({ entity: 'organization', id: o.id, name: o.name, to })} />
                </div>
                {data.data!.facs.filter((f) => f.organization_id === o.id).map((f) => (
                  <div key={f.id} className="list-item" style={{ paddingInlineStart: 'var(--s-10)', borderBlockEnd: 0 }}>
                    <span className="grow small">{f.name} <span className="muted">· {facilityTypeLabel[f.type as FacilityType]} · {data.data!.branches.find((b) => b.id === f.branch_id)?.name}</span></span>
                    <Badge tone={statusLabel[f.status as Status].tone}>{statusLabel[f.status as Status].label}</Badge>
                    <StatusMenu current={f.status as Status} onPick={(to) => setStatusChange({ entity: 'facility', id: f.id, name: f.name, to })} />
                  </div>
                ))}
              </div>
            ))}
          </section>
          <div className="stack">
            <section className="card stack">
              <h2 className="section-title">مجمع / جهة مستقلة جديدة</h2>
              <TextField label="الاسم" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
              <Button icon={<Plus size={16} />} disabled={!orgName.trim()} onClick={async () => { if (await run(supabase.rpc('admin_create_organization', { p_name: orgName }), 'تم إنشاء المجمع (بانتظار التحقق)')) setOrgName(''); }}>إنشاء</Button>
            </section>
            <section className="card stack">
              <h2 className="section-title">فرع جديد</h2>
              <SelectField label="المجمع" value={branch.org} onChange={(e) => setBranch({ ...branch, org: e.target.value })}>
                <option value="">اختر</option>{data.data.orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </SelectField>
              <TextField label="اسم الفرع" value={branch.name} onChange={(e) => setBranch({ ...branch, name: e.target.value })} />
              <SelectField label="المدينة" value={branch.city} onChange={(e) => setBranch({ ...branch, city: e.target.value })}>
                <option value="">—</option>{data.data.cities.map((c) => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
              </SelectField>
              <TextField label="المنطقة" optional value={branch.area} onChange={(e) => setBranch({ ...branch, area: e.target.value })} />
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <div className="grow"><TextField label="خط العرض" optional ltr inputMode="decimal" value={branch.lat} onChange={(e) => setBranch({ ...branch, lat: e.target.value })} /></div>
                <div className="grow"><TextField label="خط الطول" optional ltr inputMode="decimal" value={branch.lng} onChange={(e) => setBranch({ ...branch, lng: e.target.value })} /></div>
              </div>
              <Button icon={<Plus size={16} />} disabled={!branch.org || !branch.name} onClick={async () => {
                if (await run(supabase.rpc('admin_create_branch', { p_organization_id: branch.org, p_name: branch.name, p_city_id: branch.city || undefined, p_area: branch.area || undefined,
                  p_latitude: branch.lat ? Number(branch.lat) : undefined, p_longitude: branch.lng ? Number(branch.lng) : undefined }), 'تم إنشاء الفرع')) setBranch({ org: '', name: '', city: '', area: '', lat: '', lng: '' });
              }}>إنشاء الفرع</Button>
            </section>
            <section className="card stack">
              <h2 className="section-title">جهة جديدة (عيادة / صيدلية / مختبر)</h2>
              <SelectField label="المجمع" value={fac.org} onChange={(e) => setFac({ ...fac, org: e.target.value, branch: '' })}>
                <option value="">اختر</option>{data.data.orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </SelectField>
              <SelectField label="الفرع" value={fac.branch} onChange={(e) => setFac({ ...fac, branch: e.target.value })}>
                <option value="">اختر</option>{data.data.branches.filter((b) => b.organization_id === fac.org).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </SelectField>
              <SelectField label="النوع" value={fac.type} onChange={(e) => setFac({ ...fac, type: e.target.value as FacilityType })}>
                {(['clinic', 'pharmacy', 'laboratory'] as const).map((t) => <option key={t} value={t}>{facilityTypeLabel[t]}</option>)}
              </SelectField>
              <TextField label="الاسم" value={fac.name} onChange={(e) => setFac({ ...fac, name: e.target.value })} />
              <Button icon={<Plus size={16} />} disabled={!fac.org || !fac.branch || !fac.name} onClick={async () => {
                if (await run(supabase.rpc('admin_create_facility', { p_organization_id: fac.org, p_branch_id: fac.branch, p_type: fac.type, p_name: fac.name }), 'تم إنشاء الجهة (بانتظار التحقق)')) setFac({ ...fac, name: '' });
              }}>إنشاء الجهة</Button>
            </section>
          </div>
        </div>
      )}
      <ConfirmDialog open={!!statusChange} title={`تغيير حالة «${statusChange?.name}» إلى: ${statusChange ? statusLabel[statusChange.to].label : ''}`}
                     confirmLabel="تأكيد" tone={statusChange?.to === 'active' ? 'primary' : 'danger'} onCancel={() => setStatusChange(null)} onConfirm={applyStatus}>
        <p className="small">{statusChange?.to === 'suspended' ? 'يفقد أعضاء الجهة الوصول فوراً ويختفي ملفها من البحث العام. لا تُحذف سجلات المرضى، والمواعيد المستقبلية تحتاج معالجة وفق سياسة المشغّل.' : 'يُسجَّل التغيير وسببه في سجل التدقيق.'}</p>
        <TextareaField label="السبب" required value={reason} error={reasonErr} onChange={(e) => setReason(e.target.value)} style={{ minHeight: 64 }} />
      </ConfirmDialog>
    </div>
  );
}

function StatusMenu({ current, onPick }: { current: Status; onPick: (s: Status) => void }) {
  const options: Status[] = current === 'active' ? ['suspended', 'closed'] : current === 'pending' ? ['active', 'suspended'] : ['active'];
  return (
    <select className="select" style={{ width: 'auto', minHeight: 32, fontSize: 13 }} aria-label="تغيير الحالة" value="" onChange={(e) => e.target.value && onPick(e.target.value as Status)}>
      <option value="">إجراء…</option>
      {options.map((o) => <option key={o} value={o}>{o === 'active' ? 'تحقق وتفعيل' : o === 'suspended' ? 'تعليق' : 'إغلاق'}</option>)}
    </select>
  );
}
