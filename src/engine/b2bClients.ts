import type { B2BClientSplit, PlanB2BClient, Product } from './types';

/** Ligne du plan liée à Erplain (catégorie avec produits Erplain ou produit Erplain individuel). */
export function erplainKeysOf(p: Product): string[] {
  if (p.erplainMembers?.length) return [...new Set(p.erplainMembers.filter(k => !k.startsWith('manual:')))];
  return p.id.startsWith('erplain-') ? [p.id.slice(8)] : [];
}
export const supportsB2BClients = (p: Product) => erplainKeysOf(p).length > 0;

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

/** Croissance annuelle du client à partir de son année de départ (années antérieures inchangées). */
export function applyClientGrowth(c: PlanB2BClient, years: number[]): PlanB2BClient {
  const start = c.startYear ?? years[1];
  const volumes = { ...c.volumes };
  years.forEach((y, i) => {
    if (i === 0 || start === undefined || y < start) return;
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

/**
 * Import du réalisé B2B par client.
 * - Années terminées du plan : quantités Erplain exactes par client (« Autres » remis à 0).
 * - Année en cours et suivantes, premier import : le volume B2B déjà prévu est réparti selon la part
 *   de chaque client (année en cours à date, sinon N-1) — le total prévu ne change pas.
 * - Réimport : seules les années terminées sont mises à jour ; prévisions et réglages conservés.
 */
export function importErplainClients(p: Product, sales: ErplainClientSale[], years: number[], thisYear: number) {
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
  const defaultStart = futureYears[0] ?? years[1];
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
