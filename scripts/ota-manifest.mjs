// Builds an over-the-air update (expo-updates protocol v1) from `expo export`
// output: copies every file under a content-hash name into <out>/ and writes
// manifest-ios.json / manifest-android.json pointing at <baseUrl>/<name>.
// Usage: node scripts/ota-manifest.mjs <export-dir> <out-dir> <runtimeVersion> <baseUrl> <expo-config.json>
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [dist, out, runtimeVersion, baseUrl, configPath] = process.argv.slice(2);
if (!configPath) { console.error('usage: ota-manifest.mjs <export-dir> <out-dir> <runtimeVersion> <baseUrl> <expo-config.json>'); process.exit(2); }

const types = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
                ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2', json: 'application/json', mp3: 'audio/mpeg', wav: 'audio/wav' };
const metadata = JSON.parse(readFileSync(join(dist, 'metadata.json'), 'utf8'));
const expoClient = JSON.parse(readFileSync(configPath, 'utf8'));
mkdirSync(out, { recursive: true });

function file(path, ext) {
  const bytes = readFileSync(join(dist, path));
  const sha = createHash('sha256').update(bytes).digest();
  const key = sha.toString('hex');
  const name = `${key}.${ext}`;
  copyFileSync(join(dist, path), join(out, name));
  return { hash: sha.toString('base64url'), key, fileExtension: `.${ext}`, url: `${baseUrl}/${name}` };
}

// a stable UUID from the content, so an unchanged app keeps the same update id
function uuidFrom(text) {
  const h = createHash('sha256').update(text).digest('hex').split('');
  h[12] = '4';
  h[16] = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  const s = h.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}

for (const [platform, meta] of Object.entries(metadata.fileMetadata)) {
  if (!['ios', 'android'].includes(platform)) continue;
  const launch = file(meta.bundle, 'bundle');
  const assets = meta.assets.map((a) => ({ ...file(a.path, a.ext), contentType: types[a.ext] ?? 'application/octet-stream' }));
  const manifest = {
    id: uuidFrom([runtimeVersion, platform, launch.hash, ...assets.map((a) => a.hash)].join(':')),
    createdAt: new Date().toISOString(),
    runtimeVersion,
    launchAsset: { ...launch, contentType: 'application/javascript' },
    assets,
    metadata: {},
    extra: { expoClient },
  };
  writeFileSync(join(out, `manifest-${platform}.json`), JSON.stringify(manifest));
  console.log(`${platform}: update ${manifest.id} — ${assets.length} assets`);
}
