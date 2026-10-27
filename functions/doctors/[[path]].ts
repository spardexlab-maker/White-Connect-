// /doctors, /doctors/<city>, /doctors/<city>/<specialty>: listing pages search engines can read.
import { doctorPath, doctorsPath, listing, listingTitle } from '../../packages/shared/src/seo';
import { directory, esc, isDemo, money, render, type Handler } from '../_lib/site';

export const onRequestGet: Handler = async (ctx) => {
  const [city, spec] = ([] as string[]).concat(ctx.params.path ?? []);
  const dir = await directory(ctx);
  const origin = new URL(ctx.request.url).origin;
  const l = listing(dir, city, spec);
  const missing = (city && !l.city) || (spec && !l.specialty);
  const title = `${listingTitle(l.city, l.specialty)} | احجز موعدك على أبيض`;
  const description = `${listingTitle(l.city, l.specialty)}: ${l.doctors.length} طبيب. شوف الاختصاص والعيادة والعنوان والأسعار، واحجز موعدك أونلاين على أبيض.`;
  const items = l.doctors.map((d) => {
    const c = d.clinics[0];
    return `<li><a href="${doctorPath(d)}"><strong>${esc(d.name)}</strong></a> — ${esc(d.specialty)}<br>${esc(c.facility_name)}، ${esc([c.area, d.city].filter(Boolean).join('، '))}${c.min_price_minor != null ? ` · من ${money(c.min_price_minor)}` : ''}</li>`;
  }).join('');
  const nav = !l.city
    ? `<h2>المدن</h2><ul>${dir.cities.filter((c) => c.doctors).map((c) => `<li><a href="${doctorsPath(c.slug)}">أطباء ${esc(c.name)}</a> (${c.doctors})</li>`).join('')}</ul>`
    : `<h2>الاختصاصات في ${esc(l.city.name)}</h2><ul>${l.specialties.map((s) => `<li><a href="${doctorsPath(l.city!.slug, s.code)}">${esc(s.name)}</a></li>`).join('')}</ul>`;
  const jsonld = [{
    '@context': 'https://schema.org', '@type': 'ItemList', name: listingTitle(l.city, l.specialty),
    itemListElement: l.doctors.slice(0, 50).map((d, i) => ({ '@type': 'ListItem', position: i + 1, url: `${origin}${doctorPath(d)}`, name: d.name })),
  }];
  return render(ctx, {
    noindex: !l.doctors.some((d) => !isDemo(d.name)), status: missing ? 404 : 200, title, description, canonical: `${origin}${doctorsPath(l.city?.slug, l.specialty?.code)}`, jsonld,
    body: `<h1>${esc(listingTitle(l.city, l.specialty))}</h1>${l.doctors.length ? `<ul>${items}</ul>` : '<p>ماكو أطباء هنا بعد.</p>'}${nav}<p><a href="/labs">المختبرات</a></p>`,
  });
};
