import { Platform } from 'react-native';
import * as Updates from 'expo-updates';
import { supabase } from './supabase';

// Unexpected errors go to «صحة النظام» (report_client_error): message, screen and app version only.
const seen = new Set<string>();
const version = () => `${require('../../app.json').expo.version}${Updates.updateId ? `+${Updates.updateId.slice(0, 8)}` : ''}`;

export function reportError(err: unknown, screen?: string) {
  if (Platform.OS === 'web') return;   // the web build reports through the website's own path
  const e = err instanceof Error ? err : new Error(typeof err === 'string' ? err : String(err));
  const message = `${e.name}: ${e.message}`.slice(0, 500);
  if (seen.has(message) || seen.size >= 10) return;
  seen.add(message);
  void supabase.rpc('report_client_error', {
    p_source: Platform.OS === 'ios' ? 'ios' : 'android', p_message: message, p_stack: e.stack?.slice(0, 4000), p_url: screen, p_app_version: version(),
  }).then(() => undefined, () => undefined);
}

/** Errors outside a screen (timers, promises): report, then let React Native handle them as before. */
export function installErrorReporting() {
  const g = globalThis as unknown as { ErrorUtils?: { getGlobalHandler: () => (e: unknown, fatal?: boolean) => void; setGlobalHandler: (h: (e: unknown, fatal?: boolean) => void) => void } };
  if (!g.ErrorUtils) return;
  const previous = g.ErrorUtils.getGlobalHandler();
  g.ErrorUtils.setGlobalHandler((e, fatal) => { reportError(e, fatal ? 'fatal' : undefined); previous(e, fatal); });
}
