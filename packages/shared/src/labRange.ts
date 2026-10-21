/**
 * Reading a lab's reference range text into numbers so a result can be
 * drawn against it ("70-100", "4.0 - 5.6", "أقل من 100", "<5", ">30").
 * Returns null when the text is not a simple numeric range — then nothing
 * is drawn. Placement on a bar is a numeric comparison, not an interpretation.
 */
export interface NumRange { low: number | null; high: number | null }

const num = (s: string) => Number(s.replace(',', '.'));

export function parseRange(text: string | null | undefined): NumRange | null {
  if (!text) return null;
  const t = text.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).trim();
  let m = t.match(/(-?\d+(?:[.,]\d+)?)\s*[-–—]\s*(-?\d+(?:[.,]\d+)?)/);
  if (m) { const a = num(m[1]), b = num(m[2]); return a < b ? { low: a, high: b } : null; }
  m = t.match(/(?:أقل من|اقل من|<\s*=?|≤|up to|less than)\s*(-?\d+(?:[.,]\d+)?)/i);
  if (m) return { low: null, high: num(m[1]) };
  m = t.match(/(?:أكثر من|اكثر من|أعلى من|>\s*=?|≥|more than|greater than)\s*(-?\d+(?:[.,]\d+)?)/i);
  if (m) return { low: num(m[1]), high: null };
  return null;
}

export type RangePosition = 'below' | 'within' | 'above';

export function rangePosition(value: number, r: NumRange): RangePosition {
  if (r.low != null && value < r.low) return 'below';
  if (r.high != null && value > r.high) return 'above';
  return 'within';
}

export const rangePositionLabel: Record<RangePosition, string> = {
  below: 'أقل من المرجع', within: 'ضمن المرجع', above: 'أعلى من المرجع',
};

/** Axis bounds that keep the reference band and every value in view. */
export function chartDomain(values: number[], r: NumRange | null): [number, number] {
  const pts = [...values, ...(r?.low != null ? [r.low] : []), ...(r?.high != null ? [r.high] : [])];
  let lo = Math.min(...pts), hi = Math.max(...pts);
  if (lo === hi) { lo -= Math.abs(lo) * 0.2 || 1; hi += Math.abs(hi) * 0.2 || 1; }
  const pad = (hi - lo) * 0.15;
  return [Math.max(lo - pad, Math.min(...pts) >= 0 ? 0 : lo - pad), hi + pad];
}
