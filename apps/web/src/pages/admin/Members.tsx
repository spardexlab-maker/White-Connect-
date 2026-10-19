import { useState } from 'react';
import { MailPlus, Stethoscope, UserCog, Users } from 'lucide-react';
import { errorMessage, reasonSchema, roleLabel, type MemberRole } from '@app/shared';
import { supabase } from '../../lib/supabase';
import { unwrap, useAsync } from '../../lib/useAsync';
import { Alert, Badge, Button, ConfirmDialog, EmptyState, ErrorState, Ltr, PageHead, SelectField, Sheet, SkeletonList, TextField, TextareaField, useToast } from '../../components/ui';

/** Invitations and membership overview for the platform admin. */
export function AdminMembers() {
  const toast = useToast();
  const data = useAsync(async () => {
    const [orgs, facs, invites, specialties] = await Promise.all([
      unwrap(supabase.from('organizations').select('id, name').order('name')),
      unwrap(supabase.from('facilities').select('id, organization_id, name, type').order('name')),
      unwrap(supabase.from('invitations').select('id, email, role, facility_id, organization_id, expires_at, accepted_at, revoked_at').order('created_at', { ascending: false }).limit(50)),
      unwrap(supabase.from('specialties').select('id, name_ar').eq('is_active', true).order('sort_order')),
    ]);
    return { orgs: orgs ?? [], facs: facs ?? [], invites: invites ?? [], specialties: specialties ?? [] };
  }, []);
  const [f, setF] = useState({ email: '', org: '', facility: '', role: '' as MemberRole | '' });
  const [link, setLink] = useState<string | null>(null);

  const create = async () => {
    const { data: res, error } = await supabase.rpc('create_invitation', {
      p_email: f.email, p_organization_id: f.org, p_facility_id: f.facility, p_role: f.role as MemberRole,
    });
    if (error) { toast(errorMessage(error), 'danger'); return; }
    setLink(`${window.location.origin}/invite?token=${(res as { token: string }[])[0].token}`);
    data.reload();
  };

  const facilityType = data.data?.facs.find((x) => x.id === f.facility)?.type;
  // Staff roles only: administration (staff, reports, finance) is done by the platform admin.
  const roleOptions: MemberRole[] = !f.facility ? []
    : facilityType === 'clinic' ? ['doctor', 'receptionist']
    : facilityType === 'pharmacy' ? ['pharmacist', 'pharmacy_staff'] : ['lab_technician', 'lab_approver'];

  return (
    <div className="stack">
      <PageHead title="الحسابات والعضويات" />
      {data.status === 'loading' && <SkeletonList />}
      {data.status === 'error' && <ErrorState error={data.error} onRetry={data.reload} />}
      {data.data && (
        <div className="two-col">
          <section className="card stack">
            <h2 className="section-title row"><MailPlus size={18} aria-hidden />دعوة جديدة</h2>
            <TextField label="البريد الإلكتروني" type="email" ltr value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            <SelectField label="المجمع" value={f.org} onChange={(e) => setF({ ...f, org: e.target.value, facility: '', role: '' })}>
              <option value="">اختر</option>{data.data.orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </SelectField>
            <SelectField label="الجهة" value={f.facility} onChange={(e) => setF({ ...f, facility: e.target.value, role: '' })}>
              <option value="">اختر</option>{data.data.facs.filter((x) => x.organization_id === f.org).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </SelectField>
            <SelectField label="الدور" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as MemberRole })}>
              <option value="">اختر</option>{roleOptions.map((r) => <option key={r} value={r}>{roleLabel[r]}</option>)}
            </SelectField>
            <Alert tone="info">للطبيب: أنشئ هويته المهنية أدناه (بعد أن يسجّل حسابه) حتى يظهر للمرضى في البحث.</Alert>
            <Button disabled={!f.email || !f.org || !f.facility || !f.role} onClick={create}>إنشاء الدعوة</Button>
            {link && <Alert tone="success" title="رابط الدعوة (يظهر مرة واحدة)"><div className="code-pill" style={{ fontSize: 12, wordBreak: 'break-all' }}>{link}</div></Alert>}
          </section>
          <PractitionerForm specialties={data.data.specialties} />
          <FacilityMembers facs={data.data.facs} orgs={data.data.orgs} />
          <section className="card card-flush">
            <div className="card-header"><h2>آخر الدعوات</h2></div>
            <div className="table-wrap" role="region" aria-label="الدعوات" tabIndex={0}>
              <table className="table">
                <thead><tr><th>البريد</th><th>الدور</th><th>الحالة</th></tr></thead>
                <tbody>
                  {data.data.invites.map((i) => (
                    <tr key={i.id}>
                      <td><Ltr>{i.email}</Ltr></td><td>{roleLabel[i.role as MemberRole]}</td>
                      <td>{i.accepted_at ? <Badge tone="success">مقبولة</Badge> : i.revoked_at ? <Badge tone="neutral">ملغاة</Badge> : new Date(i.expires_at) < new Date() ? <Badge tone="neutral">منتهية</Badge> : <Badge tone="warning">بانتظار القبول</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

/** Professional identity of a doctor (name, specialty, licence) for an account that already exists. */
function PractitionerForm({ specialties }: { specialties: { id: string; name_ar: string }[] }) {
  const toast = useToast();
  const empty = { email: '', fullName: '', title: '', specialty: '', license: '', bio: '', verified: false };
  const [f, setF] = useState(empty);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('admin_upsert_practitioner_by_email', {
      p_email: f.email, p_full_name: f.fullName, p_specialty_id: f.specialty || undefined, p_title: f.title || undefined,
      p_license_number: f.license || undefined, p_bio: f.bio || undefined, p_mark_license_verified: f.verified,
    });
    setBusy(false);
    if (error) { toast(errorMessage(error), 'danger'); return; }
    toast('حُفظت الهوية المهنية للطبيب', 'success');
    setF(empty);
  };
  return (
    <section className="card stack">
      <h2 className="section-title row"><Stethoscope size={18} aria-hidden />الهوية المهنية للطبيب</h2>
      <p className="small muted">الطبيب يسجّل حساباً أولاً بالبريد نفسه، ثم تنشئ هنا ملفه، ثم ترسل له دعوة بدور «طبيب» على العيادة.</p>
      <TextField label="بريد حساب الطبيب" type="email" ltr value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      <TextField label="الاسم الكامل كما يظهر للمرضى" value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} />
      <TextField label="اللقب" optional hint="مثال: استشاري، أخصائي" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      <SelectField label="التخصص" value={f.specialty} onChange={(e) => setF({ ...f, specialty: e.target.value })}>
        <option value="">اختر</option>{specialties.map((x) => <option key={x.id} value={x.id}>{x.name_ar}</option>)}
      </SelectField>
      <TextField label="رقم الترخيص" optional ltr value={f.license} onChange={(e) => setF({ ...f, license: e.target.value })} />
      <TextField label="نبذة" optional value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} />
      <label className="row small" style={{ gap: 8 }}><input type="checkbox" checked={f.verified} onChange={(e) => setF({ ...f, verified: e.target.checked })} />راجعتُ الترخيص (تظهر شارة «موثّق»)</label>
      <Button loading={busy} disabled={!f.email || !f.fullName.trim()} onClick={save}>حفظ الهوية المهنية</Button>
    </section>
  );
}

interface Member { membership_id: string; user_id: string; display_name: string | null; email: string; role: MemberRole; status: 'active' | 'suspended' | 'revoked'; created_at: string }

/** Staff of one facility, with suspend / reactivate (takes effect immediately, audited). */
function FacilityMembers({ facs, orgs }: { facs: { id: string; organization_id: string; name: string }[]; orgs: { id: string; name: string }[] }) {
  const toast = useToast();
  const [facilityId, setFacilityId] = useState(facs[0]?.id ?? '');
  const [target, setTarget] = useState<Member | null>(null);
  const [scopeFor, setScopeFor] = useState<Member | null>(null);
  const [reason, setReason] = useState('');
  const [reasonErr, setReasonErr] = useState<string>();
  const members = useAsync(async () => (facilityId ? ((await unwrap(supabase.rpc('facility_members', { p_facility_id: facilityId }))) as Member[]) : []), [facilityId]);
  const apply = async () => {
    const parsed = reasonSchema.safeParse(reason);
    if (!parsed.success) { setReasonErr(parsed.error.issues[0].message); return; }
    const { error } = await supabase.rpc('set_membership_status', { p_membership_id: target!.membership_id, p_status: target!.status === 'active' ? 'suspended' : 'active', p_reason: reason });
    if (error) { toast(errorMessage(error), 'danger'); return; }
    toast('تم تحديث العضوية — يسري الأثر فوراً', 'success');
    setTarget(null); setReason(''); setReasonErr(undefined); members.reload();
  };
  const orgName = (id: string) => orgs.find((o) => o.id === id)?.name ?? '';
  return (
    <section className="card card-flush">
      <div className="card-header"><h2 className="row" style={{ gap: 8 }}><Users size={18} aria-hidden />موظفو الجهة</h2></div>
      <div style={{ padding: 'var(--s-4)' }}>
        <SelectField label="الجهة" value={facilityId} onChange={(e) => setFacilityId(e.target.value)}>
          {facs.map((x) => <option key={x.id} value={x.id}>{x.name} — {orgName(x.organization_id)}</option>)}
        </SelectField>
      </div>
      {members.status === 'loading' && !members.data && <SkeletonList rows={3} />}
      {members.status === 'error' && <ErrorState error={members.error} onRetry={members.reload} />}
      {members.data?.length === 0 && <EmptyState icon={<UserCog />} title="لا يوجد موظفون في هذه الجهة">أرسل دعوة من النموذج أعلاه.</EmptyState>}
      <ul className="list" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
        {members.data?.map((m) => (
          <li key={m.membership_id} className="list-item">
            <div className="grow" style={{ minWidth: 0 }}>
              <strong className="truncate" style={{ display: 'block' }}>{m.display_name ?? m.email}</strong>
              <span className="small muted"><Ltr>{m.email}</Ltr> · {roleLabel[m.role]}</span>
            </div>
            <Badge tone={m.status === 'active' ? 'success' : 'danger'}>{m.status === 'active' ? 'فعّال' : m.status === 'suspended' ? 'معلّق' : 'ملغى'}</Badge>
            {m.role === 'receptionist' && m.status === 'active' && <Button size="sm" variant="soft" icon={<Stethoscope size={14} />} onClick={() => setScopeFor(m)}>الأطباء</Button>}
            {m.status !== 'revoked' && (
              <Button size="sm" variant={m.status === 'active' ? 'danger' : 'secondary'} onClick={() => { setTarget(m); setReason(''); setReasonErr(undefined); }}>
                {m.status === 'active' ? 'تعليق' : 'إعادة تفعيل'}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {scopeFor && <ReceptionScopeSheet member={scopeFor} onClose={() => setScopeFor(null)} />}
      <ConfirmDialog open={!!target} title={target?.status === 'active' ? `تعليق ${target?.display_name ?? target?.email}؟` : `إعادة تفعيل ${target?.display_name ?? target?.email}؟`}
                     confirmLabel="تأكيد" tone={target?.status === 'active' ? 'danger' : 'primary'} onCancel={() => setTarget(null)} onConfirm={apply}>
        <p className="small">{target?.status === 'active' ? 'يفقد الوصول لهذه الجهة فوراً. لا تُحذف أي سجلات.' : 'يستعيد الوصول بنفس الدور.'}</p>
        <TextareaField label="السبب" required value={reason} error={reasonErr} onChange={(e) => setReason(e.target.value)} style={{ minHeight: 64 }} />
      </ConfirmDialog>
    </section>
  );
}

/** Which doctors a receptionist manages (their appointments, queue and bookings). */
function ReceptionScopeSheet({ member, onClose }: { member: Member; onClose: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const opts = useAsync(async () => (await unwrap(supabase.rpc('reception_scope_options', { p_membership_id: member.membership_id }))) as
    { practitioner_id: string; full_name: string; specialty: string | null; allowed: boolean }[], [member.membership_id]);
  const toggle = async (practitionerId: string, allowed: boolean) => {
    setBusy(practitionerId);
    const { error } = await supabase.rpc('set_reception_scope', { p_membership_id: member.membership_id, p_practitioner_id: practitionerId, p_allowed: allowed });
    setBusy(null);
    if (error) { toast(errorMessage(error), 'danger'); return; }
    opts.reload();
  };
  return (
    <Sheet open onClose={onClose} title={`أطباء ${member.display_name ?? member.email}`}>
      <div className="stack">
        <p className="small muted">السكرتير يرى ويدير مواعيد وطابور الأطباء المحددين فقط في هذه العيادة. التغيير يسري فوراً.</p>
        {opts.status === 'loading' && !opts.data && <SkeletonList rows={2} />}
        {opts.status === 'error' && <ErrorState error={opts.error} onRetry={opts.reload} />}
        {opts.data?.length === 0 && <EmptyState icon={<Stethoscope />} title="لا يوجد أطباء في هذه العيادة بعد" />}
        {opts.data?.map((d) => (
          <label key={d.practitioner_id} className="lookup-result" aria-pressed={d.allowed} style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={d.allowed} disabled={busy === d.practitioner_id} onChange={(e) => void toggle(d.practitioner_id, e.target.checked)}
                   style={{ width: 18, height: 18, accentColor: 'var(--c-accent)' }} />
            <span className="grow"><strong style={{ display: 'block' }}>{d.full_name}</strong><span className="small muted">{d.specialty ?? '—'}</span></span>
            {d.allowed && <Badge tone="success">يدير مواعيده</Badge>}
          </label>
        ))}
      </div>
    </Sheet>
  );
}
