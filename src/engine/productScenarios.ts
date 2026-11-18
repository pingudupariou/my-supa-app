import { channelPrices, channelVolumes, syncProductVolumes, unitCostAt } from './calculations';
import type { Product, ProductCategory } from './types';

export const CHS: ProductCategory[] = ['B2C', 'B2B', 'OEM'];

/** Réglages d'un produit dans un scénario : seules les valeurs saisies remplacent celles du plan. */
export interface ScenarioProductOverride {
  prices?: Record<number, Partial<Record<ProductCategory, number>>>;
  unitCost?: Record<number, number>;
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

export function scenarioVolumes(p: Product, sc: ProductScenario | null, year: number) {
  const v = channelVolumes(p, year);
  const pct = sc?.volumePct[year] ?? {};
  return { B2C: Math.round(v.B2C * (1 + (pct.B2C || 0) / 100)), B2B: Math.round(v.B2B * (1 + (pct.B2B || 0) / 100)), OEM: Math.round(v.OEM * (1 + (pct.OEM || 0) / 100)) };
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
  const o: ScenarioProductOverride = { prices: { ...(sc.products[productId]?.prices ?? {}) }, unitCost: { ...(sc.products[productId]?.unitCost ?? {}) } };
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
    const volumesByChannel = ch ? { B2C: scale(ch.B2C, years, pct('B2C')), B2B: scale(ch.B2B, years, pct('B2B')), OEM: scale(ch.OEM, years, pct('OEM')) } : undefined;
    const volumesByYear = ch ? p.volumesByYear : scale(p.volumesByYear, years, pct('B2C'));
    const b2bClients = p.b2bClients ? { ...p.b2bClients, clients: p.b2bClients.clients.map(c => ({ ...c, volumes: scale(c.volumes, years, pct('B2B')) })) } : undefined;
    return { ...p, pricesByYear, unitCostByYear, volumesByYear, ...(volumesByChannel ? { volumesByChannel } : {}), ...(b2bClients ? { b2bClients } : {}) };
  });
}
