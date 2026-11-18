import { describe, expect, it } from 'vitest';
import { applyScenario, newScenario, scenarioResults, setClientVolume, setOverride, setVolumeOverride } from './productScenarios';
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
