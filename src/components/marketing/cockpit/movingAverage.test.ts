import { describe, expect, it } from 'vitest';
import { withMovingAverage } from './movingAverage';

const rows = Array.from({ length: 9 }, (_, i) => ({ b: `2026-10-${String(i + 1).padStart(2, '0')}`, mer: i + 1, revenue: (i + 1) * 100 }));
describe('daily moving averages', () => {
  it('retains actual values and waits for seven full days', () => {
    const result = withMovingAverage(rows, ['mer', 'revenue']);
    expect(result[5].ma7_mer).toBeNull();
    expect(result[6].ma7_mer).toBe(4);
    expect(result[8].ma7_mer).toBe(6);
    expect(result[6].revenue).toBe(700);
    expect(result[6].ma7_revenue).toBe(400);
    expect(rows[6]).not.toHaveProperty('ma7_mer');
  });
  it('does not bridge missing dates or undefined ratios', () => {
    expect(withMovingAverage(rows.filter((_, i) => i !== 3), ['mer'])[6].ma7_mer).toBeNull();
    expect(withMovingAverage(rows.map((r, i) => i === 3 ? { ...r, mer: null } : r), ['mer'])[6].ma7_mer).toBeNull();
  });
  it('excludes incomplete days', () => {
    expect(withMovingAverage(rows.map((r, i) => ({ ...r, partial: i === 6 })), ['mer'])[6].ma7_mer).toBeNull();
  });
});