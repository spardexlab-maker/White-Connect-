/** Iraqi mobile numbers for WhatsApp sign-in: 07XX XXX XXXX in any common spelling → +9647XXXXXXXXX. */
const AR_DIGITS = /[٠-٩۰-۹]/g;

export function toIraqiE164(input: string): string | null {
  const d = input
    .replace(AR_DIGITS, (c) => String((c.charCodeAt(0) & 0xf) % 10))
    .replace(/[\s\-().]/g, '')
    .replace(/^\+/, '')
    .replace(/^00/, '');
  const local = d.startsWith('964') ? d.slice(3) : d.startsWith('0') ? d.slice(1) : d;
  return /^7[3-9]\d{8}$/.test(local) ? `+964${local}` : null;
}

/** +9647701234567 → 0770 123 4567 (how people read it). */
export function iraqiLocal(e164: string | null | undefined): string {
  if (!e164) return '';
  const local = e164.replace(/^\+?964/, '');
  return /^7\d{9}$/.test(local) ? `0${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}` : e164;
}
