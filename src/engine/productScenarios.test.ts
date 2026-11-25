import { describe, expect, it } from 'vitest';
import { applyScenario, newScenario, scenarioClientVolume, scenarioResults, scenarioVolumes, setClientGrowth, setClientVolume, setOverride, setProductPct, setVolumeOverride } from './productScenarios';
import { calculateProductRevenue } from './calculations';
import type { Product } from './types';

const p: Product = { id: 'a', name: 'A', category: 'B2C', launchYear: 2025, devCost: 0, unitCost: 40, priceHT: 100, priceTTC_B2C: 120, priceHT_B2B: 80, priceHT_OEM: 60, vatRate: .2, coef_shop: 1, coef_dist: 1, coef_oem: 1, volumesByYear: {}, volumesByChannel: { B2C: { 2026: 10, 2027: 10 }, B2B: { 2026: 5, 2027: 5 }, OEM: {} } };
const Y = [2026, 2027];

describe('scénarios plan produit', () => {
  it('prix et coût par année ne touchent que l\'année choisie', () => {
    let sc = setOverride(newScenario('S', 0), 'a', 'B2C', [2027], 150);
    sc = setOverride(sc, 'a', 'cost', [2027], 50);
    const r = scenarioResults([p], sc, Y, {});
    expect(r[0].revenue).toBe(10 * 100 + 5 * 80);
    expect(r[1].revenue).toBe(10 * 150 + 5 * 80);
    expect(r[1].cogs).toBe(15 * 50);
  });
  it('volumes en % et transport en % du CA', () => {
    const sc = { ...newScenario('S', 0), volumePct: { 2026: { B2C: 50 } }, transportPct: 10 };
    const r = scenarioResults([p], sc, Y, {});
    expect(r[0].units).toBe(20);
    expect(r[0].transport).toBeCloseTo(r[0].revenue * 0.1);
  });
  it('le plan est inchangé tant que le scénario n\'est pas appliqué, puis prend ses prix', () => {
    const sc = setOverride(newScenario('S', 0), 'a', 'B2C', [2027], 150);
    expect(calculateProductRevenue(p, 2027)).toBe(1400);
    const [ap] = applyScenario([p], sc, Y);
    expect(calculateProductRevenue(ap, 2027)).toBe(10 * 150 + 5 * 80);
    expect(calculateProductRevenue(ap, 2026)).toBe(1400);
  });
});

describe('scénarios : volumes par canal et par client', () => {
  it('un volume saisi par canal remplace le plan pour cette année seulement', () => {
    const sc = setVolumeOverride(newScenario('S', 0), 'a', 'B2B', [2027], 20);
    const r = scenarioResults([p], sc, Y, {});
    expect(r[0].units).toBe(15);
    expect(r[1].units).toBe(30);
  });
  it('le B2B détaillé par client suit les volumes clients du scénario', () => {
    const q: Product = { ...p, b2bClients: { enabled: true, historyYears: [], clients: [
      { id: 'c1', name: 'X', volumes: { 2026: 3, 2027: 3 }, growthRate: 0, adjustment: 0 },
      { id: 'c2', name: 'Y', volumes: { 2026: 2, 2027: 2 }, growthRate: 0, adjustment: 0 }] } };
    const sc = setClientVolume(newScenario('S', 0), 'a', 'c1', [2027], 10);
    const r = scenarioResults([q], sc, Y, {});
    expect(r[0].units).toBe(15);
    expect(r[1].units).toBe(10 + 10 + 2);
    const [ap] = applyScenario([q], sc, Y);
    expect(ap.b2bClients!.clients[0].volumes[2027]).toBe(10);
  });
});

import { scenarioPct as _pct, setProductPct as _setPct } from './productScenarios';
describe('per-product volume %', () => {
  it('product % overrides global %, clearing falls back', () => {
    let sc: import('./productScenarios').ProductScenario = { ...newScenario('S', 0), volumePct: { 2026: { B2C: 10 } } };
    expect(_pct(sc, 'p1', 2026, 'B2C')).toBe(10);
    sc = _setPct(sc, 'p1', 'B2C', [2026], 25);
    expect(_pct(sc, 'p1', 2026, 'B2C')).toBe(25);
    expect(_pct(sc, 'p2', 2026, 'B2C')).toBe(10);
    sc = _setPct(sc, 'p1', 'B2C', [2026], undefined);
    expect(_pct(sc, 'p1', 2026, 'B2C')).toBe(10);
  });
});

const detailed: Product = { ...p, b2bClients: { enabled: true, historyYears: [], savedB2B: { 2026: 5, 2027: 5 }, clients: [
  { id: 'alpha', name: 'Alpha', volumes: { 2026: 100, 2027: 100, 2028: 100 }, growthRate: 0, adjustment: 0 },
  { id: 'beta', name: 'Beta', volumes: { 2026: 50, 2027: 50, 2028: 50 }, growthRate: 0, adjustment: 0 },
] } };

describe('croissance du scénario avec détail client activé', () => {
  it('mémorise et compose la croissance par client sur le volume scénario précédent', () => {
    const sc = setClientGrowth(newScenario('Clients', 0), 'a', 'alpha', [2027, 2028], 10);
    const restored = JSON.parse(JSON.stringify(sc));
    expect(restored.products.a.clientGrowthPct.alpha).toEqual({ 2027: 10, 2028: 10 });
    expect(scenarioClientVolume(detailed, 'alpha', restored, 2027)).toBe(110);
    expect(scenarioClientVolume(detailed, 'alpha', restored, 2028)).toBe(121);
    expect(scenarioVolumes(detailed, restored, 2028).B2B).toBe(171);
    expect(detailed.b2bClients?.clients[0].volumes[2028]).toBe(100);
  });
  it('répercute le taux global et produit sur les clients sans croissance propre et somme les arrondis clients', () => {
    const sc = setProductPct({ ...newScenario('S', 0), volumePct: { 2026: { B2B: 10 } } }, 'a', 'B2B', [2026], 25);
    expect(scenarioClientVolume(detailed, 'alpha', sc, 2026)).toBe(125);
    expect(scenarioClientVolume(detailed, 'beta', sc, 2026)).toBe(63);
    expect(scenarioVolumes(detailed, sc, 2026).B2B).toBe(188);
    const fallback = setProductPct(sc, 'a', 'B2B', [2026], undefined);
    expect(scenarioVolumes(detailed, fallback, 2026).B2B).toBe(165);
  });
  it('change une croissance sans écraser les autres années ni les autres clients', () => {
    const original = setClientVolume(setClientVolume(newScenario('S', 0), 'a', 'alpha', [2027], 200), 'a', 'beta', [2027], 75);
    const sc = setClientGrowth(original, 'a', 'alpha', [2027], 10);
    expect(scenarioVolumes(detailed, sc, 2027).B2B).toBe(185);
    expect(original.products.a.clientVolumes?.alpha[2027]).toBe(200);
    expect(scenarioClientVolume(detailed, 'alpha', sc, 2028)).toBe(100);
    expect(scenarioClientVolume(detailed, 'alpha', setClientGrowth(sc, 'a', 'alpha', [2027], undefined), 2027)).toBe(100);
  });
  it('applique au plan les mêmes volumes et conserve le mode détaillé', () => {
    const sc = setClientGrowth(newScenario('S', 0), 'a', 'alpha', [2027, 2028], 10);
    const [applied] = applyScenario([detailed], sc, [2026, 2027, 2028]);
    expect(applied.b2bClients?.enabled).toBe(true);
    expect(scenarioResults([applied], null, [2027, 2028], {}).map(r => r.revenue)).toEqual(scenarioResults([detailed], sc, [2027, 2028], {}).map(r => r.revenue));
    expect(applied.b2bClients?.clients[0].volumes[2028]).toBe(121);
  });
  it('garde les réglages clients quand le détail est désactivé puis réactivé', () => {
    const sc = setClientGrowth(newScenario('S', 0), 'a', 'alpha', [2027], 10);
    const disabled: Product = { ...detailed, b2bClients: detailed.b2bClients ? { ...detailed.b2bClients, enabled: false } : undefined };
    expect(scenarioVolumes(disabled, sc, 2027).B2B).toBe(5);
    const [applied] = applyScenario([disabled], sc, Y);
    expect(applied.b2bClients?.clients).toEqual(detailed.b2bClients?.clients);
    expect(scenarioVolumes(detailed, sc, 2027).B2B).toBe(160);
    expect(sc.products.a.clientGrowthPct?.alpha[2027]).toBe(10);
  });
  it('le total saisi reste prioritaire sans supprimer les taux clients', () => {
    const sc = setVolumeOverride(setClientGrowth(newScenario('S', 0), 'a', 'alpha', [2027], 10), 'a', 'B2B', [2027], 250);
    expect(scenarioVolumes(detailed, sc, 2027).B2B).toBe(250);
    expect(scenarioVolumes(detailed, setVolumeOverride(sc, 'a', 'B2B', [2027], undefined), 2027).B2B).toBe(160);
  });
});
