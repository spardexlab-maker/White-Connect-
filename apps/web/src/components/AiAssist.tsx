import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Send, Sparkles } from 'lucide-react';

/** «المساعد الذكي» on the home page: type or tap the mic — the conversation opens on its own page. */
export function AiAssist() {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const go = (e?: FormEvent) => {
    e?.preventDefault();
    const q = text.trim();
    navigate(q ? `/patient/assistant?q=${encodeURIComponent(q)}` : '/patient/assistant');
  };
  return (
    <section className="card stack ai-box" aria-labelledby="ai-title">
      <div className="row" style={{ gap: 'var(--s-2)' }}>
        <span className="ai-ico" aria-hidden><Sparkles size={18} /></span>
        <div className="grow">
          <h2 id="ai-title" className="section-title" style={{ margin: 0 }}>المساعد الذكي</h2>
          <div className="muted small">احجي أو اكتب شنو تعاني، ونقترحلك أي طبيب أو مختبر تراجع — والأقرب إليك.</div>
        </div>
      </div>
      <form className="row" style={{ gap: 'var(--s-2)', flexWrap: 'nowrap' }} onSubmit={go}>
        <button type="button" className="round-btn round-accent" onClick={() => navigate('/patient/assistant?voice=1')} aria-label="احجي ويا المساعد"><Mic size={22} /></button>
        <label className="sr-only" htmlFor="ai-text">اكتب للمساعد</label>
        <input id="ai-text" className="input grow" placeholder="مثال: عندي صداع من أسبوع" value={text} onChange={(e) => setText(e.target.value)} />
        <button type="submit" className="round-btn round-primary" aria-label="ابدأ المحادثة"><Send size={20} style={{ transform: 'scaleX(-1)' }} /></button>
      </form>
    </section>
  );
}
