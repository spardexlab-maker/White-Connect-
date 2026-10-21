import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FlaskConical, PhoneCall, Sparkles, Stethoscope } from 'lucide-react';
import { aiErrorMessage, aiTriageDisclaimer, type AiTriage } from '@app/shared';
import { supabase } from '../lib/supabase';
import { Alert, Badge, Button } from './ui';

/** «كيف نساعدك اليوم؟» — describe a complaint, get the specialty to visit; the parent shows the nearest ones. */
export function AiAssist({ signedIn, onDoctors, onLabs }: { signedIn: boolean; onDoctors: (specialtyId: string) => void; onLabs: () => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<AiTriage | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const ask = async () => {
    if (text.trim().length < 3) { setErr('اكتب ما تشعر به بجملة قصيرة.'); return; }
    setBusy(true); setErr(null); setRes(null);
    const { data, error } = await supabase.functions.invoke('ai-triage', { body: { text: text.trim() } });
    setBusy(false);
    if (error) setErr(await aiErrorMessage(error)); else setRes(data as AiTriage);
  };

  return (
    <section className="card stack ai-box" aria-labelledby="ai-title">
      <div className="row" style={{ gap: 'var(--s-2)' }}>
        <span className="ai-ico" aria-hidden><Sparkles size={18} /></span>
        <div className="grow">
          <h2 id="ai-title" className="section-title" style={{ margin: 0 }}>المساعد الذكي</h2>
          <div className="muted small">اكتب ما تعاني منه، ونقترح عليك أي طبيب أو مختبر تراجع — والأقرب إليك.</div>
        </div>
      </div>
      {!signedIn ? (
        <div className="small"><Link to="/patient/account">سجّل الدخول</Link> لاستخدام المساعد الذكي.</div>
      ) : (
        <>
          <label className="sr-only" htmlFor="ai-text">صف ما تشعر به</label>
          <textarea id="ai-text" className="input" rows={2} maxLength={600} value={text} onChange={(e) => setText(e.target.value)}
                    placeholder="مثال: عندي صداع وتعب من أسبوع، أو: ابني عنده حرارة وكحة"
                    onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) ask(); }} />
          <div className="row-between">
            <span className="muted small" style={{ maxWidth: 560 }}>{aiTriageDisclaimer}</span>
            <Button icon={<Sparkles size={16} />} loading={busy} onClick={ask}>اقترح لي</Button>
          </div>
        </>
      )}
      {err && <Alert tone="warning">{err}</Alert>}
      {res && (
        <div className="stack-sm ai-result" aria-live="polite">
          {res.emergency && (
            <Alert tone="danger" title="توجّه فوراً لأقرب طوارئ">
              {res.emergency_reason} لا تنتظر موعداً — اتصل بالإسعاف <a href="tel:122"><PhoneCall size={14} aria-hidden /> 122</a> أو اذهب لأقرب مستشفى.
            </Alert>
          )}
          {(res.specialty || res.suggested_specialty) && (
            <div className="row" style={{ gap: 'var(--s-2)' }}>
              <span className="muted">التخصص المقترح:</span>
              <strong>{res.suggested_specialty || res.specialty?.name}</strong>
              {res.specialty && res.suggested_specialty && res.specialty.name !== res.suggested_specialty && <span className="muted small">(الأقرب المتاح: {res.specialty.name})</span>}
            </div>
          )}
          {res.advice && <p style={{ margin: 0 }}>{res.advice}</p>}
          {!!res.lab_tests.length && (
            <div className="row" style={{ gap: 6 }}>
              <span className="muted small">تحاليل قد يطلبها الطبيب:</span>
              {res.lab_tests.map((t) => <Badge key={t} tone="info">{t}</Badge>)}
            </div>
          )}
          {res.follow_up_question && <div className="small muted">لنتائج أدق: {res.follow_up_question}</div>}
          <div className="row" style={{ gap: 'var(--s-2)' }}>
            {res.specialty && <Button icon={<Stethoscope size={16} />} onClick={() => onDoctors(res.specialty!.id)}>أقرب أطباء {res.specialty.name}</Button>}
            {!!res.lab_tests.length && <Button variant="secondary" icon={<FlaskConical size={16} />} onClick={onLabs}>أقرب المختبرات</Button>}
          </div>
        </div>
      )}
    </section>
  );
}
