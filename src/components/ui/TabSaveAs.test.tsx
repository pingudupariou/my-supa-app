import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TabSaveAs, useSaveWithTabVersion } from './TabSaveAs';

const mocks = vi.hoisted(() => ({
  state: { activeTabSaves: {} as Record<string, { id: string; name: string }>, products: [{ name: 'Galets' }] },
  persistLocal: vi.fn(), setActiveTabSave: vi.fn(), applyTabData: vi.fn(), toast: vi.fn(),
  update: vi.fn(), insert: vi.fn(), single: vi.fn(), select: vi.fn(), eq: vi.fn(),
}));
vi.mock('@/context/FinancialContext', () => ({ useFinancial: () => ({ state: mocks.state, persistLocal: mocks.persistLocal, setActiveTabSave: mocks.setActiveTabSave, applyTabData: mocks.applyTabData }) }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user', email: 'test@example.test' }, getTabPermission: () => 'write' }) }));
vi.mock('@/hooks/use-toast', () => ({ toast: mocks.toast }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => ({ update: mocks.update, insert: mocks.insert }) } }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.state.activeTabSaves = {};
  mocks.update.mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockReturnValue({ eq: mocks.eq, select: mocks.select });
  mocks.select.mockReturnValue({ single: mocks.single });
  mocks.single.mockResolvedValue({ data: { id: 'existing' }, error: null });
});
afterEach(cleanup);

describe('active tab save', () => {
  it('shows the opened name at the top of the tab', () => {
    mocks.state.activeTabSaves = { 'product-plan': { id: 'existing', name: 'Plan 2026' } };
    render(<TabSaveAs tabKey="product-plan" label="Plan produit" />);
    expect(screen.getByLabelText('Sauvegarde ouverte — Plan produit')).toHaveTextContent('Plan 2026');
  });
  it('updates the same version without inserting or saving globally', async () => {
    mocks.state.activeTabSaves = { 'product-plan': { id: 'existing', name: 'Plan 2026' } };
    const { result } = renderHook(() => useSaveWithTabVersion('product-plan'));
    await act(async () => { await result.current(); });
    expect(mocks.eq).toHaveBeenCalledWith('id', 'existing');
    expect(mocks.update.mock.calls[0][0].data.products).toEqual(mocks.state.products);
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.persistLocal).toHaveBeenCalledOnce();
  });
  it('requests Save As when no version is opened', async () => {
    const listener = vi.fn();
    window.addEventListener('tab-save-as:product-plan', listener);
    const { result } = renderHook(() => useSaveWithTabVersion('product-plan'));
    await act(async () => { await result.current(); });
    expect(listener).toHaveBeenCalledOnce();
    expect(mocks.insert).not.toHaveBeenCalled();
    window.removeEventListener('tab-save-as:product-plan', listener);
  });
  it('does not report success when the version cannot be updated', async () => {
    mocks.state.activeTabSaves = { 'product-plan': { id: 'existing', name: 'Plan 2026' } };
    mocks.single.mockResolvedValue({ data: null, error: { message: 'Accès refusé' } });
    const { result } = renderHook(() => useSaveWithTabVersion('product-plan'));
    await act(async () => { await result.current(); });
    expect(mocks.persistLocal).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Sauvegarde impossible' }));
  });
});