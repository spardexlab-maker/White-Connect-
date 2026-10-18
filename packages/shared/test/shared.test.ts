import { describe, expect, it } from 'vitest';
import { color, contrastPairs, contrastRatio } from '../src/tokens';
import { errorMessage } from '../src/errors';
import { addDays, formatMoney, localDateKey, weekdayOf } from '../src/format';
import { quickBookingSchema } from '../src/validation';

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
