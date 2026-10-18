import { execSync } from 'node:child_process';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Local stack credentials come from `supabase status` — never hard-coded. */
function localEnv(): { url: string; anon: string } {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    return { url: process.env.SUPABASE_URL, anon: process.env.SUPABASE_ANON_KEY };
  }
  const out = execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const json = JSON.parse(out.slice(out.indexOf('{')));
  return { url: json.API_URL, anon: json.ANON_KEY };
}

export const DEMO_PASSWORD = 'Demo-Pass-2026!';
export const ids = {
  A1: '00000000-0000-4000-f000-0000000000a1',
  B1: '00000000-0000-4000-f000-0000000000b1',
  AHMED: '00000000-0000-4000-9000-000000000010',
  SVC_A30: '00000000-0000-4000-6000-000000000001',
  SVC_A15: '00000000-0000-4000-6000-000000000002',
  SVC_B30: '00000000-0000-4000-6000-000000000004',
  P_HASAN: '00000000-0000-4000-5000-000000000050',
  P_ALI1: '00000000-0000-4000-5000-000000000060',
  P_ZAINAB: '00000000-0000-4000-5000-000000000062',
};

export async function signIn(email: string): Promise<SupabaseClient> {
  const { url, anon } = localEnv();
  const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: DEMO_PASSWORD });
  if (error) throw error;
  return client;
}

export function anonClient(): SupabaseClient {
  const { url, anon } = localEnv();
  return createClient(url, anon, { auth: { persistSession: false } });
}

/** Next date (Asia/Baghdad) with the given weekday, at least `minDays` ahead, at HH:MM local. */
export function nextLocal(weekday: number, hhmm: string, minDays = 2): Date {
  const nowBaghdad = new Date(Date.now() + 3 * 3600_000); // Baghdad is UTC+3, no DST
  const d = new Date(Date.UTC(nowBaghdad.getUTCFullYear(), nowBaghdad.getUTCMonth(), nowBaghdad.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + minDays);
  while (d.getUTCDay() !== weekday) d.setUTCDate(d.getUTCDate() + 1);
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(d.getTime() + ((h - 3) * 60 + m) * 60_000);
}

export const key = (label: string) => `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
