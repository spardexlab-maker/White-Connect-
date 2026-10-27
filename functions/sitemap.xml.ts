// /sitemap.xml: every public page, for search engines.
import { doctorPath, doctorsPath, labPath, labsPath, listing } from '../packages/shared/src/seo';
import { directory, type Handler } from './_lib/site';

export const onRequestGet: Handler = async (ctx) => {
  const dir = await directory(ctx);
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
