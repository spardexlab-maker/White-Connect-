// /doctor/<name>-<id>: one doctor, every clinic they work at, with hours and prices.
import { doctorPath, doctorsPath } from '../../packages/shared/src/seo';
import { directory, esc, findBySlug, hoursSpec, hoursText, mediaUrl, money, profile, render, type Handler } from '../_lib/site';

export const onRequestGet: Handler = async (ctx) => {
  const dir = await directory(ctx);
  const d = findBySlug(dir.doctors, String(ctx.params.slug));
  const origin = new URL(ctx.request.url).origin;
  if (!d) return render(ctx, { status: 404, title: 'الطبيب غير موجود — أبيض', description: 'هذا الطبيب غير متاح حالياً على أبيض.', canonical: `${origin}/doctors`, body: '<h1>الطبيب غير متاح حالياً</h1><p><a href="/doctors">تصفّح دليل الأطباء</a></p>' });
  if (d.slug !== String(ctx.params.slug)) return Response.redirect(`${origin}${doctorPath(d)}`, 301);

  const profiles = await Promise.all(d.clinics.map((c) => profile(ctx.env, c.facility_id, d.practitioner_id).catch(() => null)));
  const url = `${origin}${doctorPath(d)}`;
  const where = [d.specialty, d.city].filter(Boolean).join(' في ');
  const prices = d.clinics.map((c) => c.min_price_minor).filter((x): x is number => x != null);
  const title = `${d.name}${d.specialty ? ` — ${d.specialty}` : ''}${d.city ? ` في ${d.city}` : ''} | احجز على أبيض`;
  const description = `${d.name}${where ? `، ${where}` : ''}. ${d.clinics.map((c) => c.facility_name).join('، ')}${prices.length ? `. الكشفية من ${money(Math.min(...prices))}` : ''}. احجز موعدك أونلاين واستلم وصفتك ونتائجك على أبيض.`;
  const bio = profiles.find((p) => p?.practitioner?.bio)?.practitioner?.bio ?? null;

  const clinics = d.clinics.map((c, i) => {
    const p = profiles[i];
    const hours = p ? hoursText(p.weekly_hours) : [];
    const services = p?.services ?? [];
    return `<section><h2>${esc(c.facility_name)}${c.branch_name ? ` — ${esc(c.branch_name)}` : ''}</h2>
      <p>${esc([c.area, c.address, d.city].filter(Boolean).join('، '))}</p>
      ${hours.length ? `<h3>أوقات الدوام</h3><ul>${hours.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>` : c.opening_hours_note ? `<p>${esc(c.opening_hours_note)}</p>` : ''}
      ${services.length ? `<h3>الخدمات والأسعار</h3><ul>${services.map((s) => `<li>${esc(s.name)}${s.price_minor != null ? ` — ${money(s.price_minor)}` : ''} (${s.duration_minutes} دقيقة)</li>`).join('')}</ul>` : ''}
      <p><a href="/patient/book/${c.facility_id}/${d.practitioner_id}">احجز موعداً في ${esc(c.facility_name)}</a></p></section>`;
  }).join('');

  const jsonld = [{
    '@context': 'https://schema.org', '@type': 'Physician', name: d.name, url,
    ...(d.specialty ? { medicalSpecialty: d.specialty } : {}), ...(bio ? { description: bio } : {}),
    ...(d.photo_path ? { image: mediaUrl(ctx.env, d.photo_path) } : {}),
    ...(prices.length ? { priceRange: `${money(Math.min(...prices))}+` } : {}),
    address: d.clinics.map((c) => ({ '@type': 'PostalAddress', streetAddress: [c.area, c.address].filter(Boolean).join('، '), addressLocality: d.city, addressCountry: 'IQ' })),
    ...(d.clinics[0]?.latitude != null ? { geo: { '@type': 'GeoCoordinates', latitude: d.clinics[0].latitude, longitude: d.clinics[0].longitude } } : {}),
    ...(profiles[0]?.weekly_hours.length ? { openingHours: hoursSpec(profiles[0].weekly_hours) } : {}),
    potentialAction: { '@type': 'ReserveAction', target: `${origin}/patient/book/${d.clinics[0].facility_id}/${d.practitioner_id}` },
  }, {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'الأطباء', item: `${origin}/doctors` },
      ...(d.city_slug ? [{ '@type': 'ListItem', position: 2, name: `أطباء ${d.city}`, item: `${origin}${doctorsPath(d.city_slug)}` }] : []),
      ...(d.city_slug && d.specialty_code ? [{ '@type': 'ListItem', position: 3, name: `${d.specialty} في ${d.city}`, item: `${origin}${doctorsPath(d.city_slug, d.specialty_code)}` }] : []),
      { '@type': 'ListItem', position: 4, name: d.name, item: url },
    ],
  }];
  const body = `<nav><a href="/doctors">الأطباء</a>${d.city_slug ? ` › <a href="${doctorsPath(d.city_slug)}">${esc(d.city)}</a>` : ''}${d.city_slug && d.specialty_code ? ` › <a href="${doctorsPath(d.city_slug, d.specialty_code)}">${esc(d.specialty)}</a>` : ''}</nav>
    <h1>${esc(d.name)}</h1><p>${esc([d.title, d.specialty].filter(Boolean).join(' · '))}${d.verified ? ' · ترخيص تمت مراجعته' : ''}</p>
    ${bio ? `<p>${esc(bio)}</p>` : ''}${clinics}`;
  return render(ctx, { title, description, canonical: url, image: mediaUrl(ctx.env, d.photo_path), jsonld, body });
};
