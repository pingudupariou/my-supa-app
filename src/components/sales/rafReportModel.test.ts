import { describe, it, expect } from 'vitest';
import { buildGrid, yearShare } from './rafReportModel';
describe('rapport RAF', () => {
  it('additionne les segments dans le total et laisse les mois futurs vides', () => {
    const g = buildGrid([{ year: 2026, month: 1, segment: 'B2C', ca_ht: 100 }, { year: 2026, month: 1, segment: 'B2B_FR', ca_ht: -20 }], [2026], '2026-11-20');
    expect(g[2026][1].ALL).toBe(80);
    expect(g[2026][12].ALL).toBeNull();
    expect(g[2026][11].ALL).toBe(0);
  });
  it('répartition en % par type de client', () => {
    const g = buildGrid([{ year: 2025, month: 2, segment: 'B2C', ca_ht: 75 }, { year: 2025, month: 3, segment: 'OEM', ca_ht: 25 }], [2025], '2026-01-01');
    expect(yearShare(g, 2025).find((s) => s.segment === 'B2C')!.pct).toBe(75);
  });
});
import { aggregateBacklog } from './rafReportModel';
describe('commandes actives', () => {
  it("ajoute seulement le reste à facturer des commandes actives, B2B séparé France/export", () => {
    const r = aggregateBacklog([
      { status: 'active', dated_at: '2026-11-03', customer_id: 1, channel: 'b2b', unbilled: 500 },
      { status: 'active', dated_at: '2026-11-04', customer_id: 2, channel: 'b2b', unbilled: 300 },
      { status: 'closed', dated_at: '2026-11-04', customer_id: 2, channel: 'b2b', unbilled: 999 },
      { status: 'active', dated_at: '2026-11-05', customer_id: 3, channel: 'b2c', unbilled: 0 },
    ], { '1': 'FR', '2': 'DE' }, { '1': 'B2B', '2': 'B2B' });
    expect(r.find((x) => x.segment === 'B2B_FR')!.unbilled_ht).toBe(500);
    expect(r.find((x) => x.segment === 'B2B_EXPORT')!.unbilled_ht).toBe(300);
    expect(r.length).toBe(2);
  });
});
