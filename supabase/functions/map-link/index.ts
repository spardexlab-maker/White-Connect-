// map-link — turns a map link the admin pasted into coordinates. Links with coordinates
// are read directly; short links (maps.app.goo.gl from a phone's «Share») are followed
// hop by hop, only through map hosts, and the last page is searched for the pin.
// Signed-in callers only (verify_jwt); nothing is stored.
import { parseMapLink } from './mapLink.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const MAP_HOSTS = /^(maps\.app\.goo\.gl|goo\.gl|g\.co|(www\.|maps\.)?google\.[a-z.]{2,8}|maps\.apple\.com|(www\.)?openstreetmap\.org)$/i;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });

// where a Google page hides the pin when the URL itself has none
const IN_PAGE = [/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/, /center=(-?\d{1,3}\.\d+)%2C(-?\d{1,3}\.\d+)/, /\[null,null,(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)\]/,
                 /markers=(-?\d{1,3}\.\d+)%2C(-?\d{1,3}\.\d+)/];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  let url = '';
  try { url = String((await req.json()).url ?? '').trim(); } catch { return json({ error: 'bad_request' }, 400); }
  const direct = parseMapLink(url);
  if (direct) return json(direct);
  let current: URL;
  try { current = new URL(url); } catch { return json({ error: 'no_coordinates' }, 422); }
  for (let hop = 0; hop < 6; hop++) {
    if (current.protocol !== 'https:' || !MAP_HOSTS.test(current.hostname)) return json({ error: 'not_a_map_link' }, 422);
    const r = await fetch(current.href, { redirect: 'manual', headers: { 'user-agent': 'Mozilla/5.0 (compatible; WhiteConnect map-link)', 'accept-language': 'ar,en' } });
    const next = r.headers.get('location');
    if (next) {
      await r.body?.cancel();
      current = new URL(next, current);
      const p = parseMapLink(current.href);
      if (p) return json(p);
      continue;
    }
    const html = (await r.text()).slice(0, 400_000);
    for (const re of IN_PAGE) {
      const m = html.match(re);
      const p = m && parseMapLink(`${m[1]},${m[2]}`);
      if (p) return json(p);
    }
    break;
  }
  return json({ error: 'no_coordinates' }, 422);
});
