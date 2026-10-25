// delete-account — «احذف حسابي». The signed-in patient asks (with confirm: 'DELETE');
// erase_account cuts the account off its medical record, stops reminders/pushes and
// blanks the profile, then the Auth user is soft-deleted: email, phone and Google
// sign-in are removed and every session ends, so the same number can start afresh.
// The medical record stays with the treating clinics (medical-records law).
const URL_ = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } });
const admin = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  let confirm = '';
  try { confirm = String((await req.json()).confirm ?? ''); } catch { /* checked below */ }
  if (confirm !== 'DELETE') return json({ error: 'confirm_required' }, 400);

  const who = await fetch(`${URL_}/auth/v1/user`, { headers: { apikey: ANON, Authorization: req.headers.get('Authorization') ?? '' } });
  if (!who.ok) return json({ error: 'not_signed_in' }, 401);
  const userId = (await who.json()).id as string;

  const erase = await fetch(`${URL_}/rest/v1/rpc/erase_account`, { method: 'POST', headers: admin, body: JSON.stringify({ p_user: userId }) });
  if (!erase.ok) { console.error('erase_account', erase.status, await erase.text()); return json({ error: 'delete_failed' }, 500); }
  const result = await erase.json();
  if (result === 'staff_account') return json({ error: 'staff_account' }, 409);
  if (result !== 'ok') return json({ error: 'delete_failed' }, 500);

  const del = await fetch(`${URL_}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers: admin, body: JSON.stringify({ should_soft_delete: true }) });
  if (!del.ok) { console.error('auth delete', del.status, await del.text()); return json({ error: 'delete_failed' }, 500); }
  return json({ ok: true });
});
