// /sitemap.xml: every public page, for search engines.
import { doctorPath, doctorsPath, labPath, labsPath, listing } from '../packages/shared/src/seo';
import { directory, isDemo, type Handler } from './_lib/site';

export const onRequestGet: Handler = async (ctx) => {
  const all = await directory(ctx);
  // only real entries go to search engines
  const doctors = all.doctors.filter((d) => !isDemo(d.name) && !d.clinics.every((c) => isDemo(c.facility_name)));
  const labs = all.labs.filter((l) => !isDemo(l.name));
  const dir = { ...all, doctors, labs, cities: all.cities.map((c) => ({ ...c, doctors: doctors.filter((d) => d.city_slug === c.slug).length, labs: labs.filter((l) => l.city_slug === c.slug).length })) };
  const o = new URL(ctx.request.url).origin;
  const urls = ['/', '/videos', doctorsPath(), labsPath()];
  for (const c of dir.cities) {
    if (c.doctors) { urls.push(doctorsPath(c.slug)); for (const s of listing(dir, c.slug).specialties) urls.push(doctorsPath(c.slug, s.code)); }
    if (c.labs) urls.push(labsPath(c.slug));
  }
  urls.push(...dir.doctors.map(doctorPath), ...dir.labs.map(labPath));
  const day = dir.built_at.slice(0, 10);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${o}${u}</loc><lastmod>${day}</lastmod></url>`).join('\n')}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
};
