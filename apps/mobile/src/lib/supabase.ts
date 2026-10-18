import 'react-native-url-polyfill/auto';
import { AppState, Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@app/shared';
import { productDefaults } from '@app/shared';
import { secureStorage } from './secureStorage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const configMissing = !url || !key;
export const webUrl = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://white-connect.vercel.app';
export const productName = productDefaults.name;

/**
 * Client with the PUBLISHABLE key only. Every permission comes from the
 * signed-in user's JWT + RLS + RPC checks on the server.
 */
export const supabase = createClient<Database>(url ?? 'http://invalid.local', key ?? 'missing', {
  auth: {
    storage: secureStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

// Refresh tokens only while the app is in the foreground.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void supabase.auth.startAutoRefresh();
    else void supabase.auth.stopAutoRefresh();
  });
}
