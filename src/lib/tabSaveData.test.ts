import { describe, expect, it } from 'vitest';
import { pickTabData } from './tabSaveData';

describe('scoped tab saves', () => {
  it('saves products and category snapshots without changing charges or global settings', () => {
    const state = { products: [{ name: 'Galets' }], productCategories: [{ name: 'Transmission' }], expenses: [10], roles: ['BE'], scenarioSettings: { startYear: 2026 } };
    const data = pickTabData(state, 'product-plan');
    expect(data.products).toEqual(state.products);
    expect(data.productCategories).toEqual(state.productCategories);
    expect(data).not.toHaveProperty('expenses');
    expect(data).not.toHaveProperty('scenarioSettings');
  });
  it('keeps organisation and charges independent', () => {
    const state = { roles: ['BE'], hiringSimulation: {}, expenses: [10], opexMode: 'simple', simpleOpexConfig: { baseAmount: 10 } };
    expect(pickTabData(state, 'organisation')).toEqual({ roles: ['BE'], hiringSimulation: {} });
    expect(pickTabData(state, 'charges')).toEqual({ expenses: [10], opexMode: 'simple', simpleOpexConfig: { baseAmount: 10 } });
  });
});