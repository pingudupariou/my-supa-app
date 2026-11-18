import type { ClassifiedCustomer } from './classificationModel';
import { matchesRule, type ChannelRule } from '@/components/pipe/pipeRules';
import type { PipeOrder } from '@/components/pipe/pipeModel';

export type RuleAssignment = { customer: ClassifiedCustomer; channel: string; rule: string; conflict: string[] };

/** One channel per customer: first enabled rule by priority wins. With resetUnmatched,
 *  customers no rule recognises go back to A_CLASSER so old categories cannot linger. */
export function customerRuleAssignments(customers: ClassifiedCustomer[], orders: PipeOrder[], rules: ChannelRule[], opts: { resetUnmatched?: boolean } = {}): RuleAssignment[] {
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
    const hits = ranked.filter(r => matchesRule(identity, r) || samples.some(o => matchesRule(o,r)));
    if (hits.length) {
      const channel = hits[0].channel.toUpperCase();
      const conflict = [...new Set(hits.map(h => h.channel.toUpperCase()))].filter(c => c !== channel);
      return [{ customer, channel, rule: hits[0].name, conflict }];
    }
    return opts.resetUnmatched && customer.channel !== 'A_CLASSER' ? [{ customer, channel: 'A_CLASSER', rule: 'Aucune règle (ancienne catégorie retirée)', conflict: [] }] : [];
  });
}
