export type CrmDisplayFilter = { channels: string[]; categories: string[]; activity: 'all' | 'active' | 'inactive'; link: 'all' | 'linked' | 'new' };
export const DEFAULT_CRM_FILTER: CrmDisplayFilter = { channels: [], categories: [], activity: 'all', link: 'all' };
type C = { is_active: boolean; category_id: string | null; erplain_customer_id: string | null };
/** Display-only filter: never changes classification or data. Empty lists = no restriction. */
export function applyCrmFilter<T extends C>(clients: T[], f: CrmDisplayFilter, channelOf: (c: T) => string) {
  return clients.filter(c =>
    (!f.channels.length || f.channels.includes(channelOf(c))) &&
    (!f.categories.length || f.categories.includes(c.category_id ?? 'none')) &&
    (f.activity === 'all' || (f.activity === 'active') === c.is_active) &&
    (f.link === 'all' || (f.link === 'linked') === !!c.erplain_customer_id));
}
