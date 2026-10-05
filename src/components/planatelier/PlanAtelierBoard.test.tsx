import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanAtelierBoard } from './PlanAtelierBoard';
import { PlanAtelierPage } from '@/pages/PlanAtelierPage';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ isAdmin: false, userRole: 'bureau_etude', getTabPermission: () => 'write' }) }));

vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  functions: { invoke: vi.fn(async () => ({ data: { proposals: [], openLines: [{ line_id: 1, order_id: 10, order_label: 'SO10', customer_name: 'Client test', order_status: 'active', order_created_at: '2026-10-01', shipping_at: '2026-11-10', sku: 'SKU1', quantity: 12, shipped_quantity: 0, remaining: 12 }], stocks: [] }, error: null })) },
  from: () => ({ select: () => ({ order: () => ({ limit: async () => ({ data: [] }) }) }) }),
} }));

describe('Workshop order columns', () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);
  it('allows a non-admin with workshop write permission to sync and calculate', async () => {
    render(<PlanAtelierPage />);
    await screen.findByText('Client test');
    const refresh = screen.getByRole('button', { name: 'Actualiser depuis Erplain' });
    expect(refresh).toBeEnabled();
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({ data: { status: 'success', done: true, counts: {} }, error: null });
    fireEvent.click(refresh);
    await waitFor(() => expect(supabase.functions.invoke).toHaveBeenCalledWith('erplain-sync', { body: { action: 'sync', restart: false, quick: false, mode: 'quick' } }));
    await waitFor(() => expect(refresh).toBeEnabled());
    fireEvent.click(screen.getByText('Tout sélectionner'));
    const calculate = screen.getByRole('button', { name: 'Calculer les OF pour la sélection' });
    expect(calculate).toBeEnabled();
    fireEvent.click(calculate);
    await waitFor(() => expect(supabase.functions.invoke).toHaveBeenCalledWith('erplain-sync', { body: { action: 'plan', includePending: false, selectedLineIds: [1], compute: true } }));
  });
  it('shows client and creation date rather than shipping date', async () => {
    render(<PlanAtelierBoard isAdmin />);
    expect(await screen.findByText('Client test')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Date de création' })).toBeInTheDocument();
    expect(screen.getByText('01/10/2026')).toBeInTheDocument();
    expect(screen.queryByText('2026-11-10')).not.toBeInTheDocument();
  });
  it('restores hidden columns without changing selected data', async () => {
    localStorage.setItem('plan-atelier-order-columns-v1', JSON.stringify(['client', 'stock']));
    render(<PlanAtelierBoard isAdmin />);
    await screen.findByText('01/10/2026');
    expect(screen.queryByRole('columnheader', { name: 'Nom du client' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Colonnes affichées (13/15)' })).toBeInTheDocument();
    fireEvent.click(screen.getByText('Tout sélectionner'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Calculer les OF pour la sélection' })).toBeEnabled());
  });
  it('hides and shows columns using the visible checkbox menu', async () => {
    render(<PlanAtelierBoard isAdmin />);
    await screen.findByText('Client test');
    fireEvent.keyDown(screen.getByRole('button', { name: 'Colonnes affichées (15/15)' }), { key: 'Enter' });
    const item = await screen.findByRole('menuitemcheckbox', { name: 'Nom du client' });
    fireEvent.click(item);
    await waitFor(() => expect(screen.queryByRole('columnheader', { name: 'Nom du client', hidden: true })).not.toBeInTheDocument());
    expect(JSON.parse(localStorage.getItem('plan-atelier-order-columns-v1') ?? '[]')).toContain('client');
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Nom du client' }));
    await waitFor(() => expect(screen.getByRole('columnheader', { name: 'Nom du client', hidden: true })).toBeInTheDocument());
  });
});