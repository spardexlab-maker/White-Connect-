import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { Check, ShieldCheck } from 'lucide-react';
import { iraqiLocal } from '@app/shared';
import { Ltr } from './ui';

type Stage = 'enter' | 'scatter' | 'verifying' | 'granted';
const LEN = 6;

/**
 * The 6-digit WhatsApp code: one box per digit; when the last digit lands the boxes fly
 * apart, a ring fills while the server checks, then a check mark — or the boxes shake back.
 * `submit` returns an error message, or null when the code was right.
 */
export function OtpVerify({ phone, submit, onDone, onResend, resendIn, onChangeNumber }: {
  phone: string; submit: (code: string) => Promise<string | null>; onDone: () => void;
  onResend: () => void; resendIn: number; onChangeNumber: () => void;
}) {
  const [digits, setDigits] = useState<string[]>(Array(LEN).fill(''));
  const [stage, setStage] = useState<Stage>('enter');
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [pct, setPct] = useState(0);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const done = useRef(onDone);
  done.current = onDone;
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => { if (stage === 'enter') boxes.current[digits.findIndex((d) => !d) === -1 ? LEN - 1 : digits.findIndex((d) => !d)]?.focus(); }, [stage, shake]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (code: string) => {
    setError(null); setStage('scatter');
    await new Promise((r) => setTimeout(r, reduce ? 0 : 650));
    setStage('verifying'); setPct(0);
    // the ring creeps towards 90% while the server answers, then closes
    const t0 = performance.now();
    let raf = 0;
    const tick = () => { setPct(Math.min(90, 90 * (1 - Math.exp(-(performance.now() - t0) / 700)))); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    const [err] = await Promise.all([submit(code), new Promise((r) => setTimeout(r, reduce ? 0 : 900))]);
    cancelAnimationFrame(raf);
    if (err) {
      setError(err); setDigits(Array(LEN).fill('')); setStage('enter'); setShake((n) => n + 1);
      return;
    }
    setPct(100);
    await new Promise((r) => setTimeout(r, reduce ? 0 : 350));
    setStage('granted');
    setTimeout(() => done.current(), reduce ? 300 : 1400);
  };

  const put = (i: number, value: string) => {
    const next = [...digits];
    const typed = value.replace(/\D/g, '');
    if (typed.length > 1) { typed.slice(0, LEN - i).split('').forEach((c, k) => { next[i + k] = c; }); }
    else next[i] = typed;
    setDigits(next); setError(null);
    const firstEmpty = next.findIndex((d) => !d);
    if (firstEmpty === -1) { boxes.current[LEN - 1]?.blur(); void run(next.join('')); }
    else if (typed) boxes.current[Math.min(firstEmpty, i + typed.length)]?.focus();
  };
  const key = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) { e.preventDefault(); const next = [...digits]; next[i - 1] = ''; setDigits(next); boxes.current[i - 1]?.focus(); }
    if (e.key === 'ArrowLeft' && i < LEN - 1) boxes.current[i + 1]?.focus();
    if (e.key === 'ArrowRight' && i > 0) boxes.current[i - 1]?.focus();
  };
  const paste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '');
    if (text.length >= 2) { e.preventDefault(); put(0, text.slice(0, LEN)); }
  };

  const R = 34, C = 2 * Math.PI * R;
  return (
    <div className={`otp-card otp-${stage}`} aria-live="polite">
      {stage === 'granted' ? (
        <div className="otp-head"><strong>تم التحقق</strong><span>أهلاً بك، جارٍ فتح حسابك…</span></div>
      ) : stage === 'verifying' ? (
        <div className="otp-head"><strong>جارٍ التحقق…</strong><span>نتأكد من الرمز بأمان</span></div>
      ) : (
        <div className="otp-head"><strong>أدخل رمز الدخول</strong><span>بعثنا رمزاً من 6 أرقام على واتساب <Ltr>{iraqiLocal(phone)}</Ltr></span></div>
      )}

      <div className="otp-stage">
        {(stage === 'enter' || stage === 'scatter') && (
          <div key={shake} className={`otp-boxes${shake && stage === 'enter' ? ' otp-shake' : ''}`} dir="ltr" role="group" aria-label="رمز الدخول من 6 أرقام">
            {digits.map((d, i) => (
              <input key={i} ref={(el) => { boxes.current[i] = el; }} className={`otp-box${d ? ' filled' : ''}`} style={{ ['--i' as string]: i }}
                     inputMode="numeric" autoComplete={i === 0 ? 'one-time-code' : 'off'} maxLength={i === 0 ? LEN : 1} value={d}
                     aria-label={`الرقم ${i + 1}`} disabled={stage !== 'enter'}
                     onChange={(e) => put(i, e.target.value)} onKeyDown={(e) => key(i, e)} onPaste={paste} onFocus={(e) => e.target.select()} />
            ))}
          </div>
        )}
        {stage === 'verifying' && (
          <svg className="otp-ring" width="92" height="92" viewBox="0 0 92 92" role="img" aria-label={`جارٍ التحقق ${Math.round(pct)}٪`}>
            <circle cx="46" cy="46" r={R} className="otp-ring-track" />
            <circle cx="46" cy="46" r={R} className="otp-ring-fill" strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} transform="rotate(-90 46 46)" />
            <text x="46" y="51" textAnchor="middle" className="otp-ring-txt">{Math.round(pct)}</text>
          </svg>
        )}
        {stage === 'granted' && (
          <div className="otp-granted">
            <span className="otp-pulse" aria-hidden />
            <span className="otp-check"><Check size={30} strokeWidth={3} aria-hidden /></span>
            <span className="otp-pill"><ShieldCheck size={13} aria-hidden /> تم التحقق</span>
          </div>
        )}
      </div>

      {error && stage === 'enter' && <p className="otp-error" role="alert">{error}</p>}
      {stage === 'enter' && (
        <div className="otp-foot">
          <button type="button" className="otp-link" onClick={onChangeNumber}>تغيير الرقم</button>
          <button type="button" className="otp-link" disabled={resendIn > 0} onClick={onResend}>
            {resendIn > 0 ? `إعادة الإرسال بعد ${resendIn} ث` : 'لم يصلك؟ أعد الإرسال'}
          </button>
        </div>
      )}
    </div>
  );
}
