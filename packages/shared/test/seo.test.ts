import { describe, expect, it } from 'vitest';
import { buildDirectory, idFromSlug, listing, slugify, slugId, type ProviderRow } from '../src/seo';

const row = (o: Partial<ProviderRow>): ProviderRow => ({
  practitioner_id: null, facility_id: 'f0000000-0000-4000-8000-0000000000a1', display_name: '', title: null, specialty_name: null, facility_name: 'عيادات الرافدين',
  organization_name: 'مجمع', branch_name: 'الكرادة', area: 'الكرادة', city_name: 'بغداد', address: null, latitude: null, longitude: null,
  min_price_minor: 10000, license_verified: true, photo_path: null, opening_hours_note: null, ...o,
});

describe('public directory', () => {
  it('turns Arabic names into short Latin links', () => {
    expect(slugify('د. أحمد سالم')).toBe('ahmd-salm');
    expect(slugify('مختبر الرافدين')).toBe('mkhtbr-alrafdyn');
    expect(slugify('Baghdad')).toBe('baghdad');
    expect(slugify('؟؟')).toBe('x');
  });
  it('keeps the id in the link so a renamed doctor still resolves', () => {
    const id = '3f2a1c00-1111-4222-8333-9a8b7c6d5e4f';
    expect(slugId(id)).toBe('7c6d5e4f');
    expect(idFromSlug(`ahmd-salm-${slugId(id)}`)).toBe('7c6d5e4f');
    expect(idFromSlug('no-id-here')).toBeNull();
  });
  it('groups one doctor across clinics and lists by city and specialty', async () => {
    const pid = 'p0000000-0000-4000-8000-000000000010';
    const dir = await buildDirectory({
      cities: async () => [{ id: 'c1', name_ar: 'بغداد', name_en: 'Baghdad' }, { id: 'c2', name_ar: 'كربلاء', name_en: 'Karbala' }],
      specialties: async () => [{ id: 's1', code: 'internal', name_ar: 'باطنية' }, { id: 's2', code: 'ent', name_ar: 'أنف وأذن وحنجرة' }],
      search: async (kind, city) => (kind === 'doctor' && city === 'c1'
        ? [row({ practitioner_id: pid, display_name: 'د. أحمد سالم', specialty_name: 'باطنية' }),
           row({ practitioner_id: pid, display_name: 'د. أحمد سالم', specialty_name: 'باطنية', facility_id: 'f0000000-0000-4000-8000-0000000000b2', facility_name: 'عيادات دجلة' })]
        : kind === 'laboratory' && city === 'c1' ? [row({ facility_name: 'مختبر الرافدين' })] : []),
    });
    expect(dir.cities.map((c) => c.slug)).toEqual(['baghdad']);         // Karbala has nobody yet
    expect(dir.doctors).toHaveLength(1);
    expect(dir.doctors[0].clinics).toHaveLength(2);
    expect(dir.doctors[0].slug).toBe('ahmd-salm-00000010');
    const l = listing(dir, 'baghdad', 'internal');
    expect(l.doctors).toHaveLength(1);
    expect(l.specialties.map((s) => s.code)).toEqual(['internal']);
    expect(listing(dir, 'baghdad', 'ent').doctors).toHaveLength(0);
    expect(dir.labs[0].slug).toBe('mkhtbr-alrafdyn-000000a1');
  });
});
