// app-update — over-the-air updates for the mobile app (iOS + Android),
// speaking the expo-updates protocol (v1). Each JS-only release is built by
// .github/workflows/mobile-ota.yml and stored on the public GitHub release
// `ota-<runtimeVersion>`: the bundles/assets (named by content hash) plus one
// manifest per platform. This function only hands the current manifest to the
// app; the app downloads the files from GitHub and verifies their hashes.
// Native changes (new modules) bump runtimeVersion and need a new APK/IPA.
const REPO = Deno.env.get('OTA_REPO') ?? 'spardexlab-maker/White-Connect-';
const CACHE_MS = 60_000;
const cache = new Map<string, { at: number; body: string | null }>();

const headers = (extra: Record<string, string> = {}) => ({
  'expo-protocol-version': '1',
  'expo-sfv-version': '0',
  'cache-control': 'private, max-age=0',
  ...extra,
});

async function manifest(runtime: string, platform: string): Promise<string | null> {
  const key = `${runtime}/${platform}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.body;
  const r = await fetch(`https://github.com/${REPO}/releases/download/ota-${runtime}/manifest-${platform}.json`, { redirect: 'follow' });
  const body = r.ok ? await r.text() : null;
  if (r.ok || r.status === 404) cache.set(key, { at: Date.now(), body });
  else throw new Error(`github_${r.status}`);
  return body;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const platform = req.headers.get('expo-platform') ?? url.searchParams.get('platform') ?? '';
  const runtime = req.headers.get('expo-runtime-version') ?? url.searchParams.get('runtime-version') ?? '';
  if (!['ios', 'android'].includes(platform) || !/^[\w.-]{1,40}$/.test(runtime)) {
    return new Response(JSON.stringify({ error: 'invalid_request' }), { status: 400, headers: headers({ 'content-type': 'application/json' }) });
  }
  try {
    const body = await manifest(runtime, platform);
    // no update published for this build's runtime yet
    if (!body) return new Response(null, { status: 204, headers: headers() });
    return new Response(body, { status: 200, headers: headers({ 'content-type': 'application/json' }) });
  } catch (e) {
    console.error('app-update', String(e));
    return new Response(JSON.stringify({ error: 'unavailable' }), { status: 503, headers: headers({ 'content-type': 'application/json' }) });
  }
});
