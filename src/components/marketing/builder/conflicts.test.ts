import { describe, it, expect } from 'vitest';
import { checkConflicts } from './conflicts';

const snap = { data: {
  campaigns: [
    { id: '1', name: 'PMax FR', status: 'ENABLED', type: 'PERFORMANCE_MAX', budget: 20 },
    { id: '2', name: 'Shopping DE', status: 'ENABLED', type: 'SHOPPING', budget: 10 },
    { id: '3', name: 'Old', status: 'PAUSED', type: 'SHOPPING', budget: 10 },
  ],
  criteria: [{ campaign_id: '1', type: 'LOCATION', value: 'FR' }, { campaign_id: '2', type: 'LOCATION', value: 'DE' }],
  listing_groups_shopping: [{ campaign_id: '2', dim: 'item_id', value: 'abc' }],
} };
const base = { campaign_type: 'SHOPPING', countries: ['FR'], daily_budget: 10, offerIds: ['ABC'], keywords: [], labels: [], productTypes: [] };

describe('checkConflicts', () => {
  it('warns (never blocks) on PMax covering whole catalogue in same country', () => {
    const c = checkConflicts(base, snap);
    expect(c.find((x) => x.campaign === 'PMax FR')?.level).toBe('attention');
    expect(c.find((x) => x.campaign === 'PMax FR')?.message).toMatch(/priorité/);
    expect(c.find((x) => x.campaign === 'Shopping DE')).toBeUndefined();
  });
  it('matches item ids case-insensitively in another country', () => {
    const c = checkConflicts({ ...base, countries: ['DE'] }, snap);
    expect(c.find((x) => x.campaign === 'Shopping DE')?.level).toBe('attention');
    expect(c.find((x) => x.campaign === 'Old')).toBeUndefined();
  });
  it('reports missing essentials', () => {
    const c = checkConflicts({ ...base, countries: [], daily_budget: null, offerIds: [] }, snap);
    expect(c.filter((x) => x.level === 'bloquant').length).toBe(3);
  });
});
