import { channelPrices, channelVolumes, syncProductVolumes, unitCostAt } from './calculations';
import { clientVolume } from './b2bClients';
import type { Product, ProductCategory } from './types';

export const CHS: ProductCategory[] = ['B2C', 'B2B', 'OEM'];

/** Réglages d'un produit dans un scénario : seules les valeurs saisies remplacent celles du plan. */
export interface ScenarioProductOverride {
  prices?: Record<number, Partial<Record<ProductCategory, number>>>;
  unitCost?: Record<number, number>;
  /** Volume absolu par canal et année (remplace le plan et le % global). */
  volumes?: Record<number, Partial<Record<ProductCategory, number>>>;
  /** Volume absolu par client B2B (id client du plan) et année. */
  clientVolumes?: Record<string, Record<number, number>>;
}

/** Scénario du plan produit : prix/coûts par produit et année, volumes en % du plan, transport. */
export interface ProductScenario {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  products: Record<string, ScenarioProductOverride>;
  volumePct: Record<number, Partial<Record<ProductCategory, number>>>; // % vs plan (ex. 10 = +10 %)
  transportPct?: number | null; // % du CA ; vide = même ratio que le plan
  appliedAt?: string;
}

export interface YearResult { year: number; units: number; revenue: number; cogs: number; transport: number; margin: number; marginPct: number | null }

export const SCENARIO_COLORS = ['#2563eb', '#16a34a', '#ea580c', '#9333ea', '#0891b2', '#dc2626'];

/** Prix effectifs d'un produit dans un scénario pour une année. */
export function scenarioPrices(p: Product, sc: ProductScenario | null, year: number) {
  const base = channelPrices(p, year);
  const o = sc?.products[p.id]?.prices?.[year];
  return { B2C: o?.B2C ?? base.B2C, B2B: o?.B2B ?? base.B2B, OEM: o?.OEM ?? base.OEM };
}
export const scenarioCost = (p: Product, sc: ProductScenario | null, year: number) =>
  sc?.products[p.id]?.unitCost?.[year] ?? unitCostAt(p, year);

/** Volume effectif d'un client B2B : saisie du scénario, sinon plan × % B2B global. */
export function scenarioClientVolume(p: Product, clientId: string, sc: ProductScenario | null, year: number): number {
  const c = p.b2bClients?.clients.find(x => x.id === clientId);
  const plan = c ? clientVolume(c, year) : 0;
  const own = sc?.products[p.id]?.clientVolumes?.[clientId]?.[year];
  if (own !== undefined) return own;
  return Math.round(plan * (1 + (sc?.volumePct[year]?.B2B || 0) / 100));
}
const clientsActive = (p: Product) => !!(p.b2bClients?.enabled && p.b2bClients.clients.length);

/** Volumes effectifs : saisie produit/canal > somme clients B2B (si détaillé et modifié) > plan × % global. */
export function scenarioVolumes(p: Product, sc: ProductScenario | null, year: number) {
  const v = channelVolumes(p, year);
  const pct = sc?.volumePct[year] ?? {};
  const own = sc?.products[p.id]?.volumes?.[year] ?? {};
  const scaled = (ch: ProductCategory) => Math.round(v[ch] * (1 + (pct[ch] || 0) / 100));
  const cv = sc?.products[p.id]?.clientVolumes;
  const hasClient = clientsActive(p) && cv && Object.values(cv).some(r => r[year] !== undefined);
  const b2b = own.B2B ?? (hasClient ? p.b2bClients!.clients.reduce((s, c) => s + scenarioClientVolume(p, c.id, sc, year), 0) : scaled('B2B'));
  return { B2C: own.B2C ?? scaled('B2C'), B2B: b2b, OEM: own.OEM ?? scaled('OEM') };
}

/** Change un volume produit/canal (undefined = revenir au plan). */
export function setVolumeOverride(sc: ProductScenario, productId: string, ch: ProductCategory, years: number[], value: number | undefined): ProductScenario {
  const cur = sc.products[productId] ?? {};
  const volumes = { ...(cur.volumes ?? {}) };
  years.forEach(y => { const row = { ...(volumes[y] ?? {}) }; if (value === undefined) delete row[ch]; else row[ch] = Math.round(value); volumes[y] = row; });
  return { ...sc, products: { ...sc.products, [productId]: { ...cur, volumes } } };
}
/** Change un volume client B2B (undefined = revenir au plan). */
export function setClientVolume(sc: ProductScenario, productId: string, clientId: string, years: number[], value: number | undefined): ProductScenario {
  const cur = sc.products[productId] ?? {};
  const all = { ...(cur.clientVolumes ?? {}) }; const row = { ...(all[clientId] ?? {}) };
  years.forEach(y => { if (value === undefined) delete row[y]; else row[y] = Math.round(value); });
  all[clientId] = row;
  return { ...sc, products: { ...sc.products, [productId]: { ...cur, clientVolumes: all } } };
}
/** Nombre de valeurs saisies pour un produit. */
export function overrideCount(o: ScenarioProductOverride | undefined): number {
  if (!o) return 0;
  const n = (r?: Record<number, object>) => Object.values(r ?? {}).reduce((s, x) => s + Object.keys(x).length, 0);
  return n(o.prices) + Object.keys(o.unitCost ?? {}).length + n(o.volumes) + Object.values(o.clientVolumes ?? {}).reduce((s, r) => s + Object.keys(r).length, 0);
}

export interface ProductYearLine { productId: string; name: string; year: number; units: number; revenue: number; cogs: number; prices: Record<ProductCategory, number>; cost: number }

export function productLines(products: Product[], sc: ProductScenario | null, years: number[]): ProductYearLine[] {
  const synced = syncProductVolumes(products);
  return synced.flatMap(p => years.map(year => {
    const v = scenarioVolumes(p, sc, year), pr = scenarioPrices(p, sc, year), cost = scenarioCost(p, sc, year);
    const units = v.B2C + v.B2B + v.OEM;
    return { productId: p.id, name: p.name, year, units, revenue: v.B2C * pr.B2C + v.B2B * pr.B2B + v.OEM * pr.OEM, cogs: units * cost, prices: pr, cost };
  }));
}

/**
 * Résultat par année. Transport : % du scénario s'il est saisi, sinon même ratio transport/CA que le plan
 * (planTransport = transport du plan par année).
 */
export function scenarioResults(products: Product[], sc: ProductScenario | null, years: number[], planTransport: Record<number, number>): YearResult[] {
  const lines = productLines(products, sc, years);
  const planRev = sc ? scenarioResults(products, null, years, planTransport) : null;
  return years.map(year => {
    const ls = lines.filter(l => l.year === year);
    const revenue = ls.reduce((s, l) => s + l.revenue, 0), cogs = ls.reduce((s, l) => s + l.cogs, 0), units = ls.reduce((s, l) => s + l.units, 0);
    let transport = planTransport[year] || 0;
    if (sc) {
      if (sc.transportPct != null) transport = revenue * sc.transportPct / 100;
      else { const pr = planRev!.find(r => r.year === year)!.revenue; transport = pr > 0 ? transport * revenue / pr : 0; }
    }
    const margin = revenue - cogs - transport;
    return { year, units, revenue, cogs, transport, margin, marginPct: revenue ? margin / revenue : null };
  });
}

export function newScenario(name: string, index: number): ProductScenario {
  return { id: crypto.randomUUID(), name, color: SCENARIO_COLORS[index % SCENARIO_COLORS.length], createdAt: new Date().toISOString(), products: {}, volumePct: {} };
}

/** Change une valeur (undefined = revenir à la valeur du plan). */
export function setOverride(sc: ProductScenario, productId: string, field: ProductCategory | 'cost', years: number[], value: number | undefined): ProductScenario {
  const o: ScenarioProductOverride = { ...(sc.products[productId] ?? {}), prices: { ...(sc.products[productId]?.prices ?? {}) }, unitCost: { ...(sc.products[productId]?.unitCost ?? {}) } };
  years.forEach(y => {
    if (field === 'cost') { if (value === undefined) delete o.unitCost![y]; else o.unitCost![y] = value; }
    else { const row = { ...(o.prices![y] ?? {}) }; if (value === undefined) delete row[field]; else row[field] = value; o.prices![y] = row; }
  });
  return { ...sc, products: { ...sc.products, [productId]: o } };
}

const scale = (rec: Record<number, number> | undefined, years: number[], pct: (y: number) => number) => {
  const out = { ...(rec ?? {}) };
  years.forEach(y => { if (pct(y) && out[y] !== undefined) out[y] = Math.round(out[y] * (1 + pct(y) / 100)); });
  return out;
};

/** Reprend le scénario dans le plan : prix/coûts par année, volumes multipliés (clients B2B inclus). */
export function applyScenario(products: Product[], sc: ProductScenario, years: number[]): Product[] {
  return products.map(p => {
    const o = sc.products[p.id];
    const pricesByYear = { ...(p.pricesByYear ?? {}) }, unitCostByYear = { ...(p.unitCostByYear ?? {}) };
    years.forEach(y => {
      const pr = o?.prices?.[y]; if (pr && Object.keys(pr).length) pricesByYear[y] = { ...(pricesByYear[y] ?? {}), ...pr };
      const c = o?.unitCost?.[y]; if (c !== undefined) unitCostByYear[y] = c;
    });
    const pct = (ch: ProductCategory) => (y: number) => sc.volumePct[y]?.[ch] || 0;
    const ch = p.volumesByChannel;
    const ownV = (c: ProductCategory) => (rec: Record<number, number>) => { const out = { ...rec }; years.forEach(y => { const v = o?.volumes?.[y]?.[c]; if (v !== undefined) out[y] = v; }); return out; };
    const volumesByChannel = ch ? { B2C: ownV('B2C')(scale(ch.B2C, years, pct('B2C'))), B2B: ownV('B2B')(scale(ch.B2B, years, pct('B2B'))), OEM: ownV('OEM')(scale(ch.OEM, years, pct('OEM'))) } : undefined;
    const volumesByYear = ch ? p.volumesByYear : ownV('B2C')(scale(p.volumesByYear, years, pct('B2C')));
    const b2bOverridden = years.some(y => o?.volumes?.[y]?.B2B !== undefined);
    const b2bClients = p.b2bClients ? { ...p.b2bClients, enabled: b2bOverridden ? false : p.b2bClients.enabled, clients: p.b2bClients.clients.map(c => {
      const volumes = scale(c.volumes, years, pct('B2B'));
      years.forEach(y => { const v = o?.clientVolumes?.[c.id]?.[y]; if (v === undefined) return;
        const adj = c.adjustment && c.startYear !== undefined && y >= c.startYear ? 1 + c.adjustment / 100 : 1;
        volumes[y] = Math.round(v / adj); });
      return { ...c, volumes };
    }) } : undefined;
    return { ...p, pricesByYear, unitCostByYear, volumesByYear, ...(volumesByChannel ? { volumesByChannel } : {}), ...(b2bClients ? { b2bClients } : {}) };
  });
}
