import { useState } from 'react';
import { Building2, MapPin, Plus } from 'lucide-react';
import { errorMessage, facilityTypeLabel, reasonSchema, type FacilityType, type LatLng } from '@app/shared';
import { supabase } from '../../lib/supabase';
import { unwrap, useAsync } from '../../lib/useAsync';
import { Badge, Button, ConfirmDialog, EmptyState, ErrorState, PageHead, SelectField, Sheet, SkeletonList, TextField, TextareaField, useToast } from '../../components/ui';
import { MapLinkField } from '../../components/MapLinkField';

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
      unwrap(supabase.from('branches').select('id, organization_id, name, area, latitude, longitude')),
      unwrap(supabase.from('facilities').select('id, organization_id, branch_id, name, type, status').order('name')),
      unwrap(supabase.from('cities').select('id, name_ar')),
    ]);
    return { orgs: orgs ?? [], branches: branches ?? [], facs: facs ?? [], cities: cities ?? [] };
  }, []);
  const [statusChange, setStatusChange] = useState<{ entity: 'organization' | 'facility'; id: string; name: string; to: Status } | null>(null);
  const [reason, setReason] = useState('');
  const [reasonErr, setReasonErr] = useState<string>();
  const [locFor, setLocFor] = useState<{ branchId: string; name: string; value: LatLng | null } | null>(null);
  const [locBusy, setLocBusy] = useState(false);

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
                  <strong className="grow">{o.name}{o.kind === 'independent' && <span className="muted small"> · جهة مستقلة</span>}</strong>
                  <Badge tone={statusLabel[o.status as Status].tone}>{statusLabel[o.status as Status].label}</Badge>
                  <StatusMenu current={o.status as Status} onPick={(to) => setStatusChange({ entity: 'organization', id: o.id, name: o.name, to })} />
                </div>
                {data.data!.facs.filter((f) => f.organization_id === o.id).map((f) => {
                  const br = data.data!.branches.find((b) => b.id === f.branch_id);
                  const where = br && br.latitude != null && br.longitude != null ? { lat: br.latitude, lng: br.longitude } : null;
                  return (
                  <div key={f.id} className="list-item" style={{ paddingInlineStart: 'var(--s-10)', borderBlockEnd: 0 }}>
                    <span className="grow small">{f.name} <span className="muted">· {facilityTypeLabel[f.type as FacilityType]} · {br?.name}</span></span>
                    {br && <Button size="sm" variant={where ? 'ghost' : 'secondary'} icon={<MapPin size={14} />} onClick={() => setLocFor({ branchId: br.id, name: f.name, value: where })}>
                      {where ? 'الموقع' : 'بلا موقع'}
                    </Button>}
                    <Badge tone={statusLabel[f.status as Status].tone}>{statusLabel[f.status as Status].label}</Badge>
                    <StatusMenu current={f.status as Status} onPick={(to) => setStatusChange({ entity: 'facility', id: f.id, name: f.name, to })} />
                  </div>
                  );
                })}
              </div>
            ))}
          </section>
          <NewFacilityForm orgs={data.data.orgs} branches={data.data.branches} cities={data.data.cities} onDone={data.reload} />
        </div>
      )}
      <Sheet open={!!locFor} onClose={() => setLocFor(null)} title={`موقع «${locFor?.name ?? ''}» على الخريطة`}>
        {locFor && (
          <div className="stack">
            <MapLinkField value={locFor.value} onChange={(v) => setLocFor({ ...locFor, value: v })} />
            <p className="small muted">يظهر للمرضى كخريطة مع زر «الاتجاهات»، ويُستعمل لترتيب «الأقرب إليك». يشمل كل الجهات بنفس الموقع.</p>
            <Button loading={locBusy} disabled={!locFor.value} onClick={async () => {
              setLocBusy(true);
              const ok = await run(supabase.rpc('admin_set_branch_location', { p_branch_id: locFor.branchId, p_latitude: locFor.value!.lat, p_longitude: locFor.value!.lng }), 'حُفظ الموقع');
              setLocBusy(false);
              if (ok) setLocFor(null);
            }}>حفظ الموقع</Button>
          </div>
        )}
      </Sheet>
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

type Org = { id: string; name: string; kind: string };
const NONE = '__none__', NEW = '__new__';

/** One form for a clinic / pharmacy / lab. The complex is optional: without one, an "independent" record is created behind the scenes. */
function NewFacilityForm({ orgs, branches, cities, onDone }: {
  orgs: Org[]; branches: { id: string; organization_id: string; name: string; area: string | null }[]; cities: { id: string; name_ar: string }[]; onDone: () => void;
}) {
  const toast = useToast();
  const empty = { type: 'clinic' as FacilityType, name: '', phone: '', org: NONE, orgName: '', branch: NEW, city: '', area: '', address: '', loc: null as LatLng | null, activate: true };
  const [f, setF] = useState(empty);
  const [busy, setBusy] = useState(false);
  const complexes = orgs.filter((o) => o.kind !== 'independent');
  const orgBranches = branches.filter((b) => b.organization_id === f.org);
  const needsLocation = f.org === NONE || f.org === NEW || f.branch === NEW;
  const valid = f.name.trim() && (f.org !== NEW || f.orgName.trim()) && (!needsLocation || f.city);

  const submit = async () => {
    setBusy(true);
    try {
      let orgId = f.org;
      if (f.org === NONE || f.org === NEW) {
        const { data, error } = await supabase.rpc('admin_create_organization', {
          p_name: f.org === NEW ? f.orgName.trim() : f.name.trim(), p_kind: f.org === NEW ? 'medical_complex' : 'independent', p_activate: f.activate,
        });
        if (error) throw error;
        orgId = (data as { id: string }).id;
      }
      let branchId = f.branch;
      if (needsLocation) {
        const { data, error } = await supabase.rpc('admin_create_branch', {
          p_organization_id: orgId, p_name: f.area.trim() || 'الموقع الرئيسي', p_city_id: f.city || undefined, p_area: f.area || undefined,
          p_address: f.address || undefined, p_latitude: f.loc?.lat, p_longitude: f.loc?.lng,
        });
        if (error) throw error;
        branchId = (data as { id: string }).id;
      }
      const { error } = await supabase.rpc('admin_create_facility', {
        p_organization_id: orgId, p_branch_id: branchId, p_type: f.type, p_name: f.name.trim(), p_phone: f.phone || undefined, p_activate: f.activate,
      });
      if (error) throw error;
      toast(f.activate ? 'أُضيفت الجهة وفُعّلت' : 'أُضيفت الجهة (بانتظار التحقق)', 'success');
      setF(empty); onDone();
    } catch (e) {
      toast(errorMessage(e), 'danger');
    } finally { setBusy(false); }
  };

  return (
    <section className="card stack">
      <h2 className="section-title">إضافة جهة (عيادة / صيدلية / مختبر)</h2>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div style={{ width: 150 }}><SelectField label="النوع" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as FacilityType })}>
          {(['clinic', 'pharmacy', 'laboratory'] as const).map((t) => <option key={t} value={t}>{facilityTypeLabel[t]}</option>)}
        </SelectField></div>
        <div className="grow"><TextField label="اسم الجهة" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="مثال: عيادة د. علي" /></div>
      </div>
      <TextField label="هاتف الجهة" optional type="tel" ltr value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
      <SelectField label="المجمع" optional hint="اختياري — اتركه «بدون مجمع» لعيادة أو صيدلية أو مختبر مستقل." value={f.org}
                   onChange={(e) => setF({ ...f, org: e.target.value, branch: NEW })}>
        <option value={NONE}>بدون مجمع (جهة مستقلة)</option>
        {complexes.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        <option value={NEW}>+ مجمع جديد…</option>
      </SelectField>
      {f.org === NEW && <TextField label="اسم المجمع الجديد" value={f.orgName} onChange={(e) => setF({ ...f, orgName: e.target.value })} />}
      {f.org !== NONE && f.org !== NEW && (
        <SelectField label="الموقع / الفرع" value={f.branch} onChange={(e) => setF({ ...f, branch: e.target.value })}>
          {orgBranches.map((b) => <option key={b.id} value={b.id}>{b.name}{b.area ? ` — ${b.area}` : ''}</option>)}
          <option value={NEW}>+ موقع جديد…</option>
        </SelectField>
      )}
      {needsLocation && (
        <div className="panel-muted stack-sm">
          <strong className="small">الموقع</strong>
          <SelectField label="المدينة" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })}>
            <option value="">اختر</option>{cities.map((c) => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
          </SelectField>
          <TextField label="المنطقة" optional value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} placeholder="مثال: الكرادة" />
          <TextField label="العنوان" optional value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
          <MapLinkField value={f.loc} onChange={(loc) => setF({ ...f, loc })} />
        </div>
      )}
      <label className="check small"><input type="checkbox" checked={f.activate} onChange={(e) => setF({ ...f, activate: e.target.checked })} />تحققت منها — تفعيل مباشرة (تظهر للمرضى)</label>
      <Button icon={<Plus size={16} />} loading={busy} disabled={!valid} onClick={submit}>إضافة الجهة</Button>
    </section>
  );
}
