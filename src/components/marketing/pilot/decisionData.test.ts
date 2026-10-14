import { describe, expect, it } from 'vitest';
import { Daily, decisionSeries, metricValue, parameterHistory } from './decisionData';
const daily = (campaign_id: string, day: string, cost = 10, conversions = 2, conversions_value = 50): Daily => ({ campaign_id, day, cost, conversions, conversions_value, clicks: 5 });
describe('pilot decision data', () => {
  it('uses ratios of totals, not a mean of ROAS, and leaves undefined metrics empty', () => {
    expect(metricValue([daily('1', '2026-10-01'), daily('2', '2026-10-01', 90, 0, 90)], 'roas')).toBe(1.4);
    expect(metricValue([], 'cost')).toBeNull();
    expect(metricValue([daily('1', '2026-10-01', 0, 0, 0)], 'cpa')).toBeNull();
    expect(metricValue([daily('1', '2026-10-01', 0)], 'roas')).toBeNull();
  });
  it('compares equal nonoverlapping periods, isolates types, and preserves missing dates', () => {
    const campaigns = [{ id: '1', name: 'A', type: 'SHOPPING' }, { id: '2', name: 'B', type: 'SHOPPING' }, { id: '3', name: 'C', type: 'SEARCH' }];
    const rows = [daily('1', '2026-10-01', 5), daily('1', '2026-10-03', 10), daily('2', '2026-10-03', 30), daily('3', '2026-10-03', 100)];
    const res = decisionSeries(rows, campaigns, '1', 2, 'cost', '2026-10-04');
    expect(res.start).toBe('2026-10-03'); expect(res.previousStart).toBe('2026-10-01');
    expect(res.comparison[0]).toMatchObject({ value: 10, prior: 5, delta: 100, days: 1 });
    expect(res.comparison.map(c => c.id)).toEqual(['1', '2']);
    expect(res.series[0].peers).toBe(30);
    expect(res.series[1]).toMatchObject({ campaign: null, peers: null });
  });
  it('uses observed budgets and converts target ROAS to percent, with gaps for missing sections', () => {
    const snapshots = [
      { taken_at: '2026-10-02', campaigns: null },
      { taken_at: '2026-10-01', campaigns: [{ id: '1', name: 'A', budget: 20, target_roas: 3.5 }] },
    ];
    expect(parameterHistory(snapshots, '1', 'budget').map(r => r.value)).toEqual([20, null]);
    expect(parameterHistory(snapshots, '1', 'bidding').map(r => r.value)).toEqual([350, null]);
  });
});