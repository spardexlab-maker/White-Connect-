import { useState } from 'react';
import { MailPlus } from 'lucide-react';
import { errorMessage, roleLabel, type MemberRole } from '@app/shared';
import { supabase } from '../../lib/supabase';
import { unwrap, useAsync } from '../../lib/useAsync';
import { Alert, Badge, Button, ErrorState, Ltr, PageHead, SelectField, SkeletonList, TextField, useToast } from '../../components/ui';

/** Invitations and membership overview for the platform admin. */
export function AdminMembers() {
  const toast = useToast();
  const data = useAsync(async () => {
    const [orgs, facs, invites] = await Promise.all([
      unwrap(supabase.from('organizations').select('id, name').order('name')),
      unwrap(supabase.from('facilities').select('id, organization_id, name, type').order('name')),
      unwrap(supabase.from('invitations').select('id, email, role, facility_id, organization_id, expires_at, accepted_at, revoked_at').order('created_at', { ascending: false }).limit(50)),
    ]);
    return { orgs: orgs ?? [], facs: facs ?? [], invites: invites ?? [] };
  }, []);
  const [f, setF] = useState({ email: '', org: '', facility: '', role: '' as MemberRole | '' });
  const [link, setLink] = useState<string | null>(null);

  const create = async () => {
    const { data: res, error } = await supabase.rpc('create_invitation', {
      p_email: f.email, p_organization_id: f.org, p_facility_id: (f.role === 'organization_admin' ? null : f.facility) as string, p_role: f.role as MemberRole,
    });
    if (error) { toast(errorMessage(error), 'danger'); return; }
    setLink(`${window.location.origin}/invite?token=${(res as { token: string }[])[0].token}`);
    data.reload();
  };

  const facilityType = data.data?.facs.find((x) => x.id === f.facility)?.type;
  const roleOptions: MemberRole[] = !f.facility ? ['organization_admin']
    : facilityType === 'clinic' ? ['doctor', 'receptionist', 'facility_admin']
    : facilityType === 'pharmacy' ? ['pharmacist', 'pharmacy_staff', 'facility_admin'] : ['lab_technician', 'lab_approver', 'facility_admin'];

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
            <SelectField label="الجهة" hint="اتركها فارغة لدعوة مدير مجمع" value={f.facility} onChange={(e) => setF({ ...f, facility: e.target.value, role: '' })}>
              <option value="">— مستوى المجمع —</option>{data.data.facs.filter((x) => x.organization_id === f.org).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </SelectField>
            <SelectField label="الدور" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as MemberRole })}>
              <option value="">اختر</option>{roleOptions.map((r) => <option key={r} value={r}>{roleLabel[r]}</option>)}
            </SelectField>
            <Alert tone="info">دعوة «طبيب» تتطلب وجود هوية مهنية للحساب قبل القبول (تُنشأ بعد التحقق من الترخيص).</Alert>
            <Button disabled={!f.email || !f.org || !f.role} onClick={create}>إنشاء الدعوة</Button>
            {link && <Alert tone="success" title="رابط الدعوة (يظهر مرة واحدة)"><div className="code-pill" style={{ fontSize: 12, wordBreak: 'break-all' }}>{link}</div></Alert>}
          </section>
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
