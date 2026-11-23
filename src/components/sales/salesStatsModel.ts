import { liveChannelMap } from '@/components/customers/useChannelLabels';
import { num, txt, type Cell } from '@/lib/clipboard';

export type Row = {
  key: string;
  label?: string;
  channel?: string;
  ca_ht: number;
  qty: number;
  default_share?: number;
  prod_ht?: number;
  cogs?: number;
  cov_ht?: number;
  est_ht?: number;
  unit_cost?: number | null;
};

export type Customers = Record<string, { channel: string; commercial_country: string | null }>;

export const CHANNELS = ['B2C', 'B2B', 'OEM', 'A_CLASSER'] as const;
export const CH_LABEL: Record<string, string> = liveChannelMap({ A_CLASSER: 'À classer' });

/** Margin on lines with a validated cost only; incomplete if some product revenue has no cost, estimated if a current cost is applied to older sales. */
export function margin(r: { prod_ht?: number; cogs?: number; cov_ht?: number; est_ht?: number }) {
  const prod = r.prod_ht ?? 0, cov = r.cov_ht ?? 0, cogs = r.cogs ?? 0;
  const m = cov - cogs;
  return { m: cov ? m : null, pct: cov ? m / cov : null, coverage: prod ? cov / prod : null, incomplete: Math.abs(prod - cov) > 0.5, estimated: (r.est_ht ?? 0) > 0.5 };
}

export type DetailKind = 'customer' | 'product' | 'country' | 'cc';

/**
 * The detail tables, as tab-separated rows: same filter, same columns, same numbers as the screen.
 * Missing values stay empty (never 0); estimated margins and incomplete cost coverage go in the "Note" column.
 */
export function detailTSV(
  kind: DetailKind,
  rows: Row[],
  customers: Customers,
  search: string,
  canWrite: boolean,
): { headers: string[]; body: Cell[][] } {
  const q = search.trim().toLowerCase();
  const list = rows.filter((r) => !q || `${r.key} ${r.label ?? ''}`.toLowerCase().includes(q));

  const headers: string[] = kind === 'customer'
    ? ['Client', 'Canal', 'Pays commercial']
    : kind === 'cc'
      ? ['Pays', 'Pays par défaut']
      : [kind === 'product' ? 'Produit' : 'Pays'];
  headers.push('CA HT net', 'Quantités');
  if (kind === 'product') headers.push('Coût unit.');
  headers.push('Coût vendu', 'Marge €', 'Marge %', 'Couverture coûts %', 'Note');

  const body = list.map((r) => {
    const c = customers[r.key];
    const x = margin(r);
    const notes = [x.estimated ? 'marge estimée' : '', x.incomplete ? 'couverture incomplète' : ''].filter(Boolean).join(' ; ');
    const out: Cell[] = [];
    if (kind === 'customer') {
      const canal = r.channel === 'B2C' || !canWrite || r.key == null
        ? CH_LABEL[r.channel ?? 'A_CLASSER']
        : CH_LABEL[c?.channel ?? 'A_CLASSER'];
      out.push(txt(r.label || r.key), canal, txt(c?.commercial_country || 'auto'));
    } else {
      out.push(txt(r.label || r.key));
      if (kind === 'cc') out.push(r.default_share == null ? '' : num(r.default_share * 100, 0) + ' %');
    }
    out.push(num(r.ca_ht), num(r.qty, 1));
    if (kind === 'product') out.push(r.unit_cost == null ? 'coût manquant' : num(r.unit_cost));
    out.push(num(r.cogs), num(x.m), x.pct == null ? '' : num(x.pct * 100, 1), x.coverage == null ? '' : num(x.coverage * 100, 1), notes);
    return out;
  });

  return { headers, body };
}

/** Plan-product category for each Erplain sales product key (variant id), from the product plan's own grouping. */
export function categoryIndex(
  products: { id: string; name?: string; productCategoryId?: string; erplainMembers?: string[] }[],
  categories: { id: string; name: string }[],
): Record<string, string> {
  const names = Object.fromEntries(categories.map((c) => [c.id, c.name]));
  const out: Record<string, string> = {};
  for (const p of products) {
    const grouped = !!p.erplainMembers?.length;
    // A plan row grouping several Erplain products is itself a category; otherwise use the visual category if any.
    const name = (p.productCategoryId ? names[p.productCategoryId] : undefined) ?? (grouped ? p.name : undefined);
    if (!name) continue;
    const keys = grouped ? p.erplainMembers! : p.id.startsWith('erplain-') ? [p.id.slice(8)] : [];
    for (const k of keys) out[k] = name;
  }
  return out;
}

export const NO_CATEGORY = 'Sans catégorie (plan produit)';

/** Sum rows by category; each product counts once in exactly one category. */
export function byCategory(rows: Row[], idx: Record<string, string>): Row[] {
  const m: Record<string, Row> = {};
  for (const r of rows) {
    const k = idx[r.key] ?? NO_CATEGORY;
    const o = m[k] ?? (m[k] = { key: k, label: k, ca_ht: 0, qty: 0, prod_ht: 0, cogs: 0, cov_ht: 0, est_ht: 0 });
    o.ca_ht += r.ca_ht; o.qty += r.qty; o.prod_ht! += r.prod_ht ?? 0; o.cogs! += r.cogs ?? 0; o.cov_ht! += r.cov_ht ?? 0; o.est_ht! += r.est_ht ?? 0;
  }
  return Object.values(m).sort((a, b) => b.ca_ht - a.ca_ht);
}

export type PivotMetric = 'ca' | 'qty' | 'margin' | 'pct';
export const metricOf = (r: Row | undefined, m: PivotMetric): number | null => {
  if (!r) return null;
  if (m === 'ca') return r.ca_ht;
  if (m === 'qty') return r.qty;
  const x = margin(r);
  return m === 'margin' ? x.m : x.pct == null ? null : x.pct * 100;
};

export type PivotRow = { key: string; label: string; cells: (number | null)[]; total: number | null };

/** Rows = items, columns = chosen channels in the chosen order, plus a total computed from the summed raw values. */
export function buildPivot(perChannel: Record<string, Row[]>, order: string[], metric: PivotMetric, sort: 'total' | 'name' | string): PivotRow[] {
  const items = new Map<string, { label: string; cols: Record<string, Row> }>();
  for (const ch of order) for (const r of perChannel[ch] ?? []) {
    const it = items.get(r.key) ?? { label: (r.label || r.key || '?').trim(), cols: {} };
    it.cols[ch] = r; items.set(r.key, it);
  }
  const sum = (rs: Row[]): Row => rs.reduce((a, r) => ({ ...a, ca_ht: a.ca_ht + r.ca_ht, qty: a.qty + r.qty, prod_ht: a.prod_ht! + (r.prod_ht ?? 0), cogs: a.cogs! + (r.cogs ?? 0), cov_ht: a.cov_ht! + (r.cov_ht ?? 0), est_ht: a.est_ht! + (r.est_ht ?? 0) }), { key: '', ca_ht: 0, qty: 0, prod_ht: 0, cogs: 0, cov_ht: 0, est_ht: 0 } as Row);
  const rows = [...items].map(([key, it]) => ({ key, label: it.label, cells: order.map((c) => metricOf(it.cols[c], metric)), total: metricOf(sum(Object.values(it.cols)), metric) }));
  const v = (x: number | null) => x ?? -Infinity;
  if (sort === 'name') rows.sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  else if (sort === 'total') rows.sort((a, b) => v(b.total) - v(a.total));
  else { const i = order.indexOf(sort); rows.sort((a, b) => v(b.cells[i]) - v(a.cells[i])); }
  return rows;
}

export type CrossLine = Row & { channel: string; customer: string; customer_label?: string };
export type CrossDim = 'category' | 'customer' | 'product';
const dimVal = (l: CrossLine, d: CrossDim, idx: Record<string, string>): [string, string] =>
  d === 'customer' ? [l.customer, (l.customer_label || l.customer).trim()] : d === 'product' ? [l.key, (l.label || l.key).trim()] : [idx[l.key] ?? NO_CATEGORY, idx[l.key] ?? NO_CATEGORY];

/** Customer × product lines grouped by one or two dimensions, channels as columns; filters keep only chosen customers / categories. */
export function crossPivot(lines: CrossLine[], a: CrossDim, b: CrossDim | null, idx: Record<string, string>, order: string[], metric: PivotMetric, sort: string,
  filter: { customers?: string[]; categories?: string[] } = {}): PivotRow[] {
  const per: Record<string, Record<string, Row>> = {};
  for (const l of lines) {
    if (filter.customers?.length && !filter.customers.includes(l.customer)) continue;
    if (filter.categories?.length && !filter.categories.includes(idx[l.key] ?? NO_CATEGORY)) continue;
    const [ka, la] = dimVal(l, a, idx); const [kb, lb] = b ? dimVal(l, b, idx) : ['', ''];
    const key = b ? `${ka}\u0001${kb}` : ka; const label = b ? `${la} › ${lb}` : la;
    const m = per[l.channel] ??= {};
    const o = m[key] ??= { key, label, ca_ht: 0, qty: 0, prod_ht: 0, cogs: 0, cov_ht: 0, est_ht: 0 };
    o.ca_ht += l.ca_ht; o.qty += l.qty; o.prod_ht! += l.prod_ht ?? 0; o.cogs! += l.cogs ?? 0; o.cov_ht! += l.cov_ht ?? 0; o.est_ht! += l.est_ht ?? 0;
  }
  const rows = buildPivot(Object.fromEntries(Object.entries(per).map(([c, m]) => [c, Object.values(m)])), order, metric, sort);
  if (b && sort !== 'name') { // keep sub-rows under their group, groups ordered by their own total
    const g: Record<string, number> = {};
    for (const r of rows) { const k = r.key.split('\u0001')[0]; g[k] = (g[k] ?? 0) + (r.total ?? 0); }
    rows.sort((x, y) => { const gx = x.key.split('\u0001')[0], gy = y.key.split('\u0001')[0]; return gx === gy ? 0 : g[gy] - g[gx]; });
  }
  return rows;
}
