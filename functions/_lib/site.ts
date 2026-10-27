// Cloudflare Pages Functions: the public doctor/lab pages are rendered on the server, so
// search engines and link previews (WhatsApp, Instagram) see the real name, specialty,
// address and hours. The app itself then loads on top of the same URL as usual.
import { buildDirectory, idFromSlug, type Directory, type ProviderRow } from '../../packages/shared/src/seo';

export interface Env { VITE_SUPABASE_URL: string; VITE_SUPABASE_PUBLISHABLE_KEY: string; ASSETS: { fetch: (r: Request | string) => Promise<Response> } }
type Ctx = { request: Request; env: Env; params: Record<string, string | string[]>; waitUntil: (p: Promise<unknown>) => void };
export type Handler = (ctx: Ctx) => Promise<Response>;

const TTL = 900; // the directory is cached for 15 minutes at the edge

async function rest<T>(env: Env, path: string, body?: unknown): Promise<T> {
  const r = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${env.VITE_SUPABASE_PUBLISHABLE_KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`supabase ${path}: ${r.status}`);
  return r.json() as Promise<T>;
}

export async function directory(ctx: Ctx): Promise<Directory> {
  const cache = (caches as unknown as { default: Cache }).default;
  const key = new Request(new URL('/__directory-v2', ctx.request.url).toString());
  const hit = await cache.match(key);
  if (hit) return hit.json() as Promise<Directory>;
  const env = ctx.env;
  const dir = await buildDirectory({
    cities: () => rest(env, 'cities?select=id,name_ar,name_en&is_active=eq.true&order=name_ar'),
    specialties: () => rest(env, 'specialties?select=id,code,name_ar&is_active=eq.true&order=sort_order'),
    search: (kind, cityId) => rest<ProviderRow[]>(env, 'rpc/search_providers', { p_kind: kind, p_city_id: cityId, p_limit: 100 }),
  });
  ctx.waitUntil(cache.put(key, new Response(JSON.stringify(dir), { headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${TTL}` } })));
  return dir;
}

export interface Profile {
  facility: { id: string; name: string; phone: string | null; opening_hours_note: string | null; organization_name: string; branch_name: string; area: string | null; address: string | null; city: string | null; latitude: number | null; longitude: number | null; description: string | null };
  practitioner: { id: string; full_name: string; title: string | null; bio: string | null; specialty: string | null; license_verified: boolean; photo_path: string | null } | null;
  services: { name: string; duration_minutes: number; price_minor: number | null }[];
  weekly_hours: { weekday: number; start: string; end: string }[];
}
export const profile = (env: Env, facilityId: string, practitionerId?: string) =>
  rest<Profile | null>(env, 'rpc/get_provider_profile', { p_facility_id: facilityId, p_practitioner_id: practitionerId ?? null });

export const findBySlug = <T extends { slug: string }>(list: T[], slug: string) => {
  const id = idFromSlug(decodeURIComponent(slug));
  return list.find((x) => x.slug === slug) ?? (id ? list.find((x) => x.slug.endsWith(`-${id}`)) : undefined);
};

export const esc = (s: string | null | undefined) =>
  (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const mediaUrl = (env: Env, path: string | null) => (path ? `${env.VITE_SUPABASE_URL}/storage/v1/object/public/public-media/${path}` : null);
export const money = (minor: number | null) => (minor == null ? null : `${Math.round(minor).toLocaleString('en-US')} د.ع`);
const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const DAYS_EN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
export const hhmm = (t: string) => t.slice(0, 5);
export function hoursText(h: Profile['weekly_hours']) {
  return [0, 1, 2, 3, 4, 5, 6].map((d) => ({ d, spans: h.filter((x) => x.weekday === d) }))
    .filter((x) => x.spans.length).map((x) => `${DAYS[x.d]}: ${x.spans.map((s) => `${hhmm(s.start)}–${hhmm(s.end)}`).join('، ')}`);
}
export const hoursSpec = (h: Profile['weekly_hours']) => h.map((s) => `${DAYS_EN[s.weekday]} ${hhmm(s.start)}-${hhmm(s.end)}`);

export interface Page { title: string; description: string; canonical: string; image?: string | null; jsonld?: unknown[]; body: string; status?: number }

/** The app's index.html with this page's title, preview tags, structured data and readable content. */
export async function render(ctx: Ctx, page: Page): Promise<Response> {
  const shell = await (await ctx.env.ASSETS.fetch(new URL('/', ctx.request.url).toString())).text();
  const origin = new URL(ctx.request.url).origin;
  const image = page.image ?? `${origin}/og-image.png`;
  const head = [
    `<title>${esc(page.title)}</title>`,
    `<meta name="description" content="${esc(page.description)}" />`,
    `<link rel="canonical" href="${esc(page.canonical)}" />`,
    `<meta property="og:type" content="website" />`, `<meta property="og:site_name" content="أبيض" />`, `<meta property="og:locale" content="ar_IQ" />`,
    `<meta property="og:title" content="${esc(page.title)}" />`, `<meta property="og:description" content="${esc(page.description)}" />`,
    `<meta property="og:url" content="${esc(page.canonical)}" />`, `<meta property="og:image" content="${esc(image)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    ...(page.jsonld ?? []).map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`),
  ].join('\n    ');
  const html = shell
    .replace(/<title>[\s\S]*?<\/title>/, '')
    .replace(/<meta (name="description"|property="og:[a-z_:]+"|name="twitter:[a-z]+")[^>]*>\s*/g, '')
    .replace('</head>', `    ${head}\n  </head>`)
    .replace(/<div id="root"><\/div>/, `<div id="root"><div class="seo-page" dir="rtl">${page.body}</div></div>`);
  return new Response(html, {
    status: page.status ?? 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
  });
}
