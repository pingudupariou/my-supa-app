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
