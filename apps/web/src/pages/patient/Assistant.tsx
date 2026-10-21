import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FlaskConical, Mic, PhoneCall, Send, Sparkles, Square, Stethoscope, Volume2, VolumeX } from 'lucide-react';
import { aiChatDisclaimer, aiChatStarters, errorMessage, visibleAnswer, type ChatSuggestion } from '@app/shared';
import { startRecording, streamChat, transcribe } from '../../lib/aiChat';
import { useAuth } from '../../lib/auth';
import { Alert, Badge, Button } from '../../components/ui';
import { SignInPrompt } from './Account';

interface Bubble { id: number; role: 'user' | 'model'; text: string; streaming?: boolean; error?: string; suggestion?: ChatSuggestion; emergency?: boolean }
const MAX_RECORDING_MS = 60_000;
const message = (e: unknown) => {
  const m = String((e as Error)?.message ?? '');
  return m.startsWith('app:') || /network|fetch/i.test(m) ? errorMessage(e) : m || errorMessage(e);
};

/** «المساعد الذكي» — speak or type; the answer streams in as it is written (like Gemini). */
export function AssistantPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [msgs, setMsgs] = useState<Bubble[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'recording' | 'transcribing'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [speaking, setSpeaking] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const recorder = useRef<Awaited<ReturnType<typeof startRecording>> | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  const msgsRef = useRef<Bubble[]>([]);
  useEffect(() => { msgsRef.current = msgs; }, [msgs]);
  const patch = (id: number, f: (b: Bubble) => Bubble) => setMsgs((all) => all.map((b) => (b.id === id ? f(b) : b)));
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [msgs]);

  const send = useCallback(async (raw: string) => {
    const said = raw.trim();
    if (!said || busy) return;
    setNotice(null); setText(''); setBusy(true);
    const user: Bubble = { id: nextId.current++, role: 'user', text: said };
    const answer: Bubble = { id: nextId.current++, role: 'model', text: '', streaming: true };
    // built from the ref, not inside the state updater: React may run that updater later
    const history = [...msgsRef.current, user].filter((b) => !b.error && b.text)
      .map((b) => ({ role: b.role, text: b.role === 'model' ? visibleAnswer(b.text) : b.text }));
    setMsgs((all) => [...all, user, answer]);
    try {
      await streamChat(history, (e) => {
        if ('t' in e) patch(answer.id, (b) => ({ ...b, text: b.text + e.t }));
        else if ('meta' in e) patch(answer.id, (b) => ({ ...b, emergency: b.emergency || e.meta.emergency }));
        else if ('done' in e) patch(answer.id, (b) => ({ ...b, streaming: false, suggestion: { specialty: e.specialty, labs: e.labs, emergency: e.emergency } }));
        else if ('error' in e) patch(answer.id, (b) => ({ ...b, streaming: false, error: errorMessage({ message: `app:${e.error}` }) }));
      });
      patch(answer.id, (b) => ({ ...b, streaming: false }));
    } catch (e) {
      patch(answer.id, (b) => ({ ...b, streaming: false, error: message(e) }));
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const record = async () => {
    setNotice(null);
    try {
      window.speechSynthesis?.cancel(); setSpeaking(null);
      recorder.current = await startRecording();
      setElapsed(0); setPhase('recording');
    } catch {
      setNotice('اسمح للموقع باستخدام المايكروفون (من شريط العنوان) حتى تحجي ويا المساعد.');
    }
  };

  const stop = useCallback(async () => {
    if (phase !== 'recording' || !recorder.current) return;
    setPhase('transcribing');
    try {
      const blob = await recorder.current.stop();
      recorder.current = null;
      const said = await transcribe(blob);
      if (!said) { setNotice('ما سمعت كلام واضح — حاول مرة ثانية واحجي قريب من المايك.'); return; }
      await send(said);
    } catch (e) {
      setNotice(message(e));
    } finally {
      setPhase('idle');
    }
  }, [phase, send]);

  useEffect(() => {
    if (phase !== 'recording') return;
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);
  useEffect(() => { if (phase === 'recording' && elapsed * 1000 >= MAX_RECORDING_MS) void stop(); }, [elapsed, phase, stop]);
  useEffect(() => () => { recorder.current?.cancel(); window.speechSynthesis?.cancel(); }, []);

  // opened from the home page with a first message or straight into voice
  const started = useRef(false);
  useEffect(() => {
    if (started.current || !session) return;
    started.current = true;
    const q = params.get('q');
    if (q) void send(q); else if (params.get('voice') === '1') void record();
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  const speak = (b: Bubble) => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    if (speaking === b.id) { synth.cancel(); setSpeaking(null); return; }
    synth.cancel();
    const u = new SpeechSynthesisUtterance(visibleAnswer(b.text));
    u.lang = 'ar';
    u.onend = () => setSpeaking(null); u.onerror = () => setSpeaking(null);
    setSpeaking(b.id); synth.speak(u);
  };

  const submit = (e: FormEvent) => { e.preventDefault(); void send(text); };

  if (!session) return <SignInPrompt title="المساعد الذكي" />;

  return (
    <div className="chat">
      <div className="chat-log" aria-live="polite">
        <p className="muted small chat-note">{aiChatDisclaimer}</p>
        {msgs.length === 0 && (
          <div className="chat-empty">
            <span className="ai-ico ai-ico-lg" aria-hidden><Sparkles size={28} /></span>
            <h1>شنو تحس؟ احجيلي</h1>
            <p className="muted">دوس على المايك واحجي، أو اكتب. أساعدك تعرف أي طبيب أو مختبر تراجع، وأعرضلك الأقرب.</p>
            <div className="row" style={{ justifyContent: 'center', gap: 8 }}>
              {aiChatStarters.map((s) => <button key={s} type="button" className="chip" onClick={() => void send(s)}>{s}</button>)}
            </div>
          </div>
        )}
        {msgs.map((b) => (b.role === 'user' ? (
          <div key={b.id} className="bubble bubble-user">{b.text}</div>
        ) : (
          <div key={b.id} className="bubble-wrap">
            <div className="bubble bubble-ai">
              {b.emergency && (
                <Alert tone="danger" title="توجّه فوراً لأقرب طوارئ"
                       action={<a className="btn btn-danger btn-sm" href="tel:122"><PhoneCall size={14} aria-hidden /> اتصل 122</a>}>
                  لا تنتظر موعداً — اتصل بالإسعاف أو اذهب لأقرب مستشفى.
                </Alert>
              )}
              {b.text ? <p className="chat-text">{visibleAnswer(b.text)}{b.streaming && <span className="caret" aria-hidden>▍</span>}</p>
                : b.streaming ? <p className="muted small">يكتب…</p> : null}
              {b.error && <Alert tone="warning">{b.error}</Alert>}
              {!b.streaming && !!b.text && 'speechSynthesis' in window && (
                <button type="button" className="link-btn small" onClick={() => speak(b)}>
                  {speaking === b.id ? <><VolumeX size={15} aria-hidden /> إيقاف</> : <><Volume2 size={15} aria-hidden /> استمع</>}
                </button>
              )}
            </div>
            {!b.streaming && b.suggestion && (b.suggestion.specialty || b.suggestion.labs.length > 0) && (
              <div className="stack-sm">
                {b.suggestion.labs.length > 0 && (
                  <div className="row" style={{ gap: 6 }}><span className="muted small">تحاليل قد يطلبها الطبيب:</span>{b.suggestion.labs.map((t) => <Badge key={t} tone="info">{t}</Badge>)}</div>
                )}
                <div className="row" style={{ gap: 8 }}>
                  {b.suggestion.specialty && (
                    <Button icon={<Stethoscope size={16} />} onClick={() => navigate(`/patient?kind=doctor&specialty=${b.suggestion!.specialty!.id}`)}>
                      أقرب أطباء {b.suggestion.specialty.name}
                    </Button>
                  )}
                  {b.suggestion.labs.length > 0 && (
                    <Button variant="secondary" icon={<FlaskConical size={16} />} onClick={() => navigate('/patient?kind=laboratory')}>أقرب المختبرات</Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )))}
        {notice && <Alert tone="warning">{notice}</Alert>}
        <div ref={endRef} />
      </div>

      <form className="chat-composer" onSubmit={submit}>
        {phase === 'recording' ? (
          <>
            <span className="rec-dot" aria-hidden />
            <span className="grow">يسجّل… {elapsed} ث — احجي وبعدين دوس إيقاف</span>
            <button type="button" className="round-btn round-danger" onClick={() => void stop()} aria-label="إيقاف التسجيل والإرسال"><Square size={18} fill="currentColor" /></button>
          </>
        ) : phase === 'transcribing' ? (
          <span className="grow muted" style={{ textAlign: 'center' }}>جاري فهم كلامك…</span>
        ) : (
          <>
            <button type="button" className="round-btn round-accent" onClick={() => void record()} disabled={busy} aria-label="احجي ويا المساعد"><Mic size={22} /></button>
            <label className="sr-only" htmlFor="chat-input">رسالتك للمساعد</label>
            <textarea id="chat-input" className="input grow" rows={1} maxLength={1000} placeholder="اكتب شنو تحس…" value={text}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(text); } }} />
            <button type="submit" className="round-btn round-primary" disabled={busy || !text.trim()} aria-label="إرسال"><Send size={20} style={{ transform: 'scaleX(-1)' }} /></button>
          </>
        )}
      </form>
    </div>
  );
}
