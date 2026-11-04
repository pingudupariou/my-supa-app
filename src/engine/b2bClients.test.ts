import { describe, expect, it } from 'vitest';
import { applyClientGrowth, clientVolume, enableSplit, importErplainClients, syncB2BClients } from './b2bClients';
import { syncProductVolumes } from './calculations';
import type { PlanB2BClient, Product } from './types';

const years = [2024, 2025, 2026, 2027, 2028];
const base: Product = {
  id: 'cat-galets', name: 'Galets', category: 'B2C', launchYear: 2024, devCost: 0, unitCost: 10, priceHT: 100, priceTTC_B2C: 120,
  priceHT_B2B: 50, priceHT_OEM: 40, vatRate: .2, coef_shop: 1, coef_dist: 1, coef_oem: 1, volumesByYear: {},
  volumesByChannel: { B2C: { 2026: 5 }, B2B: { 2024: 90, 2025: 100, 2026: 200, 2027: 300 }, OEM: {} }, erplainMembers: ['v1', 'v2'],
};
const client = (patch: Partial<PlanB2BClient>): PlanB2BClient => ({ id: 'a', name: 'A', volumes: {}, growthRate: 0, adjustment: 0, ...patch });

describe('B2B par client', () => {
  it('le B2B de la ligne est la somme des clients, ajustement compris à partir de l’année de départ', () => {
    const p = syncB2BClients({ ...base, b2bClients: { enabled: true, historyYears: [], clients: [
      client({ id: 'a', volumes: { 2025: 100, 2026: 100 }, adjustment: 10, startYear: 2026 }),
      client({ id: 'b', volumes: { 2025: 50, 2026: 50 } }),
    ] } });
    expect(p.volumesByChannel!.B2B[2025]).toBe(150);
    expect(p.volumesByChannel!.B2B[2026]).toBe(160);
    expect(syncProductVolumes([p])[0].volumesByYear[2026]).toBe(165);
  });

  it('applique la croissance d’un client à partir de son année de départ seulement', () => {
    const c = applyClientGrowth(client({ volumes: { 2025: 100, 2026: 100 }, growthRate: 10, startYear: 2027 }), years);
    expect(c.volumes).toMatchObject({ 2025: 100, 2026: 100, 2027: 110, 2028: 121 });
    expect(clientVolume({ ...c, adjustment: -50, startYear: 2028 }, 2028)).toBe(61);
  });

  it('l’activation ne change pas le volume B2B existant', () => {
    const p = { ...base, b2bClients: enableSplit(base, years) };
    expect(syncB2BClients(p).volumesByChannel!.B2B).toMatchObject({ 2024: 90, 2025: 100, 2026: 200, 2027: 300 });
  });

  it('import : réalisé Erplain par client sur les années passées, prévisions réparties sans changer le total', () => {
    const { split } = importErplainClients(base, [
      { year: 2024, customerId: 'c1', name: 'Atelier Nord', qty: 60 }, { year: 2024, customerId: 'c2', name: 'Velo Sud', qty: 30 },
      { year: 2025, customerId: 'c1', name: 'Atelier Nord', qty: 75 }, { year: 2025, customerId: 'c2', name: 'Velo Sud', qty: 25 },
    ], years, 2026);
    const p = syncB2BClients({ ...base, b2bClients: split });
    const nord = split.clients.find(c => c.customerId === 'c1')!;
    expect(nord.volumes[2024]).toBe(60);
    expect(nord.volumes[2026]).toBe(150); // 75 % de 200
    expect(p.volumesByChannel!.B2B).toMatchObject({ 2024: 90, 2025: 100, 2026: 200, 2027: 300 });
    expect(split.clients.some(c => c.remainder)).toBe(false);
  });

  it('réimport : seules les années passées changent, prévisions et réglages conservés', () => {
    const first = importErplainClients(base, [{ year: 2025, customerId: 'c1', name: 'Atelier Nord', qty: 100 }], years, 2026).split;
    const tuned = { ...first, clients: first.clients.map(c => ({ ...c, growthRate: 20, volumes: { ...c.volumes, 2027: 999 } })) };
    const { split } = importErplainClients({ ...base, b2bClients: tuned }, [{ year: 2025, customerId: 'c1', name: 'Atelier Nord', qty: 120 }], years, 2026);
    const nord = split.clients.find(c => c.customerId === 'c1')!;
    expect(nord.volumes[2025]).toBe(120);
    expect(nord.volumes[2027]).toBe(999);
    expect(nord.growthRate).toBe(20);
  });
});
