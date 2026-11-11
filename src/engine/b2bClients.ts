import type { B2BClientSplit, ClientCurrentYearActual, CurrentYearMethod, PlanB2BClient, Product } from './types';

/** Ligne du plan liée à Erplain (catégorie avec produits Erplain ou produit Erplain individuel). */
export function erplainKeysOf(p: Product): string[] {
  if (p.erplainMembers?.length) return [...new Set(p.erplainMembers.filter(k => !k.startsWith('manual:')))];
  return p.id.startsWith('erplain-') ? [p.id.slice(8)] : [];
}
/** Toutes les lignes peuvent détailler leur B2B par client ; l'import d'historique exige des produits Erplain. */
export const supportsB2BClients = (_p: Product) => true;
export const hasErplainHistory = (p: Product) => erplainKeysOf(p).length > 0;

/** Volume effectif d'un client : volume de base, ajusté de « adjustment » % à partir de l'année de départ. */
export function clientVolume(c: PlanB2BClient, year: number): number {
  const base = c.volumes[year] || 0;
  if (!c.adjustment || c.startYear === undefined || year < c.startYear) return base;
  return Math.round(base * (1 + c.adjustment / 100));
}

export const b2bTotal = (split: B2BClientSplit, year: number) =>
  split.clients.reduce((sum, c) => sum + clientVolume(c, year), 0);

/** Si la répartition est active, le B2B de la ligne devient la somme des clients (source unique). */
export function syncB2BClients(p: Product): Product {
  const split = p.b2bClients;
  if (!split?.enabled || !split.clients.length) return p;
  const ch = p.volumesByChannel ?? { B2C: {}, B2B: {}, OEM: {} };
  const years = new Set([...Object.keys(ch.B2B || {}), ...split.clients.flatMap(c => Object.keys(c.volumes))].map(Number));
  const B2B: Record<number, number> = {};
  years.forEach(y => { B2B[y] = b2bTotal(split, y); });
  return { ...p, volumesByChannel: { ...ch, B2B } };
}

export const CURRENT_YEAR_METHODS: { id: CurrentYearMethod; label: string; help: string }[] = [
  { id: 'ytd', label: 'Réalisé à date', help: 'Ventes Erplain depuis le 1er janvier, sans extrapolation' },
  { id: 'prorata', label: 'Prorata', help: 'Ventes à date ÷ part de l’année écoulée' },
  { id: 'season', label: 'Saisonnalité N-1', help: 'Ventes à date × (total N-1 ÷ N-1 à la même date) ; sans N-1, prorata' },
  { id: 'recent', label: 'Rythme 90 j', help: 'Ventes à date + rythme des 90 derniers jours × jours restants' },
  { id: 'manual', label: 'Saisie libre', help: 'Valeur saisie ou calculée par la croissance' },
];

const DAY = 86400000;
/** Part de l'année écoulée à la date de lecture, et jours restants. */
export function yearProgress(year: number, asOf: string) {
  const start = Date.UTC(year, 0, 1), end = Date.UTC(year + 1, 0, 1);
  const total = Math.round((end - start) / DAY);
  const elapsed = Math.min(total, Math.max(1, Math.round((Date.parse(asOf) - start) / DAY) + 1));
  return { fraction: elapsed / total, remaining: total - elapsed };
}

/** Volume de l'année en cours selon la méthode (null = saisie libre). */
export function currentYearValue(a: ClientCurrentYearActual, m: CurrentYearMethod): number | null {
  if (m === 'manual') return null;
  if (m === 'ytd') return Math.round(a.ytd);
  const { fraction, remaining } = yearProgress(a.year, a.asOf);
  if (m === 'recent') return Math.round(a.ytd + (a.recent90 / 90) * remaining);
  if (m === 'season' && a.n1Same > 0) return Math.round(a.ytd * (a.n1 / a.n1Same));
  return Math.round(a.ytd / fraction);
}

/** Années protégées de la croissance : réalisé Erplain, et année en cours si son chiffre vient d'Erplain. */
export function lockedYears(c: PlanB2BClient, split: Pick<B2BClientSplit, 'historyYears'>): number[] {
  const locked = c.origin ? [...(split.historyYears ?? [])] : [];
  if (c.actual && (c.cyMethod ?? 'ytd') !== 'manual') locked.push(c.actual.year);
  return locked;
}

/** Choisit le chiffre de l'année en cours d'un client (le volume est recalculé depuis Erplain). */
export function setCurrentYearMethod(c: PlanB2BClient, m: CurrentYearMethod): PlanB2BClient {
  if (!c.actual) return c;
  const v = currentYearValue(c.actual, m);
  return { ...c, cyMethod: m, volumes: v === null ? c.volumes : { ...c.volumes, [c.actual.year]: v } };
}

/** Revient au réalisé Erplain d'origine (années passées + année en cours à date) ; prévisions futures conservées. */
export function restoreOrigin(c: PlanB2BClient): PlanB2BClient {
  if (!c.origin) return c;
  return { ...c, volumes: { ...c.volumes, ...c.origin }, ...(c.actual ? { cyMethod: 'ytd' as const } : {}) };
}

export const differsFromOrigin = (c: PlanB2BClient) =>
  !!c.origin && Object.entries(c.origin).some(([y, v]) => (c.volumes[Number(y)] || 0) !== v);

/** Croissance annuelle du client à partir de son année de départ (années antérieures et années protégées inchangées). */
export function applyClientGrowth(c: PlanB2BClient, years: number[], locked: number[] = []): PlanB2BClient {
  const start = c.startYear ?? years[1];
  const volumes = { ...c.volumes };
  years.forEach((y, i) => {
    if (i === 0 || start === undefined || y < start || locked.includes(y)) return;
    volumes[y] = Math.round((volumes[years[i - 1]] || 0) * (1 + (c.growthRate || 0) / 100));
  });
  return { ...c, volumes };
}

export const REMAINDER_ID = 'remainder';
const remainderOf = (volumes: Record<number, number>): PlanB2BClient =>
  ({ id: REMAINDER_ID, name: 'Autres clients (non répartis)', remainder: true, volumes, growthRate: 0, adjustment: 0 });

/** Activation : le B2B existant passe dans « Autres clients » pour que le total ne change pas. */
export function enableSplit(p: Product, years: number[]): B2BClientSplit {
  if (p.b2bClients?.clients.length) return { ...p.b2bClients, enabled: true };
  const existing = p.volumesByChannel?.B2B ?? {};
  return { enabled: true, historyYears: [], clients: [remainderOf(Object.fromEntries(years.map(y => [y, existing[y] || 0])))] };
}

export interface ErplainClientSale { year: number; customerId: string | null; name: string; qty: number }
/** Lectures complémentaires de l'année en cours (N-1 à même date, 90 derniers jours). */
export interface CurrentYearReads { asOf: string; n1Same: ErplainClientSale[]; recent: ErplainClientSale[] }

/**
 * Import du réalisé B2B par client.
 * - Années terminées du plan : quantités Erplain exactes par client (« Autres » remis à 0).
 * - Année en cours et suivantes, premier import : le volume B2B déjà prévu est réparti selon la part
 *   de chaque client (année en cours à date, sinon N-1) — le total prévu ne change pas.
 * - Réimport : seules les années terminées sont mises à jour ; prévisions et réglages conservés.
 */
export function importErplainClients(p: Product, sales: ErplainClientSale[], years: number[], thisYear: number, cy?: CurrentYearReads) {
  const notes: string[] = [];
  const split = p.b2bClients?.clients.length ? p.b2bClients : enableSplit(p, years);
  const histYears = years.filter(y => y < thisYear);
  const futureYears = years.filter(y => y >= thisYear);
  const keyOf = (s: ErplainClientSale) => s.customerId ?? `name:${s.name}`;
  const firstImport = !split.clients.some(c => !c.remainder);
  const plannedB2B = p.volumesByChannel?.B2B ?? {};

  const byClient = new Map<string, { name: string; qty: Record<number, number> }>();
  for (const s of sales) {
    const e = byClient.get(keyOf(s)) ?? { name: s.name, qty: {} };
    e.qty[s.year] = (e.qty[s.year] || 0) + s.qty;
    byClient.set(keyOf(s), e);
  }
  const basisYear = [...byClient.values()].some(e => (e.qty[thisYear] || 0) > 0) ? thisYear : thisYear - 1;
  const basisTotal = [...byClient.values()].reduce((n, e) => n + Math.max(0, e.qty[basisYear] || 0), 0);

  const clients = split.clients.map(c => ({ ...c, volumes: { ...c.volumes } }));
  const defaultStart = (cy ? futureYears.find(y => y > thisYear) : undefined) ?? futureYears[0] ?? years[1];
  for (const [key, e] of byClient) {
    let c = clients.find(x => !x.remainder && (x.customerId ?? `name:${x.name}`) === key);
    if (!c) {
      if (!histYears.some(y => (e.qty[y] || 0) !== 0) && !(e.qty[basisYear] > 0)) continue;
      c = { id: `client-${key}`, name: e.name, customerId: key.startsWith('name:') ? undefined : key, volumes: {}, growthRate: 0, adjustment: 0, startYear: defaultStart };
      clients.push(c);
      if (!firstImport) notes.push(`${e.name} ajouté sans prévision.`);
    }
    c.name = e.name;
    histYears.forEach(y => { c!.volumes[y] = Math.round(e.qty[y] || 0); });
  }
  // Réalisé d'origine conservé par client Erplain, pour pouvoir y revenir à tout moment.
  const sumOf = (list: ErplainClientSale[], key: string) => list.filter(s => keyOf(s) === key).reduce((n, s) => n + s.qty, 0);
  for (const c of clients) {
    if (c.remainder || !(c.customerId || c.id.startsWith('client-name:'))) continue;
    const key = c.customerId ?? `name:${c.name}`;
    const e = byClient.get(key);
    const origin: Record<number, number> = {};
    histYears.forEach(y => { origin[y] = Math.round(e?.qty[y] || 0); });
    if (cy && years.includes(thisYear)) {
      c.actual = { year: thisYear, asOf: cy.asOf, ytd: Math.round(e?.qty[thisYear] || 0), n1: Math.round(e?.qty[thisYear - 1] || 0),
        n1Same: Math.round(sumOf(cy.n1Same, key)), recent90: Math.round(sumOf(cy.recent, key)) };
      origin[thisYear] = c.actual.ytd;
    }
    c.origin = origin;
  }
  let remainder = clients.find(c => c.remainder);
  if (remainder) histYears.forEach(y => { remainder!.volumes[y] = 0; });

  if (firstImport && basisTotal > 0) {
    const real = clients.filter(c => !c.remainder);
    for (const y of futureYears) {
      const total = plannedB2B[y] || 0;
      let assigned = 0;
      const shares = real.map(c => {
        const e = byClient.get(c.customerId ?? `name:${c.name}`);
        const v = Math.round(total * Math.max(0, e?.qty[basisYear] || 0) / basisTotal);
        assigned += v;
        return v;
      });
      // L'écart d'arrondi va au plus gros client pour garder le total exact.
      const biggest = shares.indexOf(Math.max(...shares));
      if (biggest >= 0) shares[biggest] += total - assigned;
      real.forEach((c, i) => { c.volumes[y] = shares[i]; });
      if (remainder) remainder.volumes[y] = 0;
    }
    notes.push(`Prévisions ${futureYears[0] ?? ''}+ réparties selon les parts clients ${basisYear}${basisYear === thisYear ? ' (à date)' : ''}.`);
  }
  // Année en cours : chiffre Erplain selon la méthode choisie (réalisé à date par défaut), jamais écrasé par la croissance.
  if (cy && years.includes(thisYear)) {
    clients.forEach((c, i) => {
      if (!c.actual || c.cyMethod === 'manual') return;
      clients[i] = setCurrentYearMethod(c, c.cyMethod ?? 'ytd');
    });
    if (firstImport && remainder) remainder.volumes[thisYear] = 0;
    notes.push(`${thisYear} : chiffre Erplain au ${new Date(cy.asOf).toLocaleDateString('fr-FR')} — choisissez réalisé à date ou une extrapolation.`);
  }
  histYears.forEach(y => {
    const before = plannedB2B[y] || 0;
    const after = clients.reduce((n, c) => n + clientVolume(c, y), 0);
    if (before !== after) notes.push(`${y} : B2B du plan ${before} → réalisé Erplain ${after}.`);
  });
  if (remainder && Object.values(remainder.volumes).every(v => !v) && clients.length > 1) {
    clients.splice(clients.indexOf(remainder), 1);
    remainder = undefined;
  }
  const next: B2BClientSplit = {
    enabled: true,
    clients,
    historyYears: histYears,
    importedAt: new Date().toISOString(),
  };
  return { split: next, notes };
}

export interface ExistingClientOption {
  key: string;
  name: string;
  customerId?: string;   // Client Erplain (B2B/OEM) — l'import d'historique le reconnaîtra
  crmClientId?: string;  // Fiche client B2B de l'application
  detail?: string;
}

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('fr');

/**
 * Clients existants proposables : clients Erplain classés B2B/OEM et fiches clients B2B,
 * fusionnés uniquement par lien Erplain explicite, en excluant les IDs déjà présents.
 */
export function existingClientOptions(
  erplain: { customer_id: string; customer_name: string | null; channel: string }[],
  crm: { id: string; company_name: string; country?: string | null; erplain_customer_id?: string | null }[],
  current: PlanB2BClient[],
): ExistingClientOption[] {
  const byName = new Map<string, ExistingClientOption>();
  for (const e of erplain) {
    const name = (e.customer_name ?? '').trim();
    if (!name || norm(name) === '') continue;
    byName.set(`erplain:${e.customer_id}`, { key: `erplain:${e.customer_id}`, name, customerId: e.customer_id, detail: e.channel });
  }
  for (const c of crm) {
    const name = c.company_name?.trim();
    if (!name) continue;
    const found = c.erplain_customer_id ? byName.get(`erplain:${c.erplain_customer_id}`) : undefined;
    if (found) { found.crmClientId = c.id; continue; }
    byName.set(`crm:${c.id}`, { key: `crm:${c.id}`, name, customerId: c.erplain_customer_id ?? undefined, crmClientId: c.id, detail: c.country ?? undefined });
  }
  const usedIds = new Set(current.flatMap(c => [c.customerId, c.crmClientId].filter(Boolean) as string[]));
  return [...byName.values()]
    .filter(o => !(o.customerId && usedIds.has(o.customerId)) && !(o.crmClientId && usedIds.has(o.crmClientId)))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}
