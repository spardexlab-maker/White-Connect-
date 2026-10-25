import { describe, expect, it } from 'vitest';
import { color, contrastPairs, contrastRatio } from '../src/tokens';
import { errorMessage } from '../src/errors';
import { addDays, formatMoney, localDateKey, weekdayOf } from '../src/format';
import { quickBookingSchema } from '../src/validation';
import { iraqiLocal, toIraqiE164 } from '../src/phone';
import { directionsUrl, isShortMapLink, parseMapLink } from '../src/mapLink';

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

describe('map links', () => {
  it.each([
    ['https://www.google.com/maps/place/Clinic/@33.3015,44.4100,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d33.30152!4d44.41068', { lat: 33.30152, lng: 44.41068 }],
    ['https://www.google.com/maps/@33.3152,44.3661,15z', { lat: 33.3152, lng: 44.3661 }],
    ['https://maps.google.com/?q=33.3152,44.3661', { lat: 33.3152, lng: 44.3661 }],
    ['https://www.google.com/maps/search/?api=1&query=33.3152%2C44.3661', { lat: 33.3152, lng: 44.3661 }],
    ['https://maps.apple.com/?ll=36.1912,44.0092&q=Pin', { lat: 36.1912, lng: 44.0092 }],
    ['geo:30.5085,47.7804?z=16', { lat: 30.5085, lng: 47.7804 }],
    ['33.3152, 44.3661', { lat: 33.3152, lng: 44.3661 }],
    ['https://www.openstreetmap.org/?mlat=33.31&mlon=44.36#map=17/33.31/44.36', { lat: 33.31, lng: 44.36 }],
  ])('%s', (link, want) => expect(parseMapLink(link)).toEqual(want));
  it.each(['https://maps.app.goo.gl/abc123', 'عيادة النور', '', '95, 200'])('no coordinates in %s', (s) => expect(parseMapLink(s)).toBeNull());
  it('knows a short link needs following', () => expect(isShortMapLink('https://maps.app.goo.gl/AbC')).toBe(true));
  it('builds directions', () => expect(directionsUrl({ lat: 33.3, lng: 44.4 })).toBe('https://www.google.com/maps/dir/?api=1&destination=33.3%2C44.4'));
});
