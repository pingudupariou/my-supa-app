import type { ClassifiedCustomer } from './classificationModel';
import { matchesRule, type ChannelRule } from '@/components/pipe/pipeRules';
import type { PipeOrder } from '@/components/pipe/pipeModel';

export function customerRuleAssignments(customers: ClassifiedCustomer[], orders: PipeOrder[], rules: ChannelRule[]) {
  const byCustomer = new Map<string, PipeOrder[]>();
  for (const order of orders) {
    if (!order.customer_id) continue;
    const id = String(order.customer_id);
    const list = byCustomer.get(id) ?? [];
    list.push(order); byCustomer.set(id, list);
  }
  const ranked = [...rules].filter(r => r.enabled).sort((a,b) => a.priority - b.priority || (a.created_at ?? '').localeCompare(b.created_at ?? '') || a.id.localeCompare(b.id));
  return customers.flatMap(customer => {
    const samples = byCustomer.get(customer.customer_id) ?? [];
    const identity = { customer: customer.customer_name, customer_id: customer.customer_id, label: null, lines: [] } as unknown as PipeOrder;
    const rule = ranked.find(r => matchesRule(identity, r) || samples.some(o => matchesRule(o,r)));
    return rule ? [{ customer, channel: rule.channel.toUpperCase(), rule: rule.name }] : [];
  });
}