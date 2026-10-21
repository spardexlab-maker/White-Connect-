/** Iraqi month names (كانون الثاني = January). */
export const monthNamesIq = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];

export interface DateParts { y: number | null; m: number | null; d: number | null }

export const daysInMonth = (y: number | null, m: number | null) => (m ? new Date(y ?? 2000, m, 0).getDate() : 31);

/** 'YYYY-MM-DD' → parts (empty / invalid → all null). */
export function splitIsoDate(iso: string | null | undefined): DateParts {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  return m ? { y: +m[1], m: +m[2], d: +m[3] } : { y: null, m: null, d: null };
}

/** Parts → 'YYYY-MM-DD' once all three are chosen (day clamped to the month), else ''. */
export function joinIsoDate(p: DateParts): string {
  if (!p.y || !p.m || !p.d) return '';
  const d = Math.min(p.d, daysInMonth(p.y, p.m));
  return `${p.y}-${String(p.m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Years for a birth date picker: this year back to `oldest`. */
export const birthYears = (oldest = 1920) => {
  const now = new Date().getFullYear();
  return Array.from({ length: now - oldest + 1 }, (_, i) => now - i);
};

/** «15 أيار 1985» */
export const formatBirthDate = (iso: string | null | undefined) => {
  const p = splitIsoDate(iso);
  return p.y && p.m && p.d ? `${p.d} ${monthNamesIq[p.m - 1]} ${p.y}` : '';
};
