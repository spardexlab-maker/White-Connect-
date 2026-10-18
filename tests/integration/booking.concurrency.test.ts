import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { anonClient, ids, key, nextLocal, signIn } from './helpers';

/**
 * §18-a against the real API (PostgREST → RPC → Postgres) with real user
 * sessions: concurrent requests from the patient app and two receptions.
 */
describe('concurrent booking', () => {
  let hasan: SupabaseClient;
  let recA: SupabaseClient;
  let recB: SupabaseClient;
  const created: { client: () => SupabaseClient; id: string }[] = [];

  beforeAll(async () => {
    [hasan, recA, recB] = await Promise.all([
      signIn('hasan@demo.test'),
      signIn('reception.a@demo.test'),
      signIn('reception.b@demo.test'),
    ]);
  });

  afterAll(async () => {
    // release slots so the suite can be re-run against the same local DB
    for (const c of created) {
      await c.client().rpc('change_appointment_status', { p_appointment_id: c.id, p_to: 'cancelled', p_reason: 'test cleanup' });
    }
  });

  it('same slot from app and reception at the same moment: exactly one wins', async () => {
    // Thursday evening: Dr. Ahmed is scheduled at BOTH complexes
    const start = nextLocal(4, '16:00');
    const results = await Promise.all([
      hasan.rpc('book_appointment', {
        p_patient_id: ids.P_HASAN, p_facility_id: ids.A1, p_practitioner_id: ids.AHMED,
        p_service_id: ids.SVC_A30, p_start: start.toISOString(), p_idempotency_key: key('app'),
      }),
      recA.rpc('book_appointment', {
        p_patient_id: ids.P_ALI1, p_facility_id: ids.A1, p_practitioner_id: ids.AHMED,
        p_service_id: ids.SVC_A30, p_start: start.toISOString(), p_idempotency_key: key('rec'), p_source: 'reception',
      }),
    ]);
    const ok = results.filter((r) => !r.error);
    const failed = results.filter((r) => r.error);
    expect(ok).toHaveLength(1);
    expect(failed[0].error?.message).toBe('app:slot_unavailable');
    created.push({ client: () => recA, id: (ok[0].data as { id: string }).id });
  });

  it('different overlapping starts across two branches in parallel: exactly one wins', async () => {
    const t = nextLocal(4, '17:00');
    const plus = (min: number) => new Date(t.getTime() + min * 60_000).toISOString();
    const attempts = [
      hasan.rpc('book_appointment', {
        p_patient_id: ids.P_HASAN, p_facility_id: ids.A1, p_practitioner_id: ids.AHMED,
        p_service_id: ids.SVC_A30, p_start: plus(0), p_idempotency_key: key('app'),
      }),
      recA.rpc('book_appointment', {
        p_patient_id: ids.P_ALI1, p_facility_id: ids.A1, p_practitioner_id: ids.AHMED,
        p_service_id: ids.SVC_A15, p_start: plus(15), p_idempotency_key: key('recA'), p_source: 'reception',
      }),
      recB.rpc('book_appointment', {
        p_patient_id: ids.P_ZAINAB, p_facility_id: ids.B1, p_practitioner_id: ids.AHMED,
        p_service_id: ids.SVC_B30, p_start: plus(10), p_idempotency_key: key('recB'), p_source: 'reception',
      }),
    ];
    const results = await Promise.all(attempts);
    const ok = results.map((r, i) => ({ r, i })).filter(({ r }) => !r.error);
    expect(ok).toHaveLength(1);
    results.filter((r) => r.error).forEach((r) => expect(r.error?.message).toBe('app:slot_unavailable'));
    const winner = ok[0];
    created.push({ client: () => [recA, recA, recB][winner.i], id: (winner.r.data as { id: string }).id });
  });

  it('a burst of 12 parallel requests for one slot yields one appointment', async () => {
    const start = nextLocal(0, '18:00').toISOString();
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        recA.rpc('book_appointment', {
          p_patient_id: ids.P_ALI1, p_facility_id: ids.A1, p_practitioner_id: ids.AHMED,
          p_service_id: ids.SVC_A30, p_start: start, p_idempotency_key: key(`burst${i}`), p_source: 'reception',
        }),
      ),
    );
    const ok = results.filter((r) => !r.error);
    expect(ok).toHaveLength(1);
    created.push({ client: () => recA, id: (ok[0].data as { id: string }).id });
  });

  it('parallel retries with one idempotency key never duplicate', async () => {
    const k = key('retry');
    const start = nextLocal(1, '19:00').toISOString();
    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        hasan.rpc('book_appointment', {
          p_patient_id: ids.P_HASAN, p_facility_id: ids.A1, p_practitioner_id: ids.AHMED,
          p_service_id: ids.SVC_A30, p_start: start, p_idempotency_key: k,
        }),
      ),
    );
    const idsReturned = new Set(results.filter((r) => !r.error).map((r) => (r.data as { id: string }).id));
    expect(idsReturned.size).toBe(1);
    created.push({ client: () => recA, id: [...idsReturned][0] });
  });

  it('API isolation: anonymous and other patients cannot read appointments directly', async () => {
    const anon = anonClient();
    const anonRes = await anon.from('appointments').select('id').limit(1);
    expect(anonRes.error).not.toBeNull();
    const mona = await signIn('mona@demo.test');
    const monaRes = await mona.from('appointments').select('id, patient_id').eq('patient_id', ids.P_HASAN);
    expect(monaRes.error).toBeNull();
    expect(monaRes.data).toHaveLength(0);
  });
});
