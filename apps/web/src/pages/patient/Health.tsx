import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Pencil, Plus } from 'lucide-react';
import { errorMessage, formatDate } from '@app/shared';
import { supabase } from '../../lib/supabase';
import { unwrap, useAsync } from '../../lib/useAsync';
import { useAuth } from '../../lib/auth';
import { Alert, Badge, Button, EmptyState, ErrorState, Ltr, PageHead, SelectField, SkeletonList, TextField, TextareaField, useToast } from '../../components/ui';
import { LabTrends, ageOf, useHealth, type Health } from '../../components/clinical/HealthSummary';

const BLOOD = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

/** «صحتي»: the patient's own health profile and their tests (previous → current). */
export function MyHealth() {
  const { session, access } = useAuth();
  const [patientId, setPatientId] = useState<string | null>(null);
  useEffect(() => {
    if (access?.patient_ids?.length && !patientId) setPatientId((access.patient_ids.find((x) => x.relationship === 'self') ?? access.patient_ids[0]).patient_id);
  }, [access, patientId]);
  const people = useAsync(async () => (session ? ((await unwrap(supabase.from('patients').select('id, full_name'))) ?? []) as { id: string; full_name: string }[] : []), [session?.user.id]);

  if (!session) {
    return <div className="card"><EmptyState icon={<Activity />} title="سجّل الدخول لعرض ملفك الصحي"><Link className="btn btn-primary" to="/patient/account?next=/patient/health">تسجيل الدخول</Link></EmptyState></div>;
  }
  return (
    <div className="stack">
      <PageHead title="صحتي" subtitle="بياناتك الصحية وتحاليلك — يراها أطباؤك المعالجون فقط" />
      {(people.data?.length ?? 0) > 1 && (
        <div style={{ maxWidth: 320 }}>
          <SelectField label="الملف" value={patientId ?? ''} onChange={(e) => setPatientId(e.target.value)}>
            {people.data!.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </SelectField>
        </div>
      )}
      {patientId && <HealthBody key={patientId} patientId={patientId} />}
    </div>
  );
}

function HealthBody({ patientId }: { patientId: string }) {
  const h = useHealth(patientId);
  if (h.status === 'loading' && !h.data) return <SkeletonList rows={5} />;
  if (h.status === 'error') return <ErrorState error={h.error} onRetry={h.reload} />;
  const d = h.data!;
  return (
    <div className="stack">
      <Basics h={d} onSaved={h.reload} />
      <div className="two-col">
        <Conditions h={d} onChanged={h.reload} />
        <Allergies h={d} onChanged={h.reload} />
      </div>
      <Medications h={d} onChanged={h.reload} />
      <section className="card stack-sm" aria-labelledby="tests-title">
        <h2 id="tests-title" className="section-title">تحاليلي</h2>
        <p className="small muted">كل تحليل مرة واحدة: آخر نتيجة والسابقة. اضغط «السجل» لكل النتائج، و«التقرير» لفتح تقرير المختبر وطباعته.</p>
        <LabTrends trends={d.lab_trends} linkBase="/patient/labs/" />
      </section>
    </div>
  );
}

function Basics({ h, onSaved }: { h: Health; onSaved: () => void }) {
  const toast = useToast();
  const [edit, setEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ birth: h.patient.birth_date ?? '', height: h.profile.height_cm ? String(Number(h.profile.height_cm)) : '',
    weight: h.profile.weight_kg ? String(Number(h.profile.weight_kg)) : '', blood: h.profile.blood_type ?? '', notes: h.profile.notes ?? '' });
  const age = ageOf(h);
  const save = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('save_health_profile', { p_patient_id: h.patient.id, p_birth_date: f.birth || undefined,
      p_height_cm: f.height ? Number(f.height) : undefined, p_weight_kg: f.weight ? Number(f.weight) : undefined,
      p_blood_type: f.blood || undefined, p_notes: f.notes || undefined });
    setBusy(false);
    if (error) { toast(errorMessage(error), 'danger'); return; }
    toast('حُفظت بياناتك', 'success'); setEdit(false); onSaved();
  };
  return (
    <section className="card stack" aria-labelledby="basics-title">
      <div className="row-between">
        <h2 id="basics-title" className="section-title">بياناتي الأساسية</h2>
        {!edit && <Button size="sm" variant="secondary" icon={<Pencil size={16} />} onClick={() => setEdit(true)}>تعديل</Button>}
      </div>
      {!edit ? (
        <div className="kpi-strip">
          <div className="kpi"><div><div className="kpi-v">{age ?? '—'}</div><div className="kpi-l">العمر</div>{h.patient.birth_date && <span className="small muted"><Ltr>{h.patient.birth_date}</Ltr></span>}</div></div>
          <div className="kpi"><div><div className="kpi-v">{h.profile.height_cm ? Number(h.profile.height_cm) : '—'}</div><div className="kpi-l">الطول (سم)</div></div></div>
          <div className="kpi"><div><div className="kpi-v">{h.profile.weight_kg ? Number(h.profile.weight_kg) : '—'}</div><div className="kpi-l">الوزن (كغ)</div></div></div>
          <div className="kpi"><div><div className="kpi-v"><Ltr>{h.profile.blood_type ?? '—'}</Ltr></div><div className="kpi-l">فصيلة الدم</div></div></div>
        </div>
      ) : (
        <div className="stack-sm">
          <div className="rx-grid">
            <TextField label="تاريخ الميلاد" type="date" ltr value={f.birth} onChange={(e) => setF({ ...f, birth: e.target.value })} />
            <TextField label="الطول (سم)" inputMode="decimal" ltr value={f.height} onChange={(e) => setF({ ...f, height: e.target.value })} />
            <TextField label="الوزن (كغ)" inputMode="decimal" ltr value={f.weight} onChange={(e) => setF({ ...f, weight: e.target.value })} />
            <SelectField label="فصيلة الدم" value={f.blood} onChange={(e) => setF({ ...f, blood: e.target.value })}>
              <option value="">لا أعرف</option>{BLOOD.map((b) => <option key={b} value={b}>{b}</option>)}
            </SelectField>
          </div>
          <TextareaField label="ملاحظات لطبيبك" optional value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          <div className="row"><Button loading={busy} onClick={() => void save()}>حفظ</Button><Button variant="ghost" onClick={() => setEdit(false)}>إلغاء</Button></div>
        </div>
      )}
      {!h.profile.height_cm && !h.profile.weight_kg && !edit && <Alert tone="info">أكمل بياناتك (العمر والطول والوزن) حتى يطّلع عليها طبيبك قبل الكشف.</Alert>}
    </section>
  );
}

function Conditions({ h, onChanged }: { h: Health; onChanged: () => void }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [since, setSince] = useState('');
  const run = async (p: PromiseLike<{ error: unknown }>, ok: string) => { const { error } = await p; if (error) toast(errorMessage(error), 'danger'); else { toast(ok, 'success'); onChanged(); } };
  return (
    <section className="card stack-sm" aria-labelledby="cond-title">
      <h2 id="cond-title" className="section-title">الأمراض المزمنة</h2>
      {h.conditions.length === 0 && <p className="small muted">لا شيء مسجل.</p>}
      {h.conditions.map((c) => (
        <div key={c.id} className="row-between small">
          <span><strong>{c.name}</strong>{c.since_year ? ` · منذ ${c.since_year}` : ''} {c.status === 'resolved' && <Badge tone="neutral">زال</Badge>}</span>
          <span className="row" style={{ gap: 4 }}>
            {c.status === 'active' && <Button size="sm" variant="ghost" onClick={() => void run(supabase.rpc('set_condition_status', { p_condition_id: c.id, p_status: 'resolved' }), 'حُدّث')}>زال</Button>}
            {c.source === 'patient_reported' && <Button size="sm" variant="ghost" onClick={() => void run(supabase.rpc('set_condition_status', { p_condition_id: c.id, p_status: 'entered_in_error' }), 'حُذف')}>حذف</Button>}
          </span>
        </div>
      ))}
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div className="grow"><TextField label="مرض مزمن" placeholder="مثال: السكري" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div style={{ width: 110 }}><TextField label="منذ سنة" inputMode="numeric" ltr optional value={since} onChange={(e) => setSince(e.target.value)} /></div>
        <Button variant="secondary" icon={<Plus size={16} />} disabled={!name.trim()}
                onClick={() => void run(supabase.rpc('add_condition', { p_patient_id: h.patient.id, p_name: name, p_since_year: since ? Number(since) : undefined }), 'أُضيف').then(() => { setName(''); setSince(''); })}>إضافة</Button>
      </div>
    </section>
  );
}

function Allergies({ h, onChanged }: { h: Health; onChanged: () => void }) {
  const toast = useToast();
  const [sub, setSub] = useState('');
  const [reaction, setReaction] = useState('');
  const add = async () => {
    const { error } = await supabase.rpc('add_allergy', { p_patient_id: h.patient.id, p_substance: sub, p_reaction: reaction || undefined });
    if (error) toast(errorMessage(error), 'danger'); else { toast('أُضيفت', 'success'); setSub(''); setReaction(''); onChanged(); }
  };
  return (
    <section className="card stack-sm" aria-labelledby="all-title">
      <h2 id="all-title" className="section-title">الحساسية</h2>
      {h.allergies.length === 0 && <p className="small muted">لا شيء مسجل.</p>}
      {h.allergies.map((a) => <div key={a.id} className="small"><Badge tone="danger">{a.substance}</Badge> {a.reaction ?? ''}</div>)}
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div className="grow"><TextField label="مادة أو دواء" placeholder="مثال: Penicillin" value={sub} onChange={(e) => setSub(e.target.value)} /></div>
        <div className="grow"><TextField label="ماذا يحدث" optional value={reaction} onChange={(e) => setReaction(e.target.value)} /></div>
        <Button variant="secondary" icon={<Plus size={16} />} disabled={!sub.trim()} onClick={() => void add()}>إضافة</Button>
      </div>
    </section>
  );
}

function Medications({ h, onChanged }: { h: Health; onChanged: () => void }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const add = async () => {
    const { error } = await supabase.rpc('add_reported_medication', { p_patient_id: h.patient.id, p_name: name, p_dose_text: dose || undefined });
    if (error) toast(errorMessage(error), 'danger'); else { toast('أُضيف', 'success'); setName(''); setDose(''); onChanged(); }
  };
  const stop = async (id: string) => {
    const { error } = await supabase.rpc('stop_reported_medication', { p_medication_id: id });
    if (error) toast(errorMessage(error), 'danger'); else onChanged();
  };
  return (
    <section className="card stack-sm" aria-labelledby="med-title">
      <h2 id="med-title" className="section-title">الأدوية المستمرة</h2>
      {h.prescribed.map((m, i) => (
        <div key={`p${i}`} className="row-between small"><span><bdi dir="ltr" style={{ fontWeight: 600 }}>{m.name}</bdi>{m.frequency ? ` · ${m.frequency}` : ''}</span>
          <span className="muted">من وصفة {m.doctor}{m.until ? ` · حتى ${formatDate(m.until)}` : ''}</span></div>
      ))}
      {h.medications.map((m) => (
        <div key={m.id} className="row-between small"><span><bdi dir="auto" style={{ fontWeight: 600 }}>{m.name}</bdi>{m.dose_text ? ` · ${m.dose_text}` : ''}</span>
          <Button size="sm" variant="ghost" onClick={() => void stop(m.id)}>توقفت عنه</Button></div>
      ))}
      {h.prescribed.length + h.medications.length === 0 && <p className="small muted">لا أدوية مستمرة مسجلة.</p>}
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div className="grow"><TextField label="دواء تأخذه باستمرار" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="grow"><TextField label="الجرعة" optional placeholder="مثال: قرص صباحاً" value={dose} onChange={(e) => setDose(e.target.value)} /></div>
        <Button variant="secondary" icon={<Plus size={16} />} disabled={!name.trim()} onClick={() => void add()}>إضافة</Button>
      </div>
    </section>
  );
}
