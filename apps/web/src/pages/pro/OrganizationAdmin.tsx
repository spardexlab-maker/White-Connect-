import { useState } from 'react';
import { MailPlus, UserCog, Users } from 'lucide-react';
import { errorMessage, formatDateTime, reasonSchema, roleLabel, type MemberRole } from '@app/shared';
import { supabase } from '../../lib/supabase';
import { unwrap, useAsync } from '../../lib/useAsync';
import { useWorkspace } from '../../lib/workspace';
import { Alert, Badge, Button, ConfirmDialog, EmptyState, ErrorState, Ltr, PageHead, SelectField, SkeletonList, TextField, TextareaField, useToast } from '../../components/ui';

interface Member { membership_id: string; user_id: string; display_name: string | null; email: string; role: MemberRole; status: 'active' | 'suspended' | 'revoked'; created_at: string }

const inviteRoles: Record<string, MemberRole[]> = {
  clinic: ['doctor', 'receptionist'],
  pharmacy: ['pharmacist', 'pharmacy_staff'],
  laboratory: ['lab_technician', 'lab_approver'],
};

/** Facility administration: members, invitations, suspension (management data only — no medical records). */
export function OrganizationAdmin() {
  const { current, workspaces } = useWorkspace();
  const toast = useToast();
  const facilities = workspaces.filter((w) => w.facility_id && current?.role === 'organization_admin');
  const [facilityId, setFacilityId] = useState<string>(current?.facility_id ?? facilities[0]?.facility_id ?? '');
  const facility = workspaces.find((w) => w.facility_id === facilityId);
  const members = useAsync(async () => (facilityId ? ((await unwrap(supabase.rpc('facility_members', { p_facility_id: facilityId }))) as Member[]) : []), [facilityId]);

  const [invite, setInvite] = useState({ email: '', role: '' as MemberRole | '' });
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [suspend, setSuspend] = useState<Member | null>(null);
  const [reason, setReason] = useState('');
  const [reasonErr, setReasonErr] = useState<string>();

  const roles = inviteRoles[facility?.facility_type ?? 'clinic'] ?? [];

  const sendInvite = async () => {
    if (!invite.email || !invite.role || !facility) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('create_invitation', {
      p_email: invite.email, p_organization_id: facility.organization_id, p_facility_id: facilityId, p_role: invite.role as MemberRole, p_valid_hours: 72,
    });
    setBusy(false);
    if (error) { toast(errorMessage(error), 'danger'); return; }
    const row = (data as { token: string }[])[0];
    setInviteLink(`${window.location.origin}/invite?token=${row.token}`);
    setInvite({ email: '', role: '' });
  };

  const doSuspend = async () => {
    const parsed = reasonSchema.safeParse(reason);
    if (!parsed.success) { setReasonErr(parsed.error.issues[0].message); return; }
    const { error } = await supabase.rpc('set_membership_status', { p_membership_id: suspend!.membership_id, p_status: suspend!.status === 'active' ? 'suspended' : 'active', p_reason: reason });
    if (error) { toast(errorMessage(error), 'danger'); return; }
    toast('تم تحديث العضوية — يسري الأثر فوراً', 'success');
    setSuspend(null); setReason(''); members.reload();
  };

  return (
    <div className="stack">
      <PageHead title="المنشأة والأعضاء" subtitle={facility?.facility_name ?? current?.organization_name}
                actions={facilities.length > 1 ? (
                  <select className="select" style={{ width: 'auto' }} aria-label="المنشأة" value={facilityId} onChange={(e) => setFacilityId(e.target.value)}>
                    {facilities.map((f) => <option key={f.membership_id} value={f.facility_id!}>{f.facility_name}</option>)}
                  </select>) : undefined} />
      <div className="two-col">
        <section className="card card-flush" aria-labelledby="mem-title">
          <div className="card-header"><h2 id="mem-title" className="row"><Users size={18} aria-hidden />الأعضاء</h2></div>
          {members.status === 'loading' && <SkeletonList rows={4} />}
          {members.status === 'error' && <ErrorState error={members.error} onRetry={members.reload} />}
          {members.data?.length === 0 && <EmptyState icon={<Users />} title="لا يوجد أعضاء" />}
          <div className="table-wrap" role="region" aria-label="الأعضاء" tabIndex={0}>
            {!!members.data?.length && (
              <table className="table">
                <thead><tr><th>الاسم</th><th>الدور</th><th>الحالة</th><th>منذ</th><th><span className="sr-only">إجراءات</span></th></tr></thead>
                <tbody>
                  {members.data.map((m) => (
                    <tr key={m.membership_id}>
                      <td><strong>{m.display_name ?? '—'}</strong><br /><span className="small muted"><Ltr>{m.email}</Ltr></span></td>
                      <td>{roleLabel[m.role]}</td>
                      <td><Badge tone={m.status === 'active' ? 'success' : m.status === 'suspended' ? 'warning' : 'neutral'}>{m.status === 'active' ? 'فعّال' : m.status === 'suspended' ? 'موقوف' : 'ملغى'}</Badge></td>
                      <td className="small">{formatDateTime(m.created_at)}</td>
                      <td>{m.status !== 'revoked' && <Button size="sm" variant={m.status === 'active' ? 'danger' : 'secondary'} onClick={() => setSuspend(m)}>{m.status === 'active' ? 'إيقاف' : 'إعادة تفعيل'}</Button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
        <section className="card stack" aria-labelledby="inv-title">
          <h2 id="inv-title" className="section-title row"><MailPlus size={18} aria-hidden />دعوة موظف</h2>
          <p className="small muted">لكل موظف حساب مستقل. المدعو يضع كلمة مروره بنفسه، والدعوة صالحة 72 ساعة.</p>
          <TextField label="البريد الإلكتروني" type="email" ltr value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} />
          <SelectField label="الدور" value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value as MemberRole })}>
            <option value="">اختر الدور</option>
            {roles.map((r) => <option key={r} value={r}>{roleLabel[r]}</option>)}
          </SelectField>
          <Button icon={<UserCog size={16} />} loading={busy} disabled={!invite.email || !invite.role} onClick={sendInvite}>إنشاء الدعوة</Button>
          {inviteLink && (
            <Alert tone="success" title="أُنشئت الدعوة">
              إرسال البريد يتطلب ربط مزود بريد (غير مفعّل بعد). انسخ الرابط وأرسله للموظف عبر قناة آمنة — يظهر مرة واحدة:
              <div className="code-pill" style={{ fontSize: 12, wordBreak: 'break-all', marginBlockStart: 6 }}>{inviteLink}</div>
            </Alert>
          )}
        </section>
      </div>
      <ConfirmDialog open={!!suspend} title={suspend?.status === 'active' ? 'إيقاف العضوية؟' : 'إعادة تفعيل العضوية؟'} confirmLabel="تأكيد"
                     tone={suspend?.status === 'active' ? 'danger' : 'primary'} onCancel={() => setSuspend(null)} onConfirm={doSuspend}>
        <p>{suspend?.status === 'active' ? 'سيفقد الموظف الوصول إلى هذه المنشأة فوراً، وتبقى السجلات التي أنشأها محفوظة.' : 'سيستعيد الموظف الوصول بنفس الدور.'}</p>
        <TextareaField label="السبب" required value={reason} error={reasonErr} onChange={(e) => setReason(e.target.value)} style={{ minHeight: 64 }} />
      </ConfirmDialog>
    </div>
  );
}
