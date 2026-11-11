import { expect, it } from 'vitest';
import { customerRuleAssignments } from './customerRules';
import type { ChannelRule } from '@/components/pipe/pipeRules';
import type { PipeOrder } from '@/components/pipe/pipeModel';
const customers = [{ customer_id: 'c1', customer_name: 'Vélo Pro', channel: 'OEM', commercial_country: null }];
const rule = (patch: Partial<ChannelRule>): ChannelRule => ({ id: 'r1', name: 'Pro', field: 'customer', operator: 'contains', value: 'Pro', channel: 'b2b', enabled: true, priority: 100, ...patch });
it('classifies each customer once with the first matching priority across all orders', () => {
  const orders = [{ customer_id: 'c1', label: 'SO-1', lines: [] }, { customer_id: 'c1', label: 'SI-2', lines: [] }] as unknown as PipeOrder[];
  const result = customerRuleAssignments(customers, orders, [rule({}), rule({ id: 'r2', priority: 1, field: 'label', value: 'SI', channel: 'b2c' })]);
  expect(result).toHaveLength(1); expect(result[0].channel).toBe('B2C');
});
it('matches client names without loaded orders and leaves unmatched customers unchanged', () => {
  expect(customerRuleAssignments(customers, [], [rule({})])[0].channel).toBe('B2B');
  expect(customerRuleAssignments(customers, [], [rule({ value: 'Absent' })])).toEqual([]);
  expect(customers[0].channel).toBe('OEM');
});