export const SEGMENTS = ['OEM', 'B2B_FR', 'B2B_EXPORT', 'B2C'] as const;
export const SEG_LABEL: Record<string, string> = { OEM: 'OEM', B2B_FR: 'B2B France', B2B_EXPORT: 'B2B hors France', B2C: 'B2C' };
export const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
export type RafRow = { year: number; month: number; segment: string; ca_ht: number };

/** grid[year][month 1-12][segment] ; 'ALL' = total facturé. Mois futurs = null (pas zéro). */
export function buildGrid(rows: RafRow[], years: number[], lastDoc: string | null) {
  const last = lastDoc ? new Date(lastDoc) : null;
  const g: Record<number, Record<number, Record<string, number | null>>> = {};
  for (const y of years) {
    g[y] = {};
    for (let m = 1; m <= 12; m++) {
      const future = last ? (y > last.getFullYear() || (y === last.getFullYear() && m > last.getMonth() + 1)) : false;
      g[y][m] = { ALL: future ? null : 0 };
      for (const s of SEGMENTS) g[y][m][s] = future ? null : 0;
    }
  }
  for (const r of rows) {
    const c = g[r.year]?.[r.month]; if (!c) continue;
    const v = Number(r.ca_ht) || 0;
    c[r.segment] = (c[r.segment] ?? 0) + v; c.ALL = (c.ALL ?? 0) + v;
  }
  return g;
}

export function yearShare(g: ReturnType<typeof buildGrid>, y: number) {
  const tot: Record<string, number> = {}; let all = 0;
  for (let m = 1; m <= 12; m++) for (const s of SEGMENTS) { const v = g[y]?.[m]?.[s] ?? 0; tot[s] = (tot[s] ?? 0) + v; all += v; }
  return SEGMENTS.map((s) => ({ segment: s, value: tot[s] ?? 0, pct: all ? ((tot[s] ?? 0) / all) * 100 : 0 }));
}

export type BacklogOrder = { status: string | null; dated_at: string | null; customer_id: string | number | null; channel: string | null; unbilled: number | null };
const isFR = (c: string | null | undefined) => ['FR', 'FRA', 'FRANCE'].includes(String(c ?? '').trim().toUpperCase());

/** Commandes actives : seul le reste à facturer est ajouté (la partie déjà facturée est dans les factures) — pas de double comptage. */
export function aggregateBacklog(orders: BacklogOrder[], countries: Record<string, string | null>, channels: Record<string, string>) {
  const acc = new Map<string, { year: number; month: number; segment: string; unbilled_ht: number; orders: number }>();
  for (const o of orders) {
    if (!['active', 'pending_validation'].includes(String(o.status))) continue;
    const v = Number(o.unbilled); if (!o.dated_at || !Number.isFinite(v) || v <= 0) continue;
    const id = String(o.customer_id ?? '');
    const raw = (channels[id] ?? o.channel ?? 'B2C').toUpperCase();
    const ch = raw === 'B2B' || raw === 'OEM' ? raw : 'B2C';
    const segment = ch === 'B2B' ? (isFR(countries[id]) ? 'B2B_FR' : 'B2B_EXPORT') : ch;
    const year = Number(o.dated_at.slice(0, 4)), month = Number(o.dated_at.slice(5, 7));
    const k = `${year}-${month}-${segment}`;
    const cur = acc.get(k) ?? { year, month, segment, unbilled_ht: 0, orders: 0 };
    cur.unbilled_ht += v; cur.orders += 1; acc.set(k, cur);
  }
  return [...acc.values()].map((r) => ({ ...r, unbilled_ht: Math.round(r.unbilled_ht * 100) / 100 }));
}

export type Unit = 'eur' | 'keur';
export function fmtAmount(v: number | null | undefined, unit: Unit, suffix = true) {
  if (v == null) return '';
  return unit === 'keur' ? `${(v / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })}${suffix ? ' k€' : ''}` : `${Math.round(v).toLocaleString('fr-FR')}${suffix ? ' €' : ''}`;
}
