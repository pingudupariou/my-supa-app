import { describe, expect, it } from 'vitest';
import { variation, formatPct } from './bankReportModel';

describe('bank report variations', () => {
  it('computes euro and percent change from previous year', () => {
    expect(variation(120, 100)).toEqual({ delta: 20, pct: 0.2 });
  });
  it('percent is not meaningful when previous year is zero', () => {
    expect(variation(50, 0).pct).toBeNull();
    expect(formatPct(null)).toBe('n.s.');
  });
  it('uses absolute previous value so a smaller loss reads as improvement', () => {
    expect(variation(-50, -100).pct).toBe(0.5);
  });
  it('first year has no variation', () => {
    expect(variation(100, undefined)).toEqual({ delta: null, pct: null });
  });
});
