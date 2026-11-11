import type { PipeOrder } from './pipeModel';

export type ChannelRule = {
  id: string; name: string; field: 'label' | 'customer' | 'customer_id' | 'sku' | 'product';
  operator: 'contains' | 'equals' | 'starts_with'; value: string; channel: PipeOrder['channel'];
  priority: number; enabled: boolean; created_at?: string;
};
export const ruleFields = { label: 'Référence du bon de commande', customer: 'Nom du client', customer_id: 'Identifiant client Erplain', sku: 'Référence produit (SKU)', product: 'Nom du produit' };
export const ruleOperators = { contains: 'Contient', equals: 'Est égal à', starts_with: 'Commence par' };
const normalize = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

export function matchesRule(order: PipeOrder, rule: ChannelRule) {
  if (!rule.enabled || !rule.value.trim()) return false;
  const values = rule.field === 'sku' ? order.lines.map(l => l.sku) : rule.field === 'product' ? order.lines.map(l => l.label) : [order[rule.field]];
  const search = normalize(rule.value);
  return values.some(v => {
    if (!v) return false;
    const text = normalize(v);
    return rule.operator === 'equals' ? text === search : rule.operator === 'starts_with' ? text.startsWith(search) : text.includes(search);
  });
}

export function classifyOrders(orders: PipeOrder[], rules: ChannelRule[]) {
  const ranked = [...rules].filter(r => r.enabled).sort((a, b) => a.priority - b.priority || (a.created_at ?? '').localeCompare(b.created_at ?? '') || a.id.localeCompare(b.id));
  return orders.map(o => {
    const rule = ranked.find(r => matchesRule(o, r));
    return rule ? { ...o, channel: rule.channel, channel_rule: rule.name } : { ...o, channel_rule: null };
  });
}