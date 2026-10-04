import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanAtelierBoard } from './PlanAtelierBoard';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  functions: { invoke: vi.fn(async () => ({ data: { proposals: [], openLines: [{ line_id: 1, order_id: 10, order_label: 'SO10', customer_name: 'Client test', order_status: 'active', order_created_at: '2026-10-01', shipping_at: '2026-11-10', sku: 'SKU1', quantity: 12, shipped_quantity: 0, remaining: 12 }], stocks: [] }, error: null })) },
  from: () => ({ select: () => ({ order: () => ({ limit: async () => ({ data: [] }) }) }) }),
} }));

describe('Workshop order columns', () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);
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