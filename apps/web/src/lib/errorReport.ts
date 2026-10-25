import { sentry } from '@app/shared';
import { supabase } from './supabase';

// Unexpected errors go to «صحة النظام» (report_client_error). Message, page and build only —
// never form contents or patient data. At most 10 different reports per page load.
declare const __APP_VERSION__: string;
const seen = new Set<string>();
// loaded on demand, only when a DSN is configured (keeps the first page light)
let Sentry: typeof import('@sentry/react') | null = null;
const IGNORE = /ResizeObserver loop|Non-Error promise rejection captured|AbortError|Load failed$/i;

export function reportError(err: unknown) {
  const e = err instanceof Error ? err : new Error(typeof err === 'string' ? err : JSON.stringify(err ?? 'unknown'));
  Sentry?.captureException(e);
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
  // Sentry too (readable stacks, browser details); privacy first: no IP, no user, no bodies,
  // no query strings (they can carry codes), no performance or session recording.
  if (sentry.webDsn) void import('@sentry/react').then((S) => {
    Sentry = S;
    S.init({
      dsn: sentry.webDsn,
      release: `web@${__APP_VERSION__}`,
      environment: location.hostname === 'white.spardexlab.site' ? 'production' : 'preview',
      dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false, genAI: { inputs: false, outputs: false } },
      tracesSampleRate: 0,
      ignoreErrors: [IGNORE],
      beforeSend(event) {
        if (event.request) { delete event.request.cookies; delete event.request.data; if (event.request.url) event.request.url = event.request.url.split('?')[0]; delete event.request.query_string; }
        delete event.user;
        return event;
      },
      beforeBreadcrumb: (b) => (b.category === 'console' || b.category === 'ui.input' ? null : b),
    });
  }, () => undefined);
  window.addEventListener('error', (ev) => reportError(ev.error ?? ev.message));
  window.addEventListener('unhandledrejection', (ev) => reportError(ev.reason));
}
