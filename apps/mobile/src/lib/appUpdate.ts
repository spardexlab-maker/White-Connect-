import { Platform } from 'react-native';
import * as Application from 'expo-application';
import { File, Paths } from 'expo-file-system';
import { getContentUriAsync } from 'expo-file-system/legacy';
import { startActivityAsync } from 'expo-intent-launcher';

/**
 * In-app updates for the test phase (APK side-loading, Android only).
 * New builds are published as GitHub Releases tagged `mobile-v<semver>`
 * by .github/workflows/mobile-release.yml; the app compares that tag with
 * its own version, downloads the APK inside the app and opens the system
 * installer. Android always asks the user to confirm the installation.
 */
const RELEASES_URL = 'https://api.github.com/repos/spardexlab-maker/White-Connect-/releases?per_page=10';
const TAG_PREFIX = 'mobile-v';

export interface AvailableUpdate { version: string; notes: string; url: string; sizeBytes: number; publishedAt: string }

export const currentVersion = (): string => Application.nativeApplicationVersion ?? '0.0.0';

function parse(v: string): number[] {
  return v.replace(/^v/, '').split('.').map((x) => Number.parseInt(x, 10) || 0);
}
export function isNewer(candidate: string, current: string): boolean {
  const a = parse(candidate), b = parse(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return false;
}

interface GhRelease { tag_name: string; body: string | null; draft: boolean; prerelease: boolean; published_at: string; assets: { name: string; browser_download_url: string; size: number }[] }

/** Newest published mobile release that is newer than this build, or null. */
export async function checkForUpdate(): Promise<AvailableUpdate | null> {
  // store builds update through Google Play; only side-loaded test builds fetch APKs
  if (Platform.OS !== 'android' || process.env.EXPO_PUBLIC_DISTRIBUTION === 'play') return null;
  const res = await fetch(RELEASES_URL, { headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error(`update check failed (${res.status})`);
  const releases = (await res.json()) as GhRelease[];
  const best = releases
    .filter((r) => !r.draft && r.tag_name.startsWith(TAG_PREFIX) && r.assets.some((a) => a.name.endsWith('.apk')))
    .sort((x, y) => (isNewer(x.tag_name.slice(TAG_PREFIX.length), y.tag_name.slice(TAG_PREFIX.length)) ? -1 : 1))[0];
  if (!best) return null;
  const version = best.tag_name.slice(TAG_PREFIX.length);
  if (!isNewer(version, currentVersion())) return null;
  const apk = best.assets.find((a) => a.name.endsWith('.apk'))!;
  return { version, notes: (best.body ?? '').trim(), url: apk.browser_download_url, sizeBytes: apk.size, publishedAt: best.published_at };
}

/** Downloads the APK (reporting 0..1 progress) and hands it to the system installer. */
export async function downloadAndInstall(update: AvailableUpdate, onProgress: (fraction: number) => void, signal?: AbortSignal): Promise<void> {
  const target = new File(Paths.cache, `abyad-${update.version}.apk`);
  if (target.exists) target.delete();
  const file = await File.downloadFileAsync(update.url, target, {
    idempotent: true,
    signal,
    onProgress: ({ bytesWritten, totalBytes }) => {
      const total = totalBytes > 0 ? totalBytes : update.sizeBytes;
      if (total > 0) onProgress(Math.min(1, bytesWritten / total));
    },
  });
  onProgress(1);
  const contentUri = await getContentUriAsync(file.uri);
  await startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    type: 'application/vnd.android.package-archive',
    flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
  });
}
