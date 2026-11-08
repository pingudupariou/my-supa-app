export type PipeOrder = {
  id: string; label: string | null; status: string | null; dated_at: string | null; shipping_at: string | null; shipping_status: string | null;
  billing_status: string | null; payment_status: string | null; currency: string | null;
  customer_id: string | null; customer: string | null; channel: 'b2b' | 'oem' | 'b2c';
  total_ht: number | null; total_ttc: number | null; billed: number | null; unbilled: number | null; paid: number | null; unpaid: number | null;
  lines: { sku: string | null; label: string | null; quantity: number | null; shipped: number | null }[];
};

export type PipeFilters = {
  from: string | null; // YYYY-MM-DD inclusive, on order date
  statuses: string[]; billing: string[]; payment: string[]; channels: string[]; search: string;
};

const inSet = (list: string[], v: string | null) => !list.length || list.includes(v ?? '—');

export function filterOrders(orders: PipeOrder[], f: PipeFilters) {
  const q = f.search.trim().toLowerCase();
  return orders.filter((o) =>
    (!f.from || (o.dated_at ?? '').slice(0, 10) >= f.from) &&
    inSet(f.statuses, o.status) && inSet(f.billing, o.billing_status) && inSet(f.payment, o.payment_status) && inSet(f.channels, o.channel) &&
    (!q || `${o.label ?? ''} ${o.customer ?? ''}`.toLowerCase().includes(q)));
}

/** Totals add Erplain's own amounts; an empty amount is counted as missing, never as zero. */
export function pipeTotals(orders: PipeOrder[]) {
  const keys = ['total_ht', 'billed', 'unbilled', 'paid', 'unpaid'] as const;
  const sum = Object.fromEntries(keys.map((k) => [k, 0])) as Record<(typeof keys)[number], number>;
  const missing = Object.fromEntries(keys.map((k) => [k, 0])) as Record<(typeof keys)[number], number>;
  for (const o of orders) for (const k of keys) { const v = o[k]; if (v === null || !Number.isFinite(v)) missing[k]++; else sum[k] += v; }
  return { count: orders.length, sum, missing };
}

export function countBy(orders: PipeOrder[], key: 'status' | 'billing_status' | 'payment_status' | 'channel') {
  const m = new Map<string, number>();
  for (const o of orders) { const k = (o[key] as string | null) ?? '—'; m.set(k, (m.get(k) ?? 0) + 1); }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
