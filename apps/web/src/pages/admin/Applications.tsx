import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, ExternalLink, Phone } from 'lucide-react';
import { errorMessage, formatDateTime, formatMoney } from '@app/shared';
import { supabase } from '../../lib/supabase';
import { unwrap, useAsync } from '../../lib/useAsync';
import { Badge, Button, EmptyState, ErrorState, Ltr, PageHead, Sheet, SkeletonList, Tabs, TextareaField, useToast } from '../../components/ui';

type Status = 'new' | 'contacted' | 'approved' | 'rejected';
interface App {
  id: string; application_number: string; status: Status; full_name: string; title: string | null; specialty_other: string | null; sub_specialty: string | null;
  license_number: string; graduation_year: number | null; qualifications: string | null; years_experience: number | null; phone: string; whatsapp: string | null;
  email: string | null; gender: string | null; clinic_name: string; area: string | null; address: string; latitude: number | null; longitude: number | null;
  clinic_phone: string | null; working_hours: string | null; services: { name: string; price: number | null; minutes: number | null }[];
  consultation_fee_minor: number | null; appointment_minutes: number | null; accepts_walk_in: boolean; bio: string | null; languages: string | null;
  notes: string | null; admin_note: string | null; created_at: string; reviewed_at: string | null;
  specialty: { name_ar: string } | null; city: { name_ar: string } | null;
}
const STATUS: Record<Status, { label: string; tone: 'warning' | 'info' | 'success' | 'neutral' }> = {
  new: { label: 'جديد', tone: 'warning' }, contacted: { label: 'تم التواصل', tone: 'info' }, approved: { label: 'فُعّل', tone: 'success' }, rejected: { label: 'مرفوض', tone: 'neutral' },
};

/** «طلبات الانضمام»: doctors who filled the public form; contact them, then create the clinic and account from «المجمعات والجهات». */
export function AdminApplications() {
  const [tab, setTab] = useState<Status>('new');
  const [open, setOpen] = useState<App | null>(null);
  const list = useAsync(async () => ((await unwrap(supabase.from('provider_applications')
    .select('*, specialty:specialties(name_ar), city:cities(name_ar)').order('created_at', { ascending: false }).limit(200))) ?? []) as unknown as App[], []);
  const rows = (list.data ?? []).filter((a) => a.status === tab);
  const count = (s: Status) => (list.data ?? []).filter((a) => a.status === s).length;
  return (
    <div className="stack">
      <PageHead title="طلبات الانضمام" subtitle={<>الأطباء الذين ملؤوا <Link to="/join" target="_blank">استمارة الانضمام</Link> — شارك الرابط معهم، أو اطبعها ورقياً.</>} />
      <Tabs label="حالة الطلب" value={tab} onChange={setTab} tabs={(Object.keys(STATUS) as Status[]).map((s) => ({ id: s, label: `${STATUS[s].label} (${count(s)})` }))} />
      <section className="card card-flush">
        {list.status === 'loading' && !list.data && <SkeletonList />}
        {list.status === 'error' && <ErrorState error={list.error} onRetry={list.reload} />}
        {list.data && rows.length === 0 && <EmptyState icon={<ClipboardList />} title="لا توجد طلبات هنا" />}
        <ul className="list" style={{ margin: 0, padding: 0 }}>
          {rows.map((a) => (
            <li key={a.id} className="list-item" style={{ cursor: 'pointer', alignItems: 'flex-start' }} onClick={() => setOpen(a)}>
              <div className="grow stack-sm" style={{ gap: 2 }}>
                <div className="row-between"><strong>{a.title ? `${a.title} ` : ''}{a.full_name}</strong><Badge tone={STATUS[a.status].tone}>{STATUS[a.status].label}</Badge></div>
                <span className="small">{a.specialty?.name_ar ?? a.specialty_other}{a.sub_specialty ? ` — ${a.sub_specialty}` : ''} · {a.clinic_name}{a.city ? ` · ${a.city.name_ar}` : ''}</span>
                <span className="small muted"><Ltr>{a.application_number}</Ltr> · {formatDateTime(a.created_at)} · <Ltr>{a.phone}</Ltr></span>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <Detail app={open} onClose={() => setOpen(null)} onChanged={() => { setOpen(null); list.reload(); }} />
    </div>
  );
}

function Detail({ app, onClose, onChanged }: { app: App | null; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<Status | null>(null);
  if (!app) return null;
  const move = async (status: Status) => {
    setBusy(status);
    const { error } = await supabase.rpc('review_provider_application', { p_id: app.id, p_status: status, p_note: note || undefined });
    setBusy(null);
    if (error) { toast(errorMessage(error), 'danger'); return; }
    toast('حُدّث الطلب', 'success'); setNote(''); onChanged();
  };
  const row = (k: string, v: ReactNode) => (v == null || v === '' ? null : <><dt>{k}</dt><dd>{v}</dd></>);
  const map = app.latitude != null ? `https://maps.google.com/?q=${app.latitude},${app.longitude}` : `https://maps.google.com/?q=${encodeURIComponent(app.address)}`;
  return (
    <Sheet open={!!app} onClose={onClose} size="lg" title={`طلب ${app.application_number}`}>
      <div className="stack">
        <div className="row-between">
          <strong style={{ fontSize: 'var(--f-h3)' }}>{app.title ? `${app.title} ` : ''}{app.full_name}</strong>
          <Badge tone={STATUS[app.status].tone}>{STATUS[app.status].label}</Badge>
        </div>
        <div className="row" style={{ gap: 'var(--s-2)' }}>
          <a className="btn btn-secondary btn-sm" href={`tel:${app.phone}`}><Phone size={14} aria-hidden /><Ltr>{app.phone}</Ltr></a>
          {app.whatsapp && <a className="btn btn-ghost btn-sm" href={`https://wa.me/${app.whatsapp.replace(/\D/g, '').replace(/^0/, '964')}`} target="_blank" rel="noreferrer">واتساب</a>}
          <a className="btn btn-ghost btn-sm" href={map} target="_blank" rel="noreferrer"><ExternalLink size={14} aria-hidden />موقع العيادة</a>
        </div>
        <dl className="summary-list">
          {row('الاختصاص', `${app.specialty?.name_ar ?? app.specialty_other ?? ''}${app.sub_specialty ? ` — ${app.sub_specialty}` : ''}`)}
          {row('رقم الإجازة / النقابة', <Ltr>{app.license_number}</Ltr>)}
          {row('سنة التخرج', app.graduation_year)}
          {row('سنوات الخبرة', app.years_experience)}
          {row('الشهادات', app.qualifications)}
          {row('الجنس', app.gender === 'male' ? 'ذكر' : app.gender === 'female' ? 'أنثى' : null)}
          {row('اللغات', app.languages)}
          {row('البريد', app.email && <Ltr>{app.email}</Ltr>)}
          {row('العيادة', app.clinic_name)}
          {row('العنوان', `${app.city?.name_ar ? `${app.city.name_ar}، ` : ''}${app.area ? `${app.area}، ` : ''}${app.address}`)}
          {row('هاتف العيادة', app.clinic_phone && <Ltr>{app.clinic_phone}</Ltr>)}
          {row('الدوام', app.working_hours)}
          {row('الكشفية', app.consultation_fee_minor != null ? formatMoney(app.consultation_fee_minor) : null)}
          {row('مدة الموعد', app.appointment_minutes ? `${app.appointment_minutes} دقيقة` : null)}
          {row('بدون موعد', app.accepts_walk_in ? 'يستقبل' : 'لا')}
          {row('نبذة', app.bio)}
          {row('ملاحظات الطبيب', app.notes)}
          {row('ملاحظة الإدارة', app.admin_note)}
        </dl>
        {app.services.length > 0 && (
          <table className="table">
            <thead><tr><th>الخدمة</th><th>السعر</th><th>المدة</th></tr></thead>
            <tbody>{app.services.map((s, i) => <tr key={i}><td>{s.name}</td><td>{s.price != null ? formatMoney(s.price) : '—'}</td><td>{s.minutes ? `${s.minutes} د` : '—'}</td></tr>)}</tbody>
          </table>
        )}
        <TextareaField label="ملاحظة" optional hint="مثلاً: اتصلت به، يزورنا الأحد بالشهادات" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="row" style={{ gap: 'var(--s-2)' }}>
          {app.status !== 'contacted' && <Button size="sm" variant="secondary" loading={busy === 'contacted'} onClick={() => void move('contacted')}>تم التواصل</Button>}
          {app.status !== 'approved' && <Button size="sm" loading={busy === 'approved'} onClick={() => void move('approved')}>فُعّل (أُنشئ الحساب)</Button>}
          {app.status !== 'rejected' && <Button size="sm" variant="ghost" loading={busy === 'rejected'} onClick={() => void move('rejected')}>رفض</Button>}
        </div>
        <p className="small muted">للتفعيل: من «المجمعات والجهات» أنشئ العيادة (أو أضفها لمجمع)، ثم ادعُ الطبيب ببريده، وبعدها علّم الطلب «فُعّل».</p>
      </div>
    </Sheet>
  );
}
