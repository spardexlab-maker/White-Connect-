// Public directory for search engines and sharing: friendly links for every doctor and lab,
// and listing pages per city and specialty. Built only from what is already public
// (search_providers, cities, specialties) — nothing medical, no patient data.

const AR: Record<string, string> = {
  'ا': 'a', 'أ': 'a', 'إ': 'e', 'آ': 'a', 'ء': '', 'ؤ': 'o', 'ئ': 'e', 'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j', 'ح': 'h',
  'خ': 'kh', 'د': 'd', 'ذ': 'th', 'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z',
  'ع': 'a', 'غ': 'gh', 'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ه': 'h', 'ة': 'a', 'و': 'w',
  'ي': 'y', 'ى': 'a', 'گ': 'g', 'چ': 'ch', 'پ': 'p', 'ڤ': 'v', 'ک': 'k', 'ی': 'y',
};

/** Arabic (or Latin) text → a short Latin URL part, e.g. «د. أحمد سالم» → "ahmd-salm". */
export function slugify(text: string): string {
  const s = text
    .replace(/^\s*(د\.|دكتور|الدكتور|د)\s+/, '')
    .replace(/[ً-ْٰـ]/g, '')          // harakat, tatweel
    .split('').map((c) => AR[c] ?? c).join('')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  return s.slice(0, 48) || 'x';
}

/** The id part of a slug: enough of the uuid to be unique, short enough to look tidy. */
export const slugId = (uuid: string) => uuid.replace(/-/g, '').slice(-8);
export const idFromSlug = (slug: string) => (/-([0-9a-f]{8})$/.exec(slug) ?? /^([0-9a-f]{8})$/.exec(slug))?.[1] ?? null;

export interface ProviderRow {
  practitioner_id: string | null; facility_id: string; display_name: string; title: string | null; specialty_name: string | null;
  facility_name: string; organization_name: string; branch_name: string; area: string | null; city_name: string | null;
  address: string | null; latitude: number | null; longitude: number | null; min_price_minor: number | null;
  license_verified: boolean; photo_path: string | null; opening_hours_note: string | null;
}
export interface DirCity { id: string; slug: string; name: string; doctors: number; labs: number }
export interface DirSpecialty { id: string; code: string; name: string }
export interface DirClinic { facility_id: string; facility_name: string; organization_name: string; branch_name: string; area: string | null; address: string | null; latitude: number | null; longitude: number | null; min_price_minor: number | null; opening_hours_note: string | null }
export interface DirDoctor { slug: string; practitioner_id: string; name: string; title: string | null; specialty: string | null; specialty_code: string | null; city: string | null; city_slug: string | null; verified: boolean; photo_path: string | null; clinics: DirClinic[] }
export interface DirLab { slug: string; facility_id: string; name: string; organization_name: string; city: string | null; city_slug: string | null; area: string | null; address: string | null; latitude: number | null; longitude: number | null; opening_hours_note: string | null }
export interface Directory { built_at: string; cities: DirCity[]; specialties: DirSpecialty[]; doctors: DirDoctor[]; labs: DirLab[] }

export interface DirectorySource {
  cities(): Promise<{ id: string; name_ar: string; name_en: string | null }[]>;
  specialties(): Promise<{ id: string; code: string; name_ar: string }[]>;
  search(kind: 'doctor' | 'laboratory', cityId: string): Promise<ProviderRow[]>;
}

export const citySlug = (c: { name_ar: string; name_en: string | null }) => slugify(c.name_en ?? c.name_ar);

/** Everything public, grouped: one entry per doctor (with each clinic they work at) and per lab. */
export async function buildDirectory(src: DirectorySource): Promise<Directory> {
  const [cities, specialties] = await Promise.all([src.cities(), src.specialties()]);
  const specByName = new Map(specialties.map((s) => [s.name_ar, s]));
  const doctors = new Map<string, DirDoctor>();
  const labs: DirLab[] = [];
  const outCities: DirCity[] = [];
  // all cities at once (a cold build is ~2 lookups per city), then grouped in city order
  const rows = await Promise.all(cities.map((c) => Promise.all([src.search('doctor', c.id), src.search('laboratory', c.id)])));
  for (const [i, c] of cities.entries()) {
    const slug = citySlug(c);
    const [docRows, labRows] = rows[i];
    for (const r of docRows) {
      if (!r.practitioner_id) continue;
      const clinic: DirClinic = { facility_id: r.facility_id, facility_name: r.facility_name, organization_name: r.organization_name, branch_name: r.branch_name,
        area: r.area, address: r.address, latitude: r.latitude, longitude: r.longitude, min_price_minor: r.min_price_minor, opening_hours_note: r.opening_hours_note };
      const have = doctors.get(r.practitioner_id);
      if (have) { if (!have.clinics.some((k) => k.facility_id === r.facility_id)) have.clinics.push(clinic); continue; }
      const sp = r.specialty_name ? specByName.get(r.specialty_name) : undefined;
      doctors.set(r.practitioner_id, {
        slug: `${slugify(r.display_name)}-${slugId(r.practitioner_id)}`, practitioner_id: r.practitioner_id, name: r.display_name, title: r.title,
        specialty: r.specialty_name, specialty_code: sp?.code ?? null, city: c.name_ar, city_slug: slug, verified: r.license_verified,
        photo_path: r.photo_path, clinics: [clinic],
      });
    }
    for (const r of labRows) {
      labs.push({ slug: `${slugify(r.facility_name)}-${slugId(r.facility_id)}`, facility_id: r.facility_id, name: r.facility_name, organization_name: r.organization_name,
        city: c.name_ar, city_slug: slug, area: r.area, address: r.address, latitude: r.latitude, longitude: r.longitude, opening_hours_note: r.opening_hours_note });
    }
    const nd = [...doctors.values()].filter((d) => d.city_slug === slug).length;
    if (nd || labRows.length) outCities.push({ id: c.id, slug, name: c.name_ar, doctors: nd, labs: labRows.length });
  }
  return {
    built_at: new Date().toISOString(), cities: outCities,
    specialties: specialties.map((s) => ({ id: s.id, code: s.code, name: s.name_ar })),
    doctors: [...doctors.values()].sort((a, b) => a.name.localeCompare(b.name, 'ar')), labs,
  };
}

export const doctorPath = (d: Pick<DirDoctor, 'slug'>) => `/doctor/${d.slug}`;
export const labPath = (l: Pick<DirLab, 'slug'>) => `/lab/${l.slug}`;
export const doctorsPath = (city?: string | null, specialty?: string | null) => `/doctors${city ? `/${city}` : ''}${city && specialty ? `/${specialty}` : ''}`;
export const labsPath = (city?: string | null) => `/labs${city ? `/${city}` : ''}`;

/** What a listing URL selects: /doctors, /doctors/karbala, /doctors/karbala/internal. */
export function listing(dir: Directory, citySlug?: string, specialtyCode?: string) {
  const city = citySlug ? dir.cities.find((c) => c.slug === citySlug) ?? null : null;
  const specialty = specialtyCode ? dir.specialties.find((s) => s.code === specialtyCode) ?? null : null;
  const doctors = dir.doctors.filter((d) => (!city || d.city_slug === city.slug) && (!specialty || d.specialty_code === specialty.code));
  // specialties that have doctors here (for the filter chips)
  const here = new Set(dir.doctors.filter((d) => !city || d.city_slug === city.slug).map((d) => d.specialty_code));
  return { city, specialty, doctors, specialties: dir.specialties.filter((s) => here.has(s.code)) };
}

export function listingTitle(city: { name: string } | null, specialty: { name: string } | null) {
  if (specialty && city) return `أطباء ${specialty.name} في ${city.name}`;
  if (city) return `أطباء ${city.name}`;
  return 'دليل الأطباء في العراق';
}
