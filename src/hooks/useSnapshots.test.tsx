import { act, renderHook, waitFor, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSnapshots } from './useSnapshots';

const mocks = vi.hoisted(() => ({
  user: { id: 'user', email: 'test@example.test' },
  state: { products: [{ name: 'Modifié sans sauvegarder', volume: 123 }], activeTabSaves: { 'product-plan': { id: 'tab-id', name: 'Base 2026' } } },
  insert: vi.fn(), range: vi.fn(), collect: vi.fn(), persistLocal: vi.fn(),
}));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: mocks.user, isAdmin: true, getTabPermission: () => 'write' }) }));
vi.mock('@/context/FinancialContext', () => ({ useFinancial: () => ({ state: mocks.state, applyTabData: vi.fn(), persistLocal: mocks.persistLocal }) }));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));
vi.mock('./useSnapshotData', () => ({ collectSnapshotData: mocks.collect, restoreSnapshotData: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: (table: string) => table === 'tab_saves'
  ? { select: () => ({ order: () => ({ range: mocks.range }) }) }
  : { select: () => ({ order: async () => ({ data: [] }) }), insert: mocks.insert } } }));

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear();
  mocks.collect.mockResolvedValue({ financial_scenarios: [{ state_data: { products: ['ancien'] } }] });
  mocks.range.mockResolvedValue({ data: [{ id: 'tab-id', tab_key: 'product-plan', name: 'Base 2026', data: { products: ['ancien'] } }], error: null });
  mocks.insert.mockImplementation(payload => ({ select: () => ({ single: async () => ({ data: { ...payload, id: 'global-id', created_at: '2026-10-15' }, error: null }) }) }));
});
afterEach(cleanup);

describe('global snapshot workspace', () => {
  it('captures live unsaved data and the matching active named tab version', async () => {
    localStorage.setItem('novaride_financial_state_v5', JSON.stringify({ products: ['ancien'] }));
    const { result } = renderHook(() => useSnapshots());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => { expect(await result.current.createSnapshot('Global 2026', undefined, 'scenario')).toBe(true); });
    const snapshot = mocks.insert.mock.calls[0][0].state_data;
    expect(snapshot.financialState.products).toEqual(mocks.state.products);
    expect(snapshot.financialState.activeTabSaves['product-plan'].name).toBe('Base 2026');
    expect(snapshot.tabVersions[0].data.products).toEqual(mocks.state.products);
    expect(snapshot.snapshotVersion).toBe(4);
  });
  it('does not silently omit a version it cannot read', async () => {
    mocks.range.mockResolvedValue({ data: null, error: new Error('Accès refusé') });
    const { result } = renderHook(() => useSnapshots());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => { expect(await result.current.createSnapshot('Global', undefined, 'scenario')).toBe(false); });
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});