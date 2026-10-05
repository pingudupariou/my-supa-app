import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';

const state = vi.hoisted(() => ({ role: 'lecteur', permission: 'hidden', roleReads: 0 }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  auth: {
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    getSession: async () => ({ data: { session: { user: { id: 'test-user' } } } }),
  },
  from: (table: string) => ({ select: () => table === 'user_roles' ? {
    eq: () => ({ single: async () => { state.roleReads++; return { data: { role: state.role, approved: true }, error: null }; } }),
  } : Promise.resolve({ data: [{ role: 'bureau_etude', tab_key: 'plan-atelier', permission: state.permission }], error: null }) }),
} }));

function Controls() {
  const { getTabPermission, approvalLoading } = useAuth();
  return <button disabled={approvalLoading || getTabPermission('plan-atelier') !== 'write'}>Actualiser depuis Erplain</button>;
}

describe('Workshop access refresh', () => {
  beforeEach(() => { state.role = 'lecteur'; state.permission = 'hidden'; state.roleReads = 0; });
  afterEach(cleanup);
  it('refreshes a changed role as well as permissions without signing in again', async () => {
    render(<AuthProvider><Controls /></AuthProvider>);
    await waitFor(() => expect(state.roleReads).toBeGreaterThan(0));
    expect(screen.getByRole('button')).toBeDisabled();
    state.role = 'bureau_etude'; state.permission = 'write';
    act(() => { fireEvent.focus(window); });
    await waitFor(() => expect(screen.getByRole('button')).toBeEnabled());
    state.permission = 'read';
    act(() => { fireEvent.focus(window); });
    await waitFor(() => expect(screen.getByRole('button')).toBeDisabled());
  });
  it('enables write access once both role and permissions are loaded', async () => {
    state.role = 'bureau_etude'; state.permission = 'write';
    render(<AuthProvider><Controls /></AuthProvider>);
    await waitFor(() => expect(screen.getByRole('button')).toBeEnabled());
  });
});