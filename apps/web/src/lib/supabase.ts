import { createClient } from '@supabase/supabase-js';
import type { Database } from '@app/shared';
import { productDefaults } from '@app/shared';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const configMissing = !url || !key;

/**
 * Browser client with the PUBLISHABLE key only. Every permission comes
 * from the signed-in user's JWT + RLS + RPC checks on the server.
 * The session is kept in sessionStorage (cleared when the tab closes) to
 * avoid long-lived tokens in localStorage on shared clinic computers.
 */
export const supabase = createClient<Database>(url ?? 'http://invalid.local', key ?? 'missing', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
  },
});

export const productName = import.meta.env.VITE_PRODUCT_NAME || productDefaults.name;
