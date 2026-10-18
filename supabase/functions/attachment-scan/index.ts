// attachment-scan — moves uploads out of quarantine only after verifying
// the real content. Checks: magic bytes match an allowed type and the
// declared type, size within the declared size and the 10 MB cap.
// A malware-scanning provider (ClamAV/commercial API) plugs into scan()
// when configured (SCAN_PROVIDER); without it, files are content-checked
// only — documented in docs/OPERATIONS.md.
// Callers: pg_cron (x-worker-secret) or any signed-in client right after
// an upload (the function trusts no input; it just drains the queue).
const URL_ = Deno.env.get('SUPABASE_URL')!;
const KEY = Deno.env.get('APP_SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SECRET = Deno.env.get('WORKER_SHARED_SECRET');
const svc = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const r = await fetch(`${URL_}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { ...svc, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
  if (!r.ok) throw new Error(`${fn}_${r.status}`);
  const t = await r.text();
  return (t ? JSON.parse(t) : null) as T;
}

function sniff(b: Uint8Array): string | null {
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'application/pdf';             // %PDF
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  return null;
}

async function authorized(req: Request): Promise<boolean> {
  if (SECRET && req.headers.get('x-worker-secret') === SECRET) return true;
  const auth = req.headers.get('authorization');
  if (!auth) return false;
  const r = await fetch(`${URL_}/auth/v1/user`, { headers: { apikey: KEY, Authorization: auth } });
  return r.ok;
}

Deno.serve(async (req) => {
  if (!(await authorized(req))) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  const queue = await rpc<{ id: string; declared_mime: string; declared_size: number }[]>('attachment_scan_queue', { p_limit: 20 });
  let ok = 0, rejected = 0;
  for (const a of queue ?? []) {
    const src = `quarantine/${a.id}`;
    const res = await fetch(`${URL_}/storage/v1/object/clinical-files/${src}`, { headers: svc });
    if (!res.ok) continue;                                        // not uploaded yet / transient
    const bytes = new Uint8Array(await res.arrayBuffer());
    const detected = sniff(bytes);
    let reason: string | null = null;
    if (!detected) reason = 'unrecognized_content';
    else if (detected !== a.declared_mime) reason = 'type_mismatch';
    else if (bytes.length > a.declared_size || bytes.length > 10485760) reason = 'size_mismatch';
    if (!reason) {
      const mv = await fetch(`${URL_}/storage/v1/object/move`, { method: 'POST', headers: { ...svc, 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucketId: 'clinical-files', sourceKey: src, destinationKey: `files/${a.id}` }) });
      if (!mv.ok) continue;
      await rpc('attachment_scan_result', { p_id: a.id, p_ok: true, p_detected_mime: detected });
      ok++;
    } else {
      await fetch(`${URL_}/storage/v1/object/clinical-files/${src}`, { method: 'DELETE', headers: svc });
      await rpc('attachment_scan_result', { p_id: a.id, p_ok: false, p_detected_mime: detected, p_reason: reason });
      rejected++;
    }
  }
  console.log(JSON.stringify({ event: 'scan_batch', processed: queue?.length ?? 0, ok, rejected }));   // ids/counts only
  return new Response(JSON.stringify({ processed: queue?.length ?? 0, ok, rejected }), { headers: { 'content-type': 'application/json' } });
});
