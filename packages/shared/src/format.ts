import { productDefaults } from './config';

const tz: string = productDefaults.defaultTimezone;

/** IQD has no minor unit in daily use: amount_minor == dinars. Integer math only. */
export function formatMoney(amountMinor: number | null | undefined, currency = 'IQD'): string {
  if (amountMinor == null) return '—';
  const n = new Intl.NumberFormat('ar-IQ', { maximumFractionDigits: 0 }).format(amountMinor);
  return currency === 'IQD' ? `${n} د.ع` : `${n} ${currency}`;
}

export function formatTime(iso: string | Date, timeZone = tz): string {
  return new Intl.DateTimeFormat('ar-IQ', { hour: 'numeric', minute: '2-digit', timeZone }).format(new Date(iso));
}

export function formatDate(iso: string | Date, timeZone = tz): string {
  return new Intl.DateTimeFormat('ar-IQ', { weekday: 'long', day: 'numeric', month: 'long', timeZone }).format(new Date(iso));
}

export function formatDateShort(iso: string | Date, timeZone = tz): string {
  return new Intl.DateTimeFormat('ar-IQ', { day: 'numeric', month: 'short', timeZone }).format(new Date(iso));
}

export function formatDateTime(iso: string | Date, timeZone = tz): string {
  return `${formatDate(iso, timeZone)} — ${formatTime(iso, timeZone)}`;
}

/** YYYY-MM-DD of an instant in a timezone. */
export function localDateKey(d: Date, timeZone = tz): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function addDays(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function weekdayOf(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function minutesBetween(a: string | Date, b: string | Date): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);
}
