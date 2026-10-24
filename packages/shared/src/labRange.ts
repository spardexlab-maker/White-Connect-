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

/** Colour family for a result: high / low (red) or normal (blue); null when it cannot be judged. */
export type LabState = 'high' | 'low' | 'normal';
export function labState(i: { value_numeric: number | null; reference_range: string | null; flag?: string | null }): LabState | null {
  if (i.flag === 'high') return 'high';
  if (i.flag === 'low') return 'low';
  const r = parseRange(i.reference_range);
  if (i.value_numeric != null && r) {
    const p = rangePosition(Number(i.value_numeric), r);
    return p === 'above' ? 'high' : p === 'below' ? 'low' : 'normal';
  }
  if (i.flag === 'critical' || i.flag === 'abnormal') return 'high';
  return i.flag ? null : (i.value_numeric != null || i.reference_range ? 'normal' : null);
}
export const labStateLabel: Record<LabState, string> = { high: 'مرتفع', low: 'منخفض', normal: 'طبيعي' };
/** red for out of range (high or low), blue for normal */
export const labStateColor: Record<LabState, string> = { high: '#C62828', low: '#C62828', normal: '#1D4ED8' };
