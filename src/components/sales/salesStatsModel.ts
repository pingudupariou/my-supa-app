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
export const CH_LABEL: Record<string, string> = { B2C: 'B2C (Shopify)', B2B: 'B2B', OEM: 'OEM', A_CLASSER: 'À classer' };

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
