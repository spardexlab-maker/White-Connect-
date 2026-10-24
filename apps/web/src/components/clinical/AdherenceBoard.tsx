import { useState } from 'react';
import { Pill, Sparkles } from 'lucide-react';
import { aiErrorMessage, formatDateTime, formatTime } from '@app/shared';
import { supabase } from '../../lib/supabase';
import { unwrap, useAsync } from '../../lib/useAsync';
import { Alert, Badge, Button, EmptyState, SkeletonList } from '../ui';

export interface PlanAdherence {
  id: string; display_name: string; status: string; interval_hours: number | null; times: string[] | null;
  dose: number | null; dose_unit: string | null; prescribed: boolean; prescribed_by: string | null; taken_amount: number;
  due: number; taken: number; skipped: number; missed: number; last_taken_at: string | null;
  recent: { at: string; recorded_at: string | null; amount: number | null; state: 'taken' | 'skipped' | 'missed' | 'pending' }[];
}
type Column = 'good' | 'mixed' | 'poor' | 'new';
const COLUMNS: { id: Column; title: string; hint: string }[] = [
  { id: 'poor', title: 'غير ملتزم', hint: 'أقل من 50٪' },
  { id: 'mixed', title: 'متذبذب', hint: '50–79٪' },
  { id: 'good', title: 'ملتزم', hint: '80٪ فأكثر' },
  { id: 'new', title: 'لم تبدأ بعد', hint: 'لا جرعات مستحقة' },
];
const pctOf = (p: PlanAdherence) => (p.due ? Math.round((p.taken / p.due) * 100) : null);
const columnOf = (p: PlanAdherence): Column => {
  const pct = pctOf(p);
  if (pct == null) return 'new';
  return pct >= 80 ? 'good' : pct >= 50 ? 'mixed' : 'poor';
};
const amount = (n: number | null | undefined, unit: string | null) => (n ? `${Number(n)} ${unit ?? ''}`.trim() : '');

/** The patient's medicines as a board: who is taken, who is skipped — with charts and an AI summary. */
export function AdherenceBoard({ patientId }: { patientId: string }) {
  const a = useAsync(async () => (await unwrap(supabase.rpc('medication_adherence', { p_patient_id: patientId, p_days: 14 }))) as unknown as PlanAdherence[], [patientId]);
  if (a.status === 'loading' && !a.data) return <SkeletonList rows={3} />;
  if (!a.data?.length) return <EmptyState icon={<Pill />} title="لا أدوية بتذكيرات لهذا المريض">تظهر هنا الأدوية التي فعّل المريض تذكيرها، مع ما أخذه وما فاته.</EmptyState>;
  const due = a.data.reduce((s, p) => s + p.due, 0);
  const taken = a.data.reduce((s, p) => s + p.taken, 0);
  const overall = due ? Math.round((taken / due) * 100) : null;

  return (
    <div className="stack">
      <div className="adh-head">
        <Donut taken={taken} skipped={a.data.reduce((s, p) => s + p.skipped, 0)} missed={a.data.reduce((s, p) => s + p.missed, 0)} due={due} size={96} />
        <div className="stack-sm" style={{ gap: 4 }}>
          <strong style={{ fontSize: 'var(--f-h3)' }}>{overall == null ? 'لا جرعات مستحقة بعد' : `الالتزام العام ${overall}٪`}</strong>
          <span className="small muted">آخر 14 يوماً · أخذ {taken} من {due} جرعة · كما سجّلها المريض</span>
          <div className="row small" style={{ gap: 12 }}>
            <span><i className="lg lg-taken" /> أخذها</span><span><i className="lg lg-skipped" /> تخطاها</span><span><i className="lg lg-missed" /> لم يسجّل</span>
          </div>
        </div>
      </div>
      <AiSummary patientId={patientId} />
      <div className="kanban">
        {COLUMNS.map((c) => {
          const cards = a.data!.filter((p) => columnOf(p) === c.id);
          return (
            <section key={c.id} className={`kanban-col kanban-${c.id}`} aria-label={c.title}>
              <header><strong>{c.title}</strong><span className="small muted">{c.hint}</span><Badge tone="neutral">{cards.length}</Badge></header>
              {cards.map((p) => <MedCard key={p.id} p={p} />)}
              {!cards.length && <p className="small muted kanban-empty">—</p>}
            </section>
          );
        })}
      </div>
      <p className="small muted">كما سجّلها المريض على هاتفه («أخذتها» / «تخطي»)؛ ليست تأكيداً طبياً على تناول الدواء.</p>
    </div>
  );
}

function MedCard({ p }: { p: PlanAdherence }) {
  const pct = pctOf(p);
  return (
    <article className="med-card">
      <div className="row" style={{ gap: 10, flexWrap: 'nowrap', alignItems: 'flex-start' }}>
        <Donut taken={p.taken} skipped={p.skipped} missed={p.missed} due={p.due} size={54} label={pct != null ? `${pct}٪` : '—'} />
        <div className="grow" style={{ minWidth: 0 }}>
          <bdi dir="auto" style={{ fontWeight: 700 }}>{p.display_name}</bdi>
          <div className="small muted">{[amount(p.dose, p.dose_unit), p.interval_hours ? `كل ${p.interval_hours} ساعات` : null, p.prescribed ? 'من وصفة' : 'أضافه المريض'].filter(Boolean).join(' · ')}</div>
          <div className="small">أخذ {p.taken}/{p.due}{p.taken_amount ? ` (${amount(p.taken_amount, p.dose_unit)})` : ''}{p.missed ? <b style={{ color: '#C62828' }}> · فاتته {p.missed}</b> : ''}</div>
          {p.last_taken_at && <div className="small muted">آخر جرعة: {formatDateTime(p.last_taken_at)}</div>}
        </div>
      </div>
      {p.recent.length > 0 && (
        <div className="dose-strip" aria-label="آخر 7 أيام">
          {p.recent.map((d, i) => <span key={i} className={`dose-dot dose-${d.state}`}
                                          title={`${formatDateTime(d.at)} — ${d.state === 'taken' ? `أخذها${d.recorded_at ? ` ${formatTime(d.recorded_at)}` : ''}` : d.state === 'skipped' ? 'تخطاها' : d.state === 'missed' ? 'لم يسجّل' : 'قادمة'}`} />)}
        </div>
      )}
    </article>
  );
}

/** Ring chart: taken (green), skipped (amber), missed (red), out of the doses due. */
function Donut({ taken, skipped, missed, due, size, label }: { taken: number; skipped: number; missed: number; due: number; size: number; label?: string }) {
  const r = 15.9155, total = Math.max(due, taken + skipped + missed, 1);
  const parts = [[taken, '#15803D'], [skipped, '#D97706'], [missed, '#C62828']] as const;
  let offset = 25;
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" role="img" aria-label={label ?? `أخذ ${taken} من ${due}`} style={{ flex: 'none' }}>
      <circle cx="21" cy="21" r={r} fill="none" stroke="#E5E9F0" strokeWidth="5" />
      {parts.map(([v, c], i) => {
        if (!v) return null;
        const len = (v / total) * 100;
        const el = <circle key={i} cx="21" cy="21" r={r} fill="none" stroke={c} strokeWidth="5" strokeDasharray={`${len} ${100 - len}`} strokeDashoffset={offset} />;
        offset -= len;
        return el;
      })}
      <text x="21" y="23.5" textAnchor="middle" fontSize={label ? 8 : 0} fontWeight={700} fill="#0E1E2E">{label ?? ''}</text>
    </svg>
  );
}

function AiSummary({ patientId }: { patientId: string }) {
  const [text, setText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    setBusy(true); setError(null);
    const { data, error: err } = await supabase.functions.invoke('ai-chat', { body: { mode: 'adherence', patient_id: patientId } });
    setBusy(false);
    if (err) { setError(await aiErrorMessage(err)); return; }
    setText(String((data as { text?: string })?.text ?? ''));
  };
  return (
    <div className="ai-box card stack-sm" style={{ padding: 'var(--s-3)' }}>
      <div className="row-between">
        <strong className="row" style={{ gap: 6 }}><span className="ai-ico" aria-hidden style={{ width: 28, height: 28 }}><Sparkles size={15} /></span>ملخص الالتزام بالذكاء الاصطناعي</strong>
        <Button size="sm" variant="secondary" loading={busy} onClick={() => void run()}>{text ? 'تحديث الملخص' : 'لخّص لي'}</Button>
      </div>
      {error && <Alert tone="warning">{error}</Alert>}
      {text && <div className="ai-summary" style={{ whiteSpace: 'pre-wrap' }}>{text}</div>}
      {!text && !error && <span className="small muted">يقرأ جرعات آخر 14 يوماً ويعطيك الحكم العام، والأدوية التي تُفوَّت، ونقطة للنقاش مع المريض.</span>}
    </div>
  );
}
