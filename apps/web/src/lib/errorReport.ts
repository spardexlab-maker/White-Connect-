import { supabase } from './supabase';

// Unexpected errors go to «صحة النظام» (report_client_error). Message, page and build only —
// never form contents or patient data. At most 10 different reports per page load.
declare const __APP_VERSION__: string;
const seen = new Set<string>();
const IGNORE = /ResizeObserver loop|Non-Error promise rejection captured|AbortError|Load failed$/i;

export function reportError(err: unknown) {
  const e = err instanceof Error ? err : new Error(typeof err === 'string' ? err : JSON.stringify(err ?? 'unknown'));
  const message = `${e.name}: ${e.message}`.slice(0, 500);
  if (IGNORE.test(message) || seen.has(message) || seen.size >= 10) return;
  seen.add(message);
  void supabase.rpc('report_client_error', {
    p_source: 'web', p_message: message, p_stack: e.stack?.slice(0, 4000), p_url: location.pathname, p_app_version: `web-${__APP_VERSION__}`,
  }).then(() => undefined, () => undefined);
}

/** After a new release, an open tab may ask for a file that no longer exists: reload once instead of failing. */
export const isStaleBuild = (err: unknown) => /dynamically imported module|Importing a module script failed|ChunkLoadError/i.test(String((err as Error)?.message ?? err));

export function installErrorReporting() {
  window.addEventListener('error', (ev) => reportError(ev.error ?? ev.message));
  window.addEventListener('unhandledrejection', (ev) => reportError(ev.reason));
}
