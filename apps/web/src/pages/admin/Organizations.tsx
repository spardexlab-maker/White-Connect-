import { useState } from 'react';
import { Building2, ChevronDown, FlaskConical, Link2, MapPin, Pill, Plus, Search, Stethoscope } from 'lucide-react';
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
    const [orgs, branches, facs, cities, people] = await Promise.all([
      unwrap(supabase.from('organizations').select('id, name, status, kind').order('name')),
      unwrap(supabase.from('branches').select('id, organization_id, name, area, latitude, longitude')),
      unwrap(supabase.from('facilities').select('id, organization_id, branch_id, name, type, status').order('name')),
      unwrap(supabase.from('cities').select('id, name_ar')),
      unwrap(supabase.rpc('admin_structure')),
    ]);
    const staff = new Map((people ?? []).map((r) => [r.facility_id, { doctors: (r.doctors ?? []) as Doctor[], count: r.staff_count }]));
    return { orgs: orgs ?? [], branches: branches ?? [], facs: facs ?? [], cities: cities ?? [], staff };
  }, []);
  const [statusChange, setStatusChange] = useState<{ entity: 'organization' | 'facility'; id: string; name: string; to: Status } | null>(null);
  const [reason, setReason] = useState('');
  const [reasonErr, setReasonErr] = useState<string>();
  const [locFor, setLocFor] = useState<{ branchId: string; name: string; value: LatLng | null } | null>(null);
  const [locBusy, setLocBusy] = useState(false);
  const [moveFor, setMoveFor] = useState<{ id: string; name: string } | null>(null);
  const [q, setQ] = useState('');
  const [type, setType] = useState<'all' | FacilityType>('all');

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
          <Structure data={data.data} q={q} setQ={setQ} type={type} setType={setType}
                     onStatus={(entity, id, name, to) => setStatusChange({ entity, id, name, to })}
                     onLocation={setLocFor} onMove={setMoveFor} />
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
      <MoveSheet target={moveFor} orgs={data.data?.orgs ?? []} branches={data.data?.branches ?? []} onClose={() => setMoveFor(null)}
                 onDone={() => { setMoveFor(null); data.reload(); }} />
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

type Doctor = { name: string; specialty: string | null };
type Fac = { id: string; organization_id: string; branch_id: string; name: string; type: string; status: string };
type Br = { id: string; organization_id: string; name: string; area: string | null; latitude: number | null; longitude: number | null };
type StructureData = { orgs: (Org & { status: string })[]; branches: Br[]; facs: Fac[]; staff: Map<string, { doctors: Doctor[]; count: number }> };
const GROUPS: { type: FacilityType; title: string; icon: typeof Stethoscope }[] = [
  { type: 'clinic', title: 'العيادات والأطباء', icon: Stethoscope },
  { type: 'pharmacy', title: 'الصيدليات', icon: Pill },
  { type: 'laboratory', title: 'المختبرات', icon: FlaskConical },
];

/** Complexes as cards (doctors · pharmacies · labs inside each), then everything not in a complex, grouped by kind. */
function Structure({ data, q, setQ, type, setType, onStatus, onLocation, onMove }: {
  data: StructureData; q: string; setQ: (v: string) => void; type: 'all' | FacilityType; setType: (t: 'all' | FacilityType) => void;
  onStatus: (entity: 'organization' | 'facility', id: string, name: string, to: Status) => void;
  onLocation: (v: { branchId: string; name: string; value: LatLng | null }) => void;
  onMove: (v: { id: string; name: string }) => void;
}) {
  const needle = q.trim();
  const matches = (f: Fac) => (type === 'all' || f.type === type) && (!needle || f.name.includes(needle)
    || (data.staff.get(f.id)?.doctors ?? []).some((d) => d.name.includes(needle)));
  const complexes = data.orgs.filter((o) => o.kind !== 'independent');
  const independentIds = new Set(data.orgs.filter((o) => o.kind === 'independent').map((o) => o.id));
  const loose = data.facs.filter((f) => independentIds.has(f.organization_id));
  const count = (fs: Fac[], t: FacilityType) => fs.filter((f) => f.type === t).length;
  const doctorsIn = (fs: Fac[]) => fs.reduce((n, f) => n + (data.staff.get(f.id)?.doctors.length ?? 0), 0);

  const row = (f: Fac, inComplex: boolean) => {
    const br = data.branches.find((b) => b.id === f.branch_id);
    const where = br && br.latitude != null && br.longitude != null ? { lat: br.latitude, lng: br.longitude } : null;
    const docs = data.staff.get(f.id)?.doctors ?? [];
    return (
      <div key={f.id} className="org-fac">
        <div className="row" style={{ gap: 'var(--s-2)', flexWrap: 'wrap' }}>
          <strong className="grow small">{f.name}{br?.area && <span className="muted"> · {br.area}</span>}</strong>
          {!inComplex && <Button size="sm" variant="secondary" icon={<Link2 size={14} />} onClick={() => onMove({ id: f.id, name: f.name })}>ربط بمجمع</Button>}
          {br && <Button size="sm" variant={where ? 'ghost' : 'secondary'} icon={<MapPin size={14} />} onClick={() => onLocation({ branchId: br.id, name: f.name, value: where })}>
            {where ? 'الموقع' : 'بلا موقع'}
          </Button>}
          <Badge tone={statusLabel[f.status as Status].tone}>{statusLabel[f.status as Status].label}</Badge>
          <StatusMenu current={f.status as Status} onPick={(to) => onStatus('facility', f.id, f.name, to)} />
        </div>
        {f.type === 'clinic' && (
          <div className="org-docs">
            {docs.length === 0 ? <span className="small muted">لا يوجد طبيب مرتبط بعد</span>
              : docs.map((d) => <span key={d.name} className="org-doc"><Stethoscope size={12} aria-hidden />{d.name}{d.specialty && <span className="muted"> · {d.specialty}</span>}</span>)}
          </div>
        )}
      </div>
    );
  };

  const groups = (fs: Fac[], inComplex: boolean) => GROUPS.filter((g) => type === 'all' || g.type === type).map((g) => {
    const list = fs.filter((f) => f.type === g.type && matches(f));
    if (!list.length) return null;
    const Icon = g.icon;
    return (
      <div key={g.type} className="org-group">
        <div className="org-group-title"><Icon size={15} aria-hidden />{g.title} <span className="muted">({list.length})</span></div>
        {list.map((f) => row(f, inComplex))}
      </div>
    );
  });

  return (
    <section className="card stack">
      <div className="row-between" style={{ flexWrap: 'wrap', gap: 'var(--s-2)' }}>
        <h2 className="section-title">الهيكل</h2>
        <div className="row small muted" style={{ gap: 'var(--s-3)', flexWrap: 'wrap' }}>
          <span>{complexes.length} مجمع</span><span>{doctorsIn(data.facs)} طبيب</span>
          <span>{count(data.facs, 'pharmacy')} صيدلية</span><span>{count(data.facs, 'laboratory')} مختبر</span>
        </div>
      </div>
      <div className="row" style={{ gap: 'var(--s-2)', flexWrap: 'wrap' }}>
        <div className="grow" style={{ minWidth: 200 }}><TextField label="بحث" placeholder="اسم جهة أو طبيب" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="row" style={{ gap: 6, alignSelf: 'flex-end', flexWrap: 'wrap' }}>
          {([['all', 'الكل'], ['clinic', 'أطباء'], ['pharmacy', 'صيدليات'], ['laboratory', 'مختبرات']] as const).map(([k, l]) => (
            <button key={k} type="button" className="chip" aria-pressed={type === k} onClick={() => setType(k)}>{l}</button>
          ))}
        </div>
      </div>
      {needle && <span className="small muted row" style={{ gap: 6 }}><Search size={14} aria-hidden />نتائج «{needle}»</span>}

      {complexes.length === 0 && <EmptyState icon={<Building2 />} title="لا توجد مجمعات بعد" />}
      {complexes.map((o) => {
        const fs = data.facs.filter((f) => f.organization_id === o.id);
        if ((needle || type !== 'all') && !fs.some(matches)) return null;
        return (
          <details key={o.id} className="org-card" open>
            <summary>
              <Building2 size={18} aria-hidden />
              <strong className="grow">{o.name}</strong>
              <span className="small muted org-counts">{doctorsIn(fs)} طبيب · {count(fs, 'pharmacy')} صيدلية · {count(fs, 'laboratory')} مختبر</span>
              <Badge tone={statusLabel[o.status as Status].tone}>{statusLabel[o.status as Status].label}</Badge>
              <span onClick={(e) => e.stopPropagation()}><StatusMenu current={o.status as Status} onPick={(to) => onStatus('organization', o.id, o.name, to)} /></span>
              <ChevronDown size={16} className="org-chev" aria-hidden />
            </summary>
            <div className="org-body">{fs.length ? groups(fs, true) : <span className="small muted">المجمع فارغ — أضف جهة من النموذج أو اربط جهة مستقلة به.</span>}</div>
          </details>
        );
      })}

      {loose.some(matches) && (
        <details className="org-card org-loose" open>
          <summary>
            <Link2 size={18} aria-hidden />
            <strong className="grow">غير تابعة لمجمع</strong>
            <span className="small muted org-counts">{loose.length} جهة — اربطها بمجمع من زر «ربط بمجمع»</span>
            <ChevronDown size={16} className="org-chev" aria-hidden />
          </summary>
          <div className="org-body">{groups(loose, false)}</div>
        </details>
      )}
    </section>
  );
}

/** Attach a facility added on its own to a complex: it keeps its own place or joins one of the complex's. */
function MoveSheet({ target, orgs, branches, onClose, onDone }: {
  target: { id: string; name: string } | null; orgs: Org[]; branches: Br[]; onClose: () => void; onDone: () => void;
}) {
  const toast = useToast();
  const [org, setOrg] = useState('');
  const [place, setPlace] = useState('own');
  const [busy, setBusy] = useState(false);
  const complexes = orgs.filter((o) => o.kind !== 'independent');
  const places = branches.filter((b) => b.organization_id === org);
  const close = () => { setOrg(''); setPlace('own'); onClose(); };
  const save = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('admin_move_facility', { p_facility_id: target!.id, p_organization_id: org, p_branch_id: place === 'own' ? undefined : place });
    setBusy(false);
    if (error) { toast(errorMessage(error), 'danger'); return; }
    toast(`رُبطت «${target!.name}» بالمجمع — الموظفون والدعوات انتقلت معها`, 'success');
    setOrg(''); setPlace('own'); onDone();
  };
  return (
    <Sheet open={!!target} onClose={close} title={`ربط «${target?.name ?? ''}» بمجمع`}>
      <div className="stack">
        <SelectField label="المجمع" value={org} onChange={(e) => { setOrg(e.target.value); setPlace('own'); }}>
          <option value="">اختر</option>
          {complexes.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </SelectField>
        {org && (
          <SelectField label="الموقع" value={place} onChange={(e) => setPlace(e.target.value)}
                       hint="«موقعها الحالي» يبقيها بعنوانها؛ أو اختر فرع المجمع إذا هي بنفس البناية.">
            <option value="own">موقعها الحالي</option>
            {places.map((b) => <option key={b.id} value={b.id}>{b.name}{b.area ? ` — ${b.area}` : ''}</option>)}
          </SelectField>
        )}
        <p className="small muted">الأطباء والموظفون المرتبطون بها يبقون بنفس حساباتهم وصلاحياتهم، والمواعيد والسجلات ما تتأثر.</p>
        <Button loading={busy} disabled={!org} icon={<Link2 size={16} />} onClick={() => void save()}>ربط بالمجمع</Button>
      </div>
    </Sheet>
  );
}
