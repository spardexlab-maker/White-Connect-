import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquareReply, Phone, Pill } from 'lucide-react';
import { errorMessage, formatDateTime } from '@app/shared';
import { supabase } from '../../lib/supabase';
import { unwrap, useAsync } from '../../lib/useAsync';
import { Badge, Button, EmptyState, ErrorState, Ltr, PageHead, SkeletonList, TextareaField, useToast } from '../../components/ui';

export interface PharmacyNote {
  id: string; kind: 'clarification_requested' | 'not_available'; note: string | null; at: string; reply: string | null; replied_at: string | null; seen: boolean;
  pharmacy: string; pharmacy_phone: string | null; pharmacist: string | null; rx_number: string; prescription_id: string; encounter_id: string | null;
  medicine: string | null; line_no: number; patient_name: string; public_code: string;
}

export const loadPharmacyNotes = async () => (await unwrap(supabase.rpc('doctor_pharmacy_notes'))) as unknown as PharmacyNote[];

/** «ملاحظات الصيدلية»: what pharmacies asked about the doctor's prescriptions, and the doctor's answers. */
export function PharmacyNotes() {
  const list = useAsync(loadPharmacyNotes, []);
  // opening the page marks them read (the list keeps its «جديد» marks for this visit)
  useEffect(() => { if (list.data?.some((n) => !n.seen)) void supabase.rpc('mark_pharmacy_notes_seen'); }, [list.data]);
  return (
    <div className="stack">
      <PageHead title="ملاحظات الصيدلية" subtitle="طلبات التوضيح وعدم التوفر على وصفاتك — أجب هنا فيصل ردك للصيدلي مع إشعار." />
      {list.status === 'loading' && !list.data && <SkeletonList rows={3} />}
      {list.status === 'error' && <ErrorState error={list.error} onRetry={list.reload} />}
      {list.data?.length === 0 && <div className="card"><EmptyState icon={<Pill />} title="لا توجد ملاحظات">تصلك هنا أسئلة الصيدلية عن وصفاتك.</EmptyState></div>}
      {list.data?.map((n) => <NoteCard key={n.id} n={n} onChanged={list.reload} />)}
    </div>
  );
}

export function NoteCard({ n, onChanged, compact = false }: { n: PharmacyNote; onChanged: () => void; compact?: boolean }) {
  const toast = useToast();
  const [reply, setReply] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('reply_pharmacy_note', { p_note_id: n.id, p_reply: reply });
    setBusy(false);
    if (error) { toast(errorMessage(error), 'danger'); return; }
    toast('أُرسل ردك للصيدلية', 'success'); setReply(''); setOpen(false); onChanged();
  };
  return (
    <section className="card stack-sm" style={!n.seen ? { borderColor: 'var(--c-accent)' } : undefined}>
      <div className="row-between">
        <strong>{n.medicine ?? `السطر ${n.line_no}`} <span className="small muted">— {n.patient_name}</span></strong>
        <span className="row" style={{ gap: 6 }}>
          {!n.seen && <Badge tone="accent">جديد</Badge>}
          <Badge tone={n.kind === 'not_available' ? 'warning' : 'info'}>{n.kind === 'not_available' ? 'غير متوفر' : 'طلب توضيح'}</Badge>
        </span>
      </div>
      <div className="pharmacy-note">
        <span className="small muted">{n.pharmacy}{n.pharmacist ? ` · ${n.pharmacist}` : ''} · {formatDateTime(n.at)}</span>
        <p style={{ margin: 0 }}>{n.note || '— بدون نص —'}</p>
      </div>
      {n.reply && (
        <div className="pharmacy-reply">
          <span className="small muted">ردك · {n.replied_at ? formatDateTime(n.replied_at) : ''}</span>
          <p style={{ margin: 0 }}>{n.reply}</p>
        </div>
      )}
      {!compact && <span className="small muted">وصفة <Ltr>{n.rx_number}</Ltr> · <Ltr>{n.public_code}</Ltr></span>}
      {open ? (
        <div className="stack-sm">
          <TextareaField label="ردك للصيدلي" rows={2} value={reply} onChange={(e) => setReply(e.target.value)} />
          <div className="row" style={{ gap: 6 }}>
            <Button size="sm" loading={busy} disabled={reply.trim().length < 2} onClick={() => void send()}>إرسال الرد</Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>إلغاء</Button>
          </div>
        </div>
      ) : (
        <div className="row" style={{ gap: 6 }}>
          <Button size="sm" variant="secondary" icon={<MessageSquareReply size={16} />} onClick={() => setOpen(true)}>{n.reply ? 'رد آخر' : 'الرد'}</Button>
          {n.pharmacy_phone && <a className="btn btn-ghost btn-sm" href={`tel:${n.pharmacy_phone}`}><Phone size={14} aria-hidden />اتصل بالصيدلية</a>}
          {!compact && n.encounter_id && <Link className="btn btn-ghost btn-sm" to={`/workspace/doctor/session/${n.encounter_id}`}>فتح الجلسة (لتعديل الوصفة)</Link>}
        </div>
      )}
    </section>
  );
}
