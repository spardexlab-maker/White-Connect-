import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Session storage for supabase-js. On devices the session lives in the
 * OS keychain/keystore (expo-secure-store), split into chunks because
 * some platforms limit a single value to ~2 KB. The web preview keeps it
 * in sessionStorage only (cleared when the tab closes).
 */
const CHUNK = 1800;

async function nativeGet(key: string): Promise<string | null> {
  const count = await SecureStore.getItemAsync(`${key}.n`);
  if (!count) return null;
  const parts: string[] = [];
  for (let i = 0; i < Number(count); i++) {
    const part = await SecureStore.getItemAsync(`${key}.${i}`);
    if (part == null) return null;
    parts.push(part);
  }
  return parts.join('');
}

async function nativeRemove(key: string): Promise<void> {
  const count = Number((await SecureStore.getItemAsync(`${key}.n`)) ?? 0);
  for (let i = 0; i < count; i++) await SecureStore.deleteItemAsync(`${key}.${i}`);
  await SecureStore.deleteItemAsync(`${key}.n`);
}

async function nativeSet(key: string, value: string): Promise<void> {
  await nativeRemove(key);
  const n = Math.ceil(value.length / CHUNK);
  for (let i = 0; i < n; i++) await SecureStore.setItemAsync(`${key}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK));
  await SecureStore.setItemAsync(`${key}.n`, String(n));
}

const web = {
  getItem: async (k: string) => (typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(k)),
  setItem: async (k: string, v: string) => { if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(k, v); },
  removeItem: async (k: string) => { if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(k); },
};

export const secureStorage = Platform.OS === 'web'
  ? web
  : { getItem: nativeGet, setItem: nativeSet, removeItem: nativeRemove };
