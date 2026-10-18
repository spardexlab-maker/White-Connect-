import { useState } from 'react';
import { BellPlus, Plus, X } from 'lucide-react';
import { errorMessage, localDateKey } from '@app/shared';
import { supabase } from '../../lib/supabase';
import { Alert, Button, TextField, useToast } from '../ui';

/**
 * Agree explicit reminder times with the patient. The doctor's wording is
 * shown for reference only — nothing is converted automatically
 * ("three times daily" is not assumed to mean "every 8 hours").
 */
export function ReminderSetup({ prescriptionId, lineNo, displayName, frequencyText, asNeeded, durationDays, dispatchId, onDone }: {
  prescriptionId: string; lineNo: number; displayName: string; frequencyText: string | null; asNeeded: boolean; durationDays: number | null;
  dispatchId?: string; onDone?: () => void;
}) {
  const toast = useToast();
  const [start, setStart] = useState(localDateKey(new Date()));
  const [times, setTimes] = useState<string[]>([]);
  const [draft, setDraft] = useState('08:00');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const add = () => { if (/^\d{2}:\d{2}$/.test(draft) && !times.includes(draft)) setTimes([...times, draft].sort()); };
  const submit = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('create_medication_plan', { p_prescription_id: prescriptionId, p_line_no: lineNo, p_start_date: start,
      p_times: (asNeeded ? null : times) as string[], p_patient_consent: consent, p_dispatch_id: dispatchId });
    setBusy(false);
    if (error) { toast(errorMessage(error), 'danger'); return; }
    toast(asNeeded ? 'سُجلت الخطة (عند اللزوم — بدون تذكير ثابت)' : 'فُعّلت التذكيرات حتى نهاية مدة العلاج', 'success');
    setDone(true); onDone?.();
  };
  if (done) return <Alert tone="success">التذكيرات مفعّلة لهذا الدواء.</Alert>;
  return (
    <fieldset className="stack-sm" style={{ border: '1px dashed var(--c-border-strong)', borderRadius: 'var(--r-md)', padding: 'var(--s-3)' }}>
      <legend className="row small"><BellPlus size={16} aria-hidden /><bdi dir="ltr">{displayName}</bdi></legend>
      <p className="small muted">تعليمات الطبيب: {frequencyText ?? '—'}{durationDays ? ` · لمدة ${durationDays} يوم` : ''}</p>
      {asNeeded ? <Alert tone="info">دواء عند اللزوم: لا يُنشأ جدول جرعات ثابت.</Alert> : (
        <>
          {durationDays == null && <Alert tone="warning">لم تُحدد مدة العلاج في الوصفة؛ لا يمكن جدولة تذكيرات بلا نهاية.</Alert>}
          <TextField label="تاريخ البدء" type="date" ltr value={start} onChange={(e) => setStart(e.target.value)} />
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <div style={{ width: 140 }}><TextField label="وقت متفق عليه" type="time" ltr value={draft} onChange={(e) => setDraft(e.target.value)} /></div>
            <Button variant="secondary" icon={<Plus size={16} />} onClick={add}>إضافة</Button>
          </div>
          <div className="chips">{times.map((t) => <button key={t} className="chip" onClick={() => setTimes(times.filter((x) => x !== t))} aria-label={`إزالة ${t}`}><bdi dir="ltr">{t}</bdi> <X size={12} aria-hidden /></button>)}</div>
        </>
      )}
      <label className="row small" style={{ gap: 8 }}><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />وافق المريض على تلقي التذكيرات</label>
      <Button size="sm" loading={busy} disabled={!consent || (!asNeeded && (times.length === 0 || durationDays == null))} onClick={submit}>تفعيل</Button>
      <p className="small muted">إشعارات شاشة القفل عامة ولا تذكر اسم الدواء. رفض إذن الإشعارات أو انقطاع الجهاز قد يمنع وصولها، ووصولها لا يعني قراءتها.</p>
    </fieldset>
  );
}
