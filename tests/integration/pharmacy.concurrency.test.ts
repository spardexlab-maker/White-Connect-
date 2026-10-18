import { describe, expect, it } from 'vitest';
import { key, signIn } from './helpers';

const PH_A = '00000000-0000-4000-f000-0000000000a2';

/** §18-h: concurrent dispensing of the LAST pack succeeds exactly once. */
describe('pharmacy concurrency', () => {
  it('two simultaneous sales of the last unit: one wins, stock never negative', async () => {
    const [ph1, ph2] = await Promise.all([signIn('pharm.a@demo.test'), signIn('pharm.a@demo.test')]);
    const { data: product, error } = await ph1.rpc('upsert_pharmacy_product', {
      p_pharmacy_id: PH_A, p_name: `آخر عبوة ${key('p')}`, p_unit_price_minor: 1000, p_units_per_pack: 1, p_unit_name: 'عبوة',
    });
    expect(error).toBeNull();
    const productId = (product as { id: string }).id;
    const expiry = new Date(Date.now() + 200 * 86400_000).toISOString().slice(0, 10);
    const rec = await ph1.rpc('receive_stock', { p_product_id: productId, p_batch_no: 'ONE', p_expiry_date: expiry, p_packs: 1, p_unit_cost_minor: 500, p_idempotency_key: key('recv') });
    expect(rec.error).toBeNull();

    const sell = (c: typeof ph1) => c.rpc('direct_sale', {
      p_pharmacy_id: PH_A, p_lines: [{ product_id: productId, quantity: 1 }], p_source: 'otc', p_idempotency_key: key('sale'),
    });
    const results = await Promise.all([sell(ph1), sell(ph2), sell(ph1)]);
    const ok = results.filter((r) => !r.error);
    expect(ok).toHaveLength(1);
    results.filter((r) => r.error).forEach((r) => expect(r.error?.message).toBe('app:insufficient_stock'));

    const { data: stock } = await ph1.rpc('pharmacy_stock', { p_pharmacy_id: PH_A });
    const row = (stock as { product_id: string; on_hand: number }[]).find((s) => s.product_id === productId)!;
    expect(row.on_hand).toBe(0);
  });
});
