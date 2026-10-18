import { beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ids, key, signIn } from './helpers';

const LAB_A = '00000000-0000-4000-f000-0000000000a3';
const pdf = new Blob([new TextEncoder().encode('%PDF-1.4\n% synthetic test result\n%%EOF\n')], { type: 'application/pdf' });
const fakePdf = new Blob([new TextEncoder().encode('<script>alert(1)</script>')], { type: 'application/pdf' });

/** §12 / §16: private result files through quarantine, readable only by allowed people. */
describe('clinical attachments', () => {
  let lab: SupabaseClient; let approver: SupabaseClient; let hasan: SupabaseClient; let mona: SupabaseClient; let doctor: SupabaseClient;
  let orderId = ''; let itemId = '';

  beforeAll(async () => {
    const rec = await signIn('reception.a@demo.test');
    [lab, approver, hasan, mona, doctor] = await Promise.all(['lab.a@demo.test', 'labapprover.a@demo.test', 'hasan@demo.test', 'mona@demo.test', 'dr.ahmed@demo.test'].map(signIn));
    const q = await rec.rpc('reception_quick_book', { p_facility_id: ids.A1, p_practitioner_id: ids.AHMED, p_idempotency_key: key('att-walkin'), p_patient_id: ids.P_HASAN });
    expect(q.error).toBeNull();
    // finish any open session of the doctor first (tests may run repeatedly)
    const { data: open } = await doctor.from('encounters').select('id').eq('status', 'in_progress');
    for (const e of open ?? []) await doctor.rpc('set_encounter_status', { p_encounter_id: e.id, p_status: 'completed' });
    const enc = await doctor.rpc('start_encounter', { p_queue_entry_id: (q.data as { queue_entry_id: string }).queue_entry_id, p_identity_verified: true });
    expect(enc.error).toBeNull();
    const { data: tests } = await doctor.from('lab_test_catalog').select('id').eq('lab_facility_id', LAB_A).eq('code', 'CBC');
    const order = await doctor.rpc('order_lab_tests', { p_encounter_id: (enc.data as { id: string }).id, p_lab_facility_id: LAB_A, p_test_ids: [tests![0].id], p_idempotency_key: key('att-order') });
    expect(order.error).toBeNull();
    orderId = (order.data as { id: string }).id;
    await doctor.rpc('set_encounter_status', { p_encounter_id: (enc.data as { id: string }).id, p_status: 'completed' });
    await lab.rpc('lab_check_in', { p_order_id: orderId });
    await lab.rpc('collect_specimen', { p_order_id: orderId, p_specimen_type: 'دم' });
    const { data: items } = await lab.from('lab_order_items').select('id').eq('order_id', orderId);
    itemId = items![0].id;
  });

  async function upload(client: SupabaseClient, blob: Blob, mime = 'application/pdf') {
    const req = await client.rpc('request_attachment_upload', { p_kind: 'lab_result', p_ref_id: orderId, p_file_name: 'result.pdf', p_mime: mime, p_size: blob.size });
    if (req.error) return { error: req.error };
    const { attachment_id, upload_path } = req.data as { attachment_id: string; upload_path: string };
    const up = await client.storage.from('clinical-files').upload(upload_path, blob, { contentType: mime });
    if (up.error) return { error: up.error };
    const sub = await client.rpc('submit_attachment', { p_id: attachment_id });
    if (sub.error) return { error: sub.error };
    const scan = await client.functions.invoke('attachment-scan', { body: {} });
    expect(scan.error).toBeNull();
    return { id: attachment_id };
  }

  it('patients and doctors cannot request uploads; disallowed types/sizes are refused', async () => {
    const r1 = await hasan.rpc('request_attachment_upload', { p_kind: 'lab_result', p_ref_id: orderId, p_file_name: 'x.pdf', p_mime: 'application/pdf', p_size: 10 });
    expect(r1.error?.message).toBe('app:forbidden');
    const r2 = await lab.rpc('request_attachment_upload', { p_kind: 'lab_result', p_ref_id: orderId, p_file_name: 'x.exe', p_mime: 'application/x-msdownload', p_size: 10 });
    expect(r2.error?.message).toBe('app:file_type_not_allowed');
    const r3 = await lab.rpc('request_attachment_upload', { p_kind: 'lab_result', p_ref_id: orderId, p_file_name: 'x.pdf', p_mime: 'application/pdf', p_size: 50_000_000 });
    expect(r3.error?.message).toBe('app:file_too_large');
  });

  it('cannot upload outside an approved quarantine slot', async () => {
    const up = await lab.storage.from('clinical-files').upload(`files/${crypto.randomUUID()}`, pdf, { contentType: 'application/pdf' });
    expect(up.error).not.toBeNull();
  });

  it('a fake PDF is rejected by content check', async () => {
    const r = await upload(lab, fakePdf);
    const { data } = await lab.rpc('list_attachments', { p_kind: 'lab_result', p_ref_id: orderId });
    const row = (data as { id: string; status: string; rejection_reason: string }[]).find((x) => x.id === r.id)!;
    expect(row.status).toBe('rejected');
    expect(row.rejection_reason).toBe('unrecognized_content');
  });

  it('a real PDF becomes available to lab staff; patient sees it only after release; others never', async () => {
    const r = await upload(lab, pdf);
    const labUrl = await lab.storage.from('clinical-files').createSignedUrl(`files/${r.id}`, 60);
    expect(labUrl.error).toBeNull();
    expect((await fetch(labUrl.data!.signedUrl)).status).toBe(200);

    const before = await hasan.storage.from('clinical-files').createSignedUrl(`files/${r.id}`, 60);
    expect(before.error).not.toBeNull();                                  // not released yet

    await lab.rpc('save_lab_result_draft', { p_order_item_id: itemId, p_value_text: 'انظر المرفق' });
    const rel = await approver.rpc('release_lab_results', { p_order_id: orderId, p_item_ids: [itemId] });
    expect(rel.error).toBeNull();

    const after = await hasan.storage.from('clinical-files').createSignedUrl(`files/${r.id}`, 60);
    expect(after.error).toBeNull();
    const doc = await doctor.storage.from('clinical-files').createSignedUrl(`files/${r.id}`, 60);
    expect(doc.error).toBeNull();
    const other = await mona.storage.from('clinical-files').createSignedUrl(`files/${r.id}`, 60);
    expect(other.error).not.toBeNull();
    const quarantinePeek = await hasan.storage.from('clinical-files').createSignedUrl(`quarantine/${r.id}`, 60);
    expect(quarantinePeek.error).not.toBeNull();
  });
});
