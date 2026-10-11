// Pure catalogue grouping logic: offers (one per feed/country/language) -> variants -> models -> families.
export type Offer = {
  name: string; offer_id: string; feed_label: string | null; content_language: string | null;
  title: string | null; sku: string | null; color: string | null; size: string | null;
  item_group_id: string | null; product_type: string | null; image_link: string | null;
  price: number | null; currency: string | null; availability: string | null;
  custom_label_0: string | null; custom_label_1: string | null; custom_label_2: string | null;
  custom_label_3: string | null; custom_label_4: string | null;
  issues: any[] | null; shopify_variant_id: number | null; shopify_product_id: number | null; match_method: string | null;
};
export type Variant = {
  key: string; modelKey: string; family: string; title: string; color: string; sku: string | null;
  offers: Offer[]; labels: string[]; inStock: boolean; manual: boolean; identified: boolean;
  qty: number; revenue: number; image: string | null;
};
export type Model = { key: string; title: string; family: string; variants: Variant[] };
export type CountryStatus = 'approved' | 'disapproved' | 'pending' | 'absent';

export const UNIDENTIFIED = 'Non identifiées';
const LABEL_COLS = ['custom_label_0', 'custom_label_1', 'custom_label_2', 'custom_label_3', 'custom_label_4'] as const;

export function buildCatalog(
  offers: Offer[], products: Map<number, { title: string; product_type: string | null }>,
  manual: Map<string, { variant: number; product: number | null }>, sales: Map<number, { qty: number; rev: number }>,
) {
  const variants = new Map<string, Variant>();
  for (const o of offers) {
    const m = o.shopify_variant_id ? null : manual.get(o.offer_id);
    const vid = o.shopify_variant_id ?? m?.variant ?? null;
    const pid = o.shopify_product_id ?? m?.product ?? null;
    const key = vid ? `v:${vid}` : `o:${o.offer_id}`;
    let v = variants.get(key);
    if (!v) {
      const p = pid ? products.get(pid) : undefined;
      const identified = !!vid;
      v = {
        key, modelKey: identified && pid ? `p:${pid}` : `u:${(o.item_group_id ?? o.offer_id).replace(/^shopify_[A-Z]{2}_/, '')}`,
        family: identified ? (o.product_type || p?.product_type || 'Sans famille') : UNIDENTIFIED,
        title: o.title ?? o.offer_id, color: o.color || 'Sans couleur', sku: o.sku, offers: [], labels: [],
        inStock: false, manual: !!m && !o.shopify_variant_id, identified,
        qty: vid ? sales.get(vid)?.qty ?? 0 : 0, revenue: vid ? sales.get(vid)?.rev ?? 0 : 0, image: o.image_link,
      };
      variants.set(key, v);
    }
    v.offers.push(o);
    if (o.availability === 'IN_STOCK') v.inStock = true;
    for (const c of LABEL_COLS) { const val = o[c]; if (val) { const l = `${c.slice(-1)}:${val}`; if (!v.labels.includes(l)) v.labels.push(l); } }
  }
  const models = new Map<string, Model>();
  for (const v of variants.values()) {
    let m = models.get(v.modelKey);
    if (!m) {
      const pid = v.modelKey.startsWith('p:') ? Number(v.modelKey.slice(2)) : null;
      m = { key: v.modelKey, title: (pid && products.get(pid)?.title) || v.title, family: v.family, variants: [] };
      models.set(v.modelKey, m);
    }
    m.variants.push(v);
  }
  return { variants: [...variants.values()], models: [...models.values()] };
}

/** Best status of a variant in a country across its offers (several feeds may target the same country). */
export function variantStatus(v: Variant, statuses: Map<string, string> | undefined): CountryStatus {
  if (!statuses) return 'absent';
  let best: CountryStatus = 'absent';
  for (const o of v.offers) {
    const s = statuses.get(o.name);
    if (s === 'approved') return 'approved';
    if (s === 'disapproved') best = 'disapproved';
    else if (s === 'pending' && best === 'absent') best = 'pending';
  }
  return best;
}

/** Distinct disapproval reasons affecting a country. */
export function refusalReasons(v: Variant, country: string): string[] {
  const out = new Set<string>();
  for (const o of v.offers) for (const i of o.issues ?? []) {
    if (i?.severity === 'DISAPPROVED' && (i.countries ?? []).includes(country)) out.add(i.description || i.code);
  }
  return [...out];
}

export type Rules = { search?: string; family?: string; label?: string; availability?: string; eligibility?: string; country?: string };

export function matchesRules(v: Variant, modelTitle: string, r: Rules, statuses?: Map<string, string>) {
  if (r.family && r.family !== 'all' && v.family !== r.family) return false;
  if (r.label && r.label !== 'all' && !v.labels.includes(r.label)) return false;
  if (r.availability === 'in' && !v.inStock) return false;
  if (r.availability === 'out' && v.inStock) return false;
  if (r.eligibility && r.eligibility !== 'all' && r.country) {
    const s = variantStatus(v, statuses);
    if (r.eligibility === 'eligible' && s !== 'approved') return false;
    if (r.eligibility === 'refused' && s !== 'disapproved') return false;
    if (r.eligibility === 'absent' && s !== 'absent') return false;
  }
  const q = r.search?.trim().toLowerCase();
  if (q) {
    const hay = [v.title, modelTitle, v.sku, v.color, v.family, ...v.offers.map((o) => o.offer_id)].join(' ').toLowerCase();
    if (!q.split(/\s+/).every((w) => hay.includes(w))) return false;
  }
  return true;
}
