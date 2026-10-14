import { describe, it, expect } from 'vitest';
import { buildWhereUsed } from './whereUsed';

describe('buildWhereUsed', () => {
  // A (finished) = 2×S + 1×X ; S (sub-assembly) = 3×X ; B (finished) = 1×X
  const w = buildWhereUsed([['A', 'S', 2], ['A', 'X', 1], ['S', 'X', 3], ['B', 'X', 1]]);
  it('cumulates direct and indirect quantities per finished product', () => {
    const u = w.usagesOf('X');
    const a = u.find(x => x.productId === 'A')!;
    expect(a.quantity).toBe(7);
    expect(a.paths.map(p => p.ids.join('>')).sort()).toEqual(['X>A', 'X>S>A']);
    expect(u.find(x => x.productId === 'B')!.quantity).toBe(1);
  });
  it('lists sub-assembly as used, not as finished product', () => {
    expect(w.usagesOf('X').some(x => x.productId === 'S')).toBe(false);
    expect(w.directParents('X').sort()).toEqual(['A', 'B', 'S']);
    expect(w.isUsed('A')).toBe(false);
  });
});
