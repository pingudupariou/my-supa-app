import { describe, it, expect } from 'vitest';
import { buildScenarioWorkbook } from './scenarioWorkbook';
import { newScenario } from '@/engine/productScenarios';
import type { Product } from '@/engine/types';

const p = { id: 'g', name: 'Galets', launchYear: 2026, priceHT: 10, priceHT_B2B: 8, priceHT_OEM: 6, unitCost: 4, productStatus: 'validated',
  volumesByChannel: { B2C: { 2026: 100 }, B2B: {}, OEM: {} },
  b2bClients: { enabled: true, clients: [{ id: 'c1', name: 'Alpha', volumes: { 2026: 30 } }, { id: 'c2', name: 'Beta', volumes: { 2026: 20 } }] } } as unknown as Product;

describe('scenario workbook', () => {
  it('writes B2B as a formula summing client rows and CA as volumes × prices', () => {
    const sc = newScenario('Haut', 0);
    sc.products.g = { prices: { 2026: { B2C: 12 } } };
    const wb = buildScenarioWorkbook([p], [{ name: 'Plan actuel', scenario: null }, { name: 'Haut', scenario: sc }], [2026, 2027], {}, c => c);
    const ws = wb.Sheets['Haut'];
    const cells = Object.entries(ws).filter(([k]) => /^B\d+$/.test(k));
    const rowOf = (label: string) => Number(cells.find(([, c]) => (c as any).v === label)![0].slice(1));
    expect(ws[`C${rowOf('Prix B2C HT (€)')}`].v).toBe(12);
    expect(ws[`C${rowOf('Volume B2B (somme clients)')}`].f).toBe(`SUM(C${rowOf('  ↳ B2B · Alpha')}:C${rowOf('  ↳ B2B · Beta')})`);
    expect(ws[`C${rowOf('CA HT (€)')}`].f).toContain(`C${rowOf('Volume B2C')}*C${rowOf('Prix B2C HT (€)')}`);
    expect(wb.SheetNames[0]).toBe('Comparaison');
  });
});
