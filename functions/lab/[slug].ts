// /lab/<name>-<id>: one laboratory.
import { labPath, labsPath } from '../../packages/shared/src/seo';
import { directory, isDemo, esc, findBySlug, hoursSpec, hoursText, money, profile, render, type Handler } from '../_lib/site';

export const onRequestGet: Handler = async (ctx) => {
  const dir = await directory(ctx);
  const l = findBySlug(dir.labs, String(ctx.params.slug));
  const origin = new URL(ctx.request.url).origin;
  if (!l) return render(ctx, { status: 404, title: 'المختبر غير موجود — أبيض', description: 'هذا المختبر غير متاح حالياً على أبيض.', canonical: `${origin}/labs`, body: '<h1>المختبر غير متاح حالياً</h1><p><a href="/labs">تصفّح المختبرات</a></p>' });
  if (l.slug !== String(ctx.params.slug)) return Response.redirect(`${origin}${labPath(l)}`, 301);
  const p = await profile(ctx.env, l.facility_id).catch(() => null);
  const url = `${origin}${labPath(l)}`;
  const hours = p ? hoursText(p.weekly_hours) : [];
  const title = `${l.name}${l.city ? ` — مختبر في ${l.city}` : ''} | احجز على أبيض`;
  const description = `${l.name}${l.city ? `، مختبر تحليلات في ${l.city}` : ''}${l.area ? ` (${l.area})` : ''}. احجز تحليلك أو اطلب سحب العينة من البيت، واستلم النتيجة على أبيض.`;
  const jsonld = [{
    '@context': 'https://schema.org', '@type': 'MedicalClinic', name: l.name, url, medicalSpecialty: 'Laboratory',
    address: { '@type': 'PostalAddress', streetAddress: [l.area, l.address].filter(Boolean).join('، '), addressLocality: l.city, addressCountry: 'IQ' },
    ...(l.latitude != null ? { geo: { '@type': 'GeoCoordinates', latitude: l.latitude, longitude: l.longitude } } : {}),
    ...(p?.weekly_hours.length ? { openingHours: hoursSpec(p.weekly_hours) } : {}),
    ...(p?.facility.phone ? { telephone: p.facility.phone } : {}),
  }];
  const body = `<nav><a href="/labs">المختبرات</a>${l.city_slug ? ` › <a href="${labsPath(l.city_slug)}">${esc(l.city)}</a>` : ''}</nav>
    <h1>${esc(l.name)}</h1><p>${esc([l.area, l.address, l.city].filter(Boolean).join('، '))}</p>
    ${p?.facility.description ? `<p>${esc(p.facility.description)}</p>` : ''}
    ${hours.length ? `<h2>أوقات الدوام</h2><ul>${hours.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>` : ''}
    ${p?.services.length ? `<h2>التحاليل والأسعار</h2><ul>${p.services.map((s) => `<li>${esc(s.name)}${s.price_minor != null ? ` — ${money(s.price_minor)}` : ''}</li>`).join('')}</ul>` : ''}
    <p><a href="/patient/book/${l.facility_id}">احجز في ${esc(l.name)}</a></p>`;
  return render(ctx, { noindex: isDemo(l.name), title, description, canonical: url, jsonld, body });
};
