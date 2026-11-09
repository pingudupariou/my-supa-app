import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: null, getTabPermission: () => 'write', role: 'admin', isAdmin: true }) }));

const stats = {
  totals: { ca_ht: 1500, qty: 30, shipping_ht: 100, docs: 5, prod_ht: 1400, cogs: 500, cov_ht: 1400, est_ht: 0 },
  shipping: { billed_ht: 100, docs: 2, est_cost: null, real_cost: null },
  costs: { methods: 1, valued: 3, oldest: null, newest: null, by_method: {}, sources: [] },
  missing_cost: [],
  by_month: [{ month: '2026-01', channel: 'B2C', ca_ht: 500, qty: 10, prod_ht: 500, cogs: 200, cov_ht: 500, est_ht: 0 }],
  by_channel: [{ key: 'B2C', ca_ht: 500, qty: 10 }],
  by_customer: [{ key: 'c1', label: 'Tecnoglobe', channel: 'B2B', ca_ht: 900, qty: 20, prod_ht: 900, cogs: 300, cov_ht: 900, est_ht: 0 }],
  by_product: [
    { key: 'v1', label: 'ECROU DISQUE', ca_ht: 1000, qty: 10, prod_ht: 1000, cogs: 400, cov_ht: 1000, est_ht: 0, unit_cost: 40 },
    { key: 'v2', label: 'VIS BTR', ca_ht: 500, qty: 20, prod_ht: 500, cogs: 100, cov_ht: 500, est_ht: 0, unit_cost: null },
  ],
  by_commercial_country: [{ key: 'FR', ca_ht: 1500, qty: 30, default_share: 0.8 }],
  by_delivery_country: [{ key: 'DE', ca_ht: 1500, qty: 30 }],
  reconciliation: { docs_ht: 1500, lines_ht: 1500, invoices: 5, credit_notes: 0, missing_total: 0, no_customer: 0, credit_no_qty_ht: 0 },
  excluded: [],
};
const customers = [{ customer_id: 'c1', channel: 'OEM', commercial_country: 'DE' }];

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: vi.fn(async (name: string) => (name === 'sales_stats' ? { data: stats, error: null } : { data: name === 'sales_breakdown' ? [] : null, error: null })),
    from: () => ({
      select: () => ({
        order: () => ({
          limit: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
          range: async () => ({ data: customers, error: null }),
        }),
      }),
      upsert: async () => ({ error: null }),
    }),
    functions: { invoke: async () => ({ data: null, error: null }) },
    auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
  },
}));

import { SalesStatsPage } from './SalesStatsPage';

afterEach(() => { cleanup(); vi.clearAllMocks(); });
global.ResizeObserver ||= class { observe() {} unobserve() {} disconnect() {} } as any;

const writeText = vi.fn(async () => {});
Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

const openTab = async (name: RegExp) => {
  const tab = await screen.findByRole('tab', { name });
  fireEvent.mouseDown(tab); fireEvent.click(tab);
};

describe('copier les tableaux de Statistiques commerciales', () => {
  it('copies the products table as tab-separated rows with French decimals', async () => {
    render(<MemoryRouter><SalesStatsPage /></MemoryRouter>);
    await openTab(/Produits/);
    fireEvent.click(await screen.findByRole('button', { name: /Copier le tableau/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const text = writeText.mock.calls[0][0] as string;
    expect(text.split('\n')[0]).toBe(['Produit', 'CA HT net', 'Quantités', 'Coût unit.', 'Coût vendu', 'Marge €', 'Marge %', 'Couverture coûts %', 'Note'].join('\t'));
    expect(text).toContain(['ECROU DISQUE', '1000', '10', '40', '400', '600', '60', '100', ''].join('\t'));
    expect(text).toContain(['VIS BTR', '500', '20', 'coût manquant', '100', '400', '80', '100', ''].join('\t'));
  });

  it('copies only the rows the search leaves on screen', async () => {
    render(<MemoryRouter><SalesStatsPage /></MemoryRouter>);
    await openTab(/Produits/);
    fireEvent.change(screen.getByPlaceholderText('Rechercher…'), { target: { value: 'ecrou' } });
    fireEvent.click(await screen.findByRole('button', { name: /Copier le tableau/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const lines = (writeText.mock.calls[0][0] as string).split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[1].split('\t')[0]).toBe('ECROU DISQUE');
  });

  it('copies the channel and country chosen for each customer', async () => {
    render(<MemoryRouter><SalesStatsPage /></MemoryRouter>);
    await openTab(/Clients/);
    fireEvent.click(await screen.findByRole('button', { name: /Copier le tableau/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText.mock.calls[0][0]).toContain(['Tecnoglobe', 'OEM', 'DE', '900', '20', '300', '600', '66,7', '100', ''].join('\t'));
  });

  it('has no duplicate copy button on the drill-down tab, which copies its own table', async () => {
    render(<MemoryRouter><SalesStatsPage /></MemoryRouter>);
    await screen.findByText(/3\. Produits/);
    expect(screen.queryByRole('button', { name: /Copier le tableau/ })).toBeNull();
    expect(screen.getByRole('button', { name: /^Copier$/ })).toBeInTheDocument();
  });
});
