// /labs, /labs/<city>
import { labPath, labsPath } from '../../packages/shared/src/seo';
import { directory, esc, isDemo, render, type Handler } from '../_lib/site';

export const onRequestGet: Handler = async (ctx) => {
  const [city] = ([] as string[]).concat(ctx.params.path ?? []);
  const dir = await directory(ctx);
  const origin = new URL(ctx.request.url).origin;
  const c = city ? dir.cities.find((x) => x.slug === city) ?? null : null;
  const labs = dir.labs.filter((l) => !c || l.city_slug === c.slug);
  const name = c ? `مختبرات ${c.name}` : 'مختبرات التحليلات في العراق';
  return render(ctx, {
    noindex: !labs.some((l) => !isDemo(l.name)), status: city && !c ? 404 : 200, title: `${name} | احجز تحليلك على أبيض`,
    description: `${name}: ${labs.length} مختبر. احجز تحليلك أو اطلب سحب العينة من البيت، واستلم النتيجة على أبيض.`,
    canonical: `${origin}${labsPath(c?.slug)}`,
    body: `<h1>${esc(name)}</h1><ul>${labs.map((l) => `<li><a href="${labPath(l)}"><strong>${esc(l.name)}</strong></a> — ${esc([l.area, l.city].filter(Boolean).join('، '))}</li>`).join('')}</ul>
      ${c ? '' : `<h2>المدن</h2><ul>${dir.cities.filter((x) => x.labs).map((x) => `<li><a href="${labsPath(x.slug)}">مختبرات ${esc(x.name)}</a> (${x.labs})</li>`).join('')}</ul>`}<p><a href="/doctors">الأطباء</a></p>`,
  });
};
