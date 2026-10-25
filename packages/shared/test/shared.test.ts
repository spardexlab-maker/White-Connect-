import { describe, expect, it } from 'vitest';
import { color, contrastPairs, contrastRatio } from '../src/tokens';
import { errorMessage } from '../src/errors';
import { addDays, formatMoney, localDateKey, weekdayOf } from '../src/format';
import { quickBookingSchema } from '../src/validation';
import { iraqiLocal, toIraqiE164 } from '../src/phone';

describe('design tokens', () => {
  it.each(contrastPairs)('%s on %s reaches WCAG AA 4.5:1', (fg, bg) => {
    expect(contrastRatio(color[fg], color[bg])).toBeGreaterThanOrEqual(4.5);
  });
});

describe('validation', () => {
  it('name-only booking is valid with just a name', () => {
    expect(quickBookingSchema.safeParse({ fullName: 'كريم' }).success).toBe(true);
  });
  it('empty name is rejected', () => {
    expect(quickBookingSchema.safeParse({ fullName: '   ' }).success).toBe(false);
  });
});

describe('errors and formatting', () => {
  it('maps server codes and hides raw messages', () => {
    expect(errorMessage({ message: 'app:slot_unavailable' })).toContain('لم يعد متاحاً');
    expect(errorMessage({ message: 'duplicate key value violates unique constraint "x"' })).toBe('حدث خطأ غير متوقع. أعد المحاولة.');
  });
  it('money uses integer IQD formatting', () => {
    expect(formatMoney(25000)).toContain('د.ع');
  });
  it('date keys are timezone aware', () => {
    // 22:30 UTC is already the next day in Baghdad (UTC+3)
    expect(localDateKey(new Date('2026-10-18T22:30:00Z'))).toBe('2026-10-19');
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(weekdayOf('2026-10-18')).toBe(0);
  });
});

describe('Iraqi phone numbers', () => {
  it.each([
    ['07701234567', '+9647701234567'], ['0770 123 4567', '+9647701234567'], ['+964 770 123 4567', '+9647701234567'],
    ['009647801234567', '+9647801234567'], ['7501234567', '+9647501234567'], ['٠٧٧٠١٢٣٤٥٦٧', '+9647701234567'],
  ])('%s → %s', (input, out) => expect(toIraqiE164(input)).toBe(out));
  it.each(['0770123456', '0612345678', '+15551234567', '', 'abc'])('rejects %s', (input) => expect(toIraqiE164(input)).toBeNull());
  it('reads back in local form', () => expect(iraqiLocal('+9647701234567')).toBe('0770 123 4567'));
  it('explains a number that already belongs to another account', () => expect(errorMessage({ message: 'A user with this phone number has already been registered' })).toContain('مربوط بحساب ثاني'));
  it('maps hook codes inside auth errors', () => expect(errorMessage({ message: 'Error running hook URI: app:otp_rate_limited' })).toContain('انتظر'));
});
