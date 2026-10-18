import { formatCurrency } from '@/data/financialConfig';

export interface BankYear {
  year: number;
  revenue: number;
  grossMargin: number;
  ebitda: number;
  netResult: number;
  treasuryEnd: number;
  netCashFlow: number;
}

export interface Variation { delta: number | null; pct: number | null }

/** Year-over-year change; percentage is null when the previous value is 0 (not meaningful). */
export function variation(current: number, previous: number | undefined): Variation {
  if (previous === undefined) return { delta: null, pct: null };
  const delta = current - previous;
  return { delta, pct: previous === 0 ? null : delta / Math.abs(previous) };
}

export function formatPct(p: number | null, digits = 1): string {
  if (p === null || !Number.isFinite(p)) return 'n.s.';
  return `${p >= 0 ? '+' : ''}${(p * 100).toFixed(digits).replace('.', ',')} %`;
}

export function formatDelta(d: number | null): string {
  if (d === null) return '—';
  return `${d >= 0 ? '+' : ''}${formatCurrency(d)}`;
}

const eur = (v: number) => formatCurrency(v);
const pct = (v: number) => `${(v * 100).toFixed(1).replace('.', ',')} %`;

export function revenueComment(rows: BankYear[]): string {
  if (!rows.length) return '';
  const first = rows[0], last = rows[rows.length - 1];
  const n = rows.length - 1;
  let text = `Le chiffre d'affaires passe de ${eur(first.revenue)} en ${first.year} à ${eur(last.revenue)} en ${last.year}`;
  if (n > 0 && first.revenue > 0 && last.revenue > 0) {
    text += `, soit une croissance annuelle moyenne de ${pct(Math.pow(last.revenue / first.revenue, 1 / n) - 1)}`;
  }
  let best: { year: number; delta: number } | null = null;
  for (let i = 1; i < rows.length; i++) {
    const d = rows[i].revenue - rows[i - 1].revenue;
    if (!best || d > best.delta) best = { year: rows[i].year, delta: d };
  }
  if (best && best.delta > 0) text += `. La plus forte progression intervient en ${best.year} (${formatDelta(best.delta)})`;
  return text + '.';
}

export function marginComment(rows: BankYear[]): string {
  if (!rows.length) return '';
  const first = rows[0], last = rows[rows.length - 1];
  const rate = (r: BankYear) => (r.revenue ? r.grossMargin / r.revenue : 0);
  const firstPositive = rows.find(r => r.ebitda > 0);
  const ebitdaText = rows.every(r => r.ebitda > 0)
    ? `L'EBITDA est positif sur toute la période (${eur(last.ebitda)} en ${last.year}).`
    : firstPositive
      ? `L'EBITDA devient positif en ${firstPositive.year} et atteint ${eur(last.ebitda)} en ${last.year}.`
      : `L'EBITDA reste négatif sur la période (${eur(last.ebitda)} en ${last.year}).`;
  return `Le taux de marge brute évolue de ${pct(rate(first))} en ${first.year} à ${pct(rate(last))} en ${last.year}. ${ebitdaText}`;
}

export function treasuryComment(rows: BankYear[], minTreasury: number, fundingNeed: number, amountRaised: number): string {
  if (!rows.length) return '';
  const last = rows[rows.length - 1];
  const lowest = rows.reduce((m, r) => (r.treasuryEnd < m.treasuryEnd ? r : m), rows[0]);
  let text = `Le point bas mensuel de trésorerie s'établit à ${eur(minTreasury)} ; en fin d'exercice, le minimum est atteint en ${lowest.year} (${eur(lowest.treasuryEnd)}). La trésorerie de fin de période atteint ${eur(last.treasuryEnd)}.`;
  text += fundingNeed > 0
    ? ` Le besoin de financement calculé est de ${eur(fundingNeed)}, pour ${eur(amountRaised)} de fonds levés prévus.`
    : ` Aucun besoin de financement complémentaire n'apparaît, avec ${eur(amountRaised)} de fonds levés prévus.`;
  return text;
}

export function netResultComment(rows: BankYear[]): string {
  if (!rows.length) return '';
  const cumulative = rows.reduce((s, r) => s + r.netResult, 0);
  const firstProfit = rows.find(r => r.netResult > 0);
  return `Le résultat net cumulé sur la période est de ${eur(cumulative)}. ${firstProfit ? `Le premier exercice bénéficiaire est ${firstProfit.year}.` : 'Aucun exercice bénéficiaire sur la période.'}`;
}
