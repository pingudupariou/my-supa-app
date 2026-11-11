import { describe, expect, it } from 'vitest';
import { classifyOrders, matchesRule, type ChannelRule } from './pipeRules';
import { pipePeriod, validPeriod } from './pipePeriods';
import { filterOrders, type PipeOrder } from './pipeModel';
const order: PipeOrder = { id: '1', label: 'OEM-2026', customer: 'Société Vélo', customer_id: '42', channel: 'b2b', status: 'active', dated_at: '2026-10-31T18:00:00Z', shipping_at: null, shipping_status: null, billing_status: null, payment_status: null, currency: null, total_ht: 100, total_ttc: 120, billed: 0, unbilled: 100, paid: 0, unpaid: 120, lines: [{ sku: 'NR-01', label: 'Pédale', quantity: 2, shipped: 0 }] };
const rule: ChannelRule = { id: 'r1', name: 'Commandes OEM', field: 'label', operator: 'starts_with', value: 'OEM-', channel: 'oem', priority: 1, enabled: true };
describe('Pipe channel rules', () => {
  it('classifies by order reference without changing the original order', () => { expect(classifyOrders([order], [rule])[0].channel).toBe('oem'); expect(order.channel).toBe('b2b'); });
  it('matches customer names ignoring accents and case', () => { expect(matchesRule(order, { ...rule, field: 'customer', operator: 'contains', value: 'VELO' })).toBe(true); });
  it('supports exact customer IDs', () => { expect(matchesRule(order, { ...rule, field: 'customer_id', operator: 'equals', value: '42' })).toBe(true); expect(matchesRule(order, { ...rule, field: 'customer_id', operator: 'equals', value: '4' })).toBe(false); });
  it('matches SKU and product labels', () => { expect(matchesRule(order, { ...rule, field: 'sku', value: 'NR-' })).toBe(true); expect(matchesRule(order, { ...rule, field: 'product', operator: 'equals', value: 'pedale' })).toBe(true); });
  it('uses only the first enabled rule by priority', () => { expect(classifyOrders([order], [{ ...rule, id: 'r2', priority: 2, channel: 'b2c' }, rule])[0].channel).toBe('oem'); });
  it('retains the sales classification when disabled or unmatched', () => { expect(classifyOrders([order], [{ ...rule, enabled: false }])[0].channel).toBe('b2b'); expect(classifyOrders([order], [{ ...rule, value: 'OTHER' }])[0].channel).toBe('b2b'); });
  it('allows B2C classification', () => { expect(classifyOrders([order], [{ ...rule, channel: 'b2c' }])[0].channel).toBe('b2c'); });
});
describe('Pipe periods', () => {
  const now = new Date('2026-11-11T12:00:00');
  it('reads the full previous month', () => { expect(pipePeriod('previous', '', '', '', now)).toEqual({ from: '2026-10-01', to: '2026-10-31' }); });
  it('supports older selected months and leap years', () => { expect(pipePeriod('pick_month', '2024-02', '', '', now)).toEqual({ from: '2024-02-01', to: '2024-02-29' }); });
  it('keeps custom start and end inclusive', () => { const range = pipePeriod('custom', '', '2026-10-01', '2026-10-31', now); expect(filterOrders([order, { ...order, id: '2', dated_at: '2026-11-01' }], { ...range, statuses: [], billing: [], payment: [], channels: [], search: '' }).map(o => o.id)).toEqual(['1']); });
  it('rejects reversed and invalid dates', () => { expect(validPeriod('2026-11-11', '2026-10-31')).toBe(false); expect(validPeriod('2026-02-30', '2026-03-01')).toBe(false); });
});