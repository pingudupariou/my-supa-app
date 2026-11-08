import { describe, expect, it } from 'vitest';
import { filterOrders, pipeTotals, type PipeOrder } from './pipeModel';

const o = (p: Partial<PipeOrder>): PipeOrder => ({ id: '1', label: 'BC1', status: 'active', dated_at: '2026-11-03', shipping_at: null, shipping_status: null, billing_status: 'not_billed', payment_status: 'not_paid', currency: 'EUR', customer_id: null, customer: 'A', channel: 'b2b', total_ht: 100, total_ttc: 120, billed: 0, unbilled: 100, paid: 0, unpaid: 120, lines: [], ...p });
const none = { from: null, statuses: [], billing: [], payment: [], channels: [], search: '' };

describe('pipe commercial', () => {
  it('totals only the filtered orders', () => {
    const list = [o({}), o({ id: '2', billing_status: 'partially_billed', billed: 40, unbilled: 60 }), o({ id: '3', channel: 'b2c', unbilled: 10 })];
    const t = pipeTotals(filterOrders(list, { ...none, channels: ['b2b'] }));
    expect(t.count).toBe(2);
    expect(t.sum.unbilled).toBe(160);
  });
  it('filters by order date from the start of the month', () => {
    expect(filterOrders([o({}), o({ id: '2', dated_at: '2026-10-31' })], { ...none, from: '2026-11-01' }).map((x) => x.id)).toEqual(['1']);
  });
  it('never counts an empty amount as zero', () => {
    const t = pipeTotals([o({ unbilled: null })]);
    expect(t.missing.unbilled).toBe(1);
  });
});
