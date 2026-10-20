import {
  createContext, forwardRef, useCallback, useContext, useEffect, useId, useRef, useState,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, Lock, Maximize2, Minimize2, MoreHorizontal, RefreshCw, WifiOff, X } from 'lucide-react';
import { appointmentStatus, errorMessage, queueStatus, type AppointmentStatus, type QueueStatus, type Tone } from '@app/shared';
import { useOnline } from '../lib/useOnline';

/* ------------------------------------------------------------------ */
/* Button                                                              */
/* ------------------------------------------------------------------ */
type Variant = 'primary' | 'accent' | 'secondary' | 'soft' | 'ghost' | 'danger';
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'md' | 'sm' | 'lg';
  block?: boolean;
  loading?: boolean;
  icon?: ReactNode;
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', block, loading, icon, children, className = '', disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`btn btn-${variant} ${size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : ''} ${block ? 'btn-block' : ''} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="spinner" aria-hidden /> : icon}
      {children}
    </button>
  );
});

/* ------------------------------------------------------------------ */
/* Form fields (persistent labels, inline errors — §25)               */
/* ------------------------------------------------------------------ */
interface FieldShellProps { label: string; hint?: string; error?: string; children: (id: string, describedBy?: string) => ReactNode; optional?: boolean }
export function FieldShell({ label, hint, error, optional, children }: FieldShellProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(' ') || undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}{optional && <span className="muted small"> (اختياري)</span>}</label>
      {children(id, describedBy)}
      {hint && <span id={hintId} className="hint">{hint}</span>}
      {error && <span id={errId} className="error" role="alert"><AlertCircle size={14} aria-hidden />{error}</span>}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string; optional?: boolean; ltr?: boolean };
export const TextField = forwardRef<HTMLInputElement, InputProps>(function TextField({ label, hint, error, optional, ltr, className = '', ...rest }, ref) {
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional}>
      {(id, describedBy) => (
        <input ref={ref} id={id} className={`input ${ltr ? 'input-ltr' : ''} ${className}`} aria-invalid={error ? true : undefined}
               aria-describedby={describedBy} dir={ltr ? 'ltr' : undefined} {...rest} />
      )}
    </FieldShell>
  );
});

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: string; error?: string; optional?: boolean };
export function SelectField({ label, hint, error, optional, children, ...rest }: SelectProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional}>
      {(id, describedBy) => (
        <select id={id} className="select" aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...rest}>{children}</select>
      )}
    </FieldShell>
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string; error?: string; optional?: boolean };
export function TextareaField({ label, hint, error, optional, ...rest }: TextareaProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional}>
      {(id, describedBy) => (
        <textarea id={id} className="textarea" aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...rest} />
      )}
    </FieldShell>
  );
}

/* ------------------------------------------------------------------ */
/* Badges                                                              */
/* ------------------------------------------------------------------ */
export function Badge({ tone = 'neutral', children, icon }: { tone?: Tone; children: ReactNode; icon?: ReactNode }) {
  return <span className={`badge tone-${tone}`}>{icon}{children}</span>;
}

const toneIcon: Partial<Record<Tone, ReactNode>> = {
  success: <CheckCircle2 aria-hidden />,
  warning: <AlertTriangle aria-hidden />,
  danger: <AlertCircle aria-hidden />,
  info: <Info aria-hidden />,
};

/** Status is always text + icon, never colour alone. */
export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  const s = appointmentStatus[status];
  return <Badge tone={s.tone} icon={toneIcon[s.tone]}>{s.label}</Badge>;
}
export function QueueStatusBadge({ status }: { status: QueueStatus }) {
  const s = queueStatus[status];
  return <Badge tone={s.tone} icon={toneIcon[s.tone]}>{s.label}</Badge>;
}

/* ------------------------------------------------------------------ */
/* Alerts & states                                                     */
/* ------------------------------------------------------------------ */
export function Alert({ tone = 'info', title, children, action }: { tone?: 'info' | 'success' | 'warning' | 'danger'; title?: string; children?: ReactNode; action?: ReactNode }) {
  const icon = { info: <Info size={18} />, success: <CheckCircle2 size={18} />, warning: <AlertTriangle size={18} />, danger: <AlertCircle size={18} /> }[tone];
  return (
    <div className={`alert alert-${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      {icon}
      <div className="grow stack-sm" style={{ gap: 2 }}>
        {title && <strong>{title}</strong>}
        {children && <div className="small">{children}</div>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="state">
      <div className="state-icon" aria-hidden>{icon}</div>
      <h3>{title}</h3>
      {children && <p className="small">{children}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="state" role="alert">
      <div className="state-icon" style={{ color: 'var(--c-danger)', background: 'var(--c-danger-soft)' }} aria-hidden><AlertCircle /></div>
      <h3>تعذّر تحميل البيانات</h3>
      <p className="small">{errorMessage(error)}</p>
      {onRetry && <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={onRetry}>إعادة المحاولة</Button>}
    </div>
  );
}

export function PermissionDenied({ children }: { children?: ReactNode }) {
  return (
    <div className="state">
      <div className="state-icon" aria-hidden><Lock /></div>
      <h3>لا تملك صلاحية لعرض هذه الصفحة</h3>
      <p className="small">{children ?? 'إذا كنت تعتقد أن هذا خطأ، اطلب من مدير المنشأة مراجعة دورك.'}</p>
    </div>
  );
}

export function Skeleton({ height = 16, width = '100%', style }: { height?: number; width?: number | string; style?: React.CSSProperties }) {
  return <div className="skeleton" style={{ height, width, ...style }} aria-hidden />;
}

export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="stack" aria-busy="true" aria-label="جارٍ التحميل" style={{ padding: 'var(--s-4)' }}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="row" style={{ flexWrap: 'nowrap' }}>
          <Skeleton height={44} width={44} />
          <div className="grow stack-sm"><Skeleton width="60%" /><Skeleton width="35%" height={12} /></div>
        </div>
      ))}
    </div>
  );
}

export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div className="offline-banner" role="status">
      <WifiOff size={16} aria-hidden /> لا يوجد اتصال بالشبكة — العمليات التي تحتاج الخادم معطّلة حتى يعود الاتصال.
    </div>
  );
}

/** LTR-isolated text for phone numbers, codes and IDs inside RTL text. */
export function Ltr({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <bdi dir="ltr" className={`ltr num ${className}`}>{children}</bdi>;
}

/* ------------------------------------------------------------------ */
/* Tabs                                                                */
/* ------------------------------------------------------------------ */
export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: { id: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div role="tablist" aria-label={label} className="tabs">
      {tabs.map((t, i) => (
        <button
          key={t.id}
          ref={(el) => { refs.current[i] = el; }}
          role="tab"
          id={`tab-${t.id}`}
          aria-selected={value === t.id}
          aria-controls={`panel-${t.id}`}
          tabIndex={value === t.id ? 0 : -1}
          className="tab"
          onClick={() => onChange(t.id)}
          onKeyDown={(e) => {
            // RTL: ArrowLeft moves forward
            const dir = e.key === 'ArrowLeft' ? 1 : e.key === 'ArrowRight' ? -1 : 0;
            if (!dir) return;
            const next = (i + dir + tabs.length) % tabs.length;
            refs.current[next]?.focus();
            onChange(tabs[next].id);
          }}
        >{t.label}</button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sheet & dialog (focus trapped, Esc closes)                          */
/* ------------------------------------------------------------------ */
function useFocusTrap(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const focusables = () => Array.from(node?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? [])
      .filter((el) => !el.hasAttribute('disabled'));
    (node?.querySelector<HTMLElement>('[data-autofocus]') ?? focusables()[0])?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      if (e.key === 'Tab') {
        const els = focusables();
        if (!els.length) return;
        const first = els[0], last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; previous?.focus(); };
  }, [open, onClose]);
  return ref;
}

const SHEET_PREF = 'wc.sheet.expanded';
function readSheetPref(): boolean { try { return localStorage.getItem(SHEET_PREF) === '1'; } catch { return false; } }

/**
 * Side panel. `size="lg"` for work panels (pharmacy, lab, medical card).
 * The expand button turns it into a large centred window; the choice is
 * remembered on this device.
 */
export function Sheet({ open, onClose, title, children, footer, size = 'md' }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; size?: 'md' | 'lg' }) {
  const ref = useFocusTrap(open, onClose);
  const [expanded, setExpanded] = useState(readSheetPref);
  if (!open) return null;
  const toggle = () => { const v = !expanded; setExpanded(v); try { localStorage.setItem(SHEET_PREF, v ? '1' : '0'); } catch { /* storage unavailable */ } };
  // portalled to <body>: an animated (transformed) page would otherwise trap position:fixed and clip the panel
  return createPortal(
    <>
      <div className="overlay" onClick={onClose} aria-hidden />
      <div ref={ref} className={`sheet sheet-${size}${expanded ? ' is-expanded' : ''}`} role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <div className="sheet-header">
          <h2 id="sheet-title" style={{ fontSize: 'var(--f-h3)' }}>{title}</h2>
          <div className="row" style={{ gap: 'var(--s-1)' }}>
            <button className="icon-btn sheet-expand" onClick={toggle} aria-pressed={expanded} aria-label={expanded ? 'تصغير اللوحة' : 'تكبير اللوحة'} title={expanded ? 'تصغير' : 'تكبير'}>
              {expanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button className="icon-btn" onClick={onClose} aria-label="إغلاق"><X size={20} /></button>
          </div>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-footer">{footer}</div>}
      </div>
    </>,
    document.body,
  );
}

export function ConfirmDialog({ open, title, children, confirmLabel, tone = 'primary', onConfirm, onCancel, loading }: {
  open: boolean; title: string; children: ReactNode; confirmLabel: string; tone?: 'primary' | 'danger';
  onConfirm: () => void; onCancel: () => void; loading?: boolean;
}) {
  const ref = useFocusTrap(open, onCancel);
  if (!open) return null;
  return createPortal(
    <>
      <div className="overlay" onClick={onCancel} aria-hidden />
      <div ref={ref} className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dlg-title" aria-describedby="dlg-body">
        <h2 id="dlg-title" style={{ fontSize: 'var(--f-h3)' }}>{title}</h2>
        <div id="dlg-body" className="stack-sm">{children}</div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={onCancel} data-autofocus>تراجع</Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/* Toasts (polite; never cover typing)                                 */
/* ------------------------------------------------------------------ */
interface ToastItem { id: number; text: string; tone: 'default' | 'success' | 'danger' }
const ToastCtx = createContext<(text: string, tone?: ToastItem['tone']) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((text: string, tone: ToastItem['tone'] = 'default') => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs, { id, text, tone }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 5000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite" aria-atomic="false">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.tone !== 'default' ? `toast-${t.tone}` : ''}`}>
            {t.tone === 'success' ? <CheckCircle2 size={18} aria-hidden /> : t.tone === 'danger' ? <AlertCircle size={18} aria-hidden /> : <Info size={18} aria-hidden />}
            <span className="grow">{t.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

export function Avatar({ name, size = 'md', src }: { name: string; size?: 'sm' | 'md' | 'lg'; src?: string | null }) {
  const initials = name.replace(/^(د\.|مختبر)\s*/, '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('');
  return <div className={`avatar ${size === 'lg' ? 'avatar-lg' : size === 'sm' ? 'avatar-sm' : ''}`} aria-hidden>{src ? <img src={src} alt="" /> : initials}</div>;
}

/** Animated check — render only after the server confirmed the action. */
export function SuccessMark() {
  return (
    <span className="success-mark" aria-hidden>
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
    </span>
  );
}

export function Stat({ value, label, icon }: { value: ReactNode; label: string; icon?: ReactNode }) {
  return <div className="stat"><span className="v">{value}</span><span className="l">{icon}{label}</span></div>;
}

export function PageHead({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="w-page-head">
      <div className="stack-sm" style={{ gap: 2 }}>
        <h1>{title}</h1>
        {subtitle && <div className="muted small">{subtitle}</div>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Menu (secondary actions; keyboard: arrows, Home/End, Esc)           */
/* ------------------------------------------------------------------ */
export interface MenuItem { label: string; icon?: ReactNode; onSelect: () => void; tone?: 'danger' }
export function Menu({ label, items, triggerLabel = 'المزيد' }: { label: string; items: MenuItem[]; triggerLabel?: string }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    if (!open) return;
    itemRefs.current[0]?.focus();
    const onDown = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);
  const close = (focusTrigger = true) => { setOpen(false); if (focusTrigger) trigger.current?.focus(); };
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const n = items.length;
    const go = (j: number) => { e.preventDefault(); itemRefs.current[(j + n) % n]?.focus(); };
    if (e.key === 'ArrowDown') go(i + 1);
    else if (e.key === 'ArrowUp') go(i - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(n - 1);
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'Tab') close(false);
  };
  if (!items.length) return null;
  return (
    <div className="menu" ref={wrap}>
      <button ref={trigger} type="button" className="btn btn-ghost btn-sm" aria-haspopup="menu" aria-expanded={open} aria-label={`${triggerLabel} — ${label}`}
              onClick={() => setOpen((v) => !v)}>
        <MoreHorizontal size={18} aria-hidden /><span className="hide-sm">{triggerLabel}</span>
      </button>
      {open && (
        <div className="menu-pop" role="menu" aria-label={label}>
          {items.map((it, i) => (
            <button key={it.label} ref={(el) => { itemRefs.current[i] = el; }} type="button" role="menuitem" tabIndex={-1}
                    className={`menu-item ${it.tone === 'danger' ? 'danger' : ''}`} onKeyDown={(e) => onKey(e, i)}
                    onClick={() => { close(false); it.onSelect(); }}>
              {it.icon}{it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
