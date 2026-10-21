import { useEffect, useId, useState } from 'react';
import { birthYears, daysInMonth, joinIsoDate, monthNamesIq, splitIsoDate, type DateParts } from '@app/shared';

/** Birth date as three dropdowns (day · month · year) — no typing, no long calendar scrolling. */
export function BirthDateSelect({ label = 'تاريخ الميلاد', value, onChange, optional, error }: {
  label?: string; value: string; onChange: (iso: string) => void; optional?: boolean; error?: string;
}) {
  const id = useId();
  const [p, setP] = useState<DateParts>(() => splitIsoDate(value));
  useEffect(() => { if (value) setP(splitIsoDate(value)); }, [value]);
  const set = (next: DateParts) => { setP(next); onChange(joinIsoDate(next)); };
  const num = (v: string) => (v ? Number(v) : null);
  return (
    <fieldset className="field birth-select" aria-describedby={error ? `${id}-err` : undefined}>
      <legend>{label}{optional && <span className="muted small"> (اختياري)</span>}</legend>
      <div className="birth-select-row">
        <select className="select" aria-label="اليوم" value={p.d ?? ''} onChange={(e) => set({ ...p, d: num(e.target.value) })}>
          <option value="">اليوم</option>
          {Array.from({ length: daysInMonth(p.y, p.m) }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
        </select>
        <select className="select" aria-label="الشهر" value={p.m ?? ''} onChange={(e) => set({ ...p, m: num(e.target.value) })}>
          <option value="">الشهر</option>
          {monthNamesIq.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
        </select>
        <select className="select" aria-label="السنة" value={p.y ?? ''} onChange={(e) => set({ ...p, y: num(e.target.value) })}>
          <option value="">السنة</option>
          {birthYears().map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      {error && <span id={`${id}-err`} className="error" role="alert">{error}</span>}
    </fieldset>
  );
}
