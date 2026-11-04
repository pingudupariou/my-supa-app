import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: null, getTabPermission: () => 'write', role: 'admin', isAdmin: true }) }));
vi.mock('@/integrations/supabase/client', () => {
  const chain: any = new Proxy(() => chain, { get: (_t, k) => k === 'then' ? (r: any) => r({ data: [], error: null }) : chain, apply: () => chain });
  return { supabase: { from: () => chain, rpc: () => chain, functions: { invoke: async () => ({ data: null, error: null }) }, auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) }, channel: () => chain, removeChannel: () => {} } };
});
import { FinancialProvider } from '@/context/FinancialContext';
import { ProductPlanPage } from './ProductPlanPage';

afterEach(cleanup);
global.ResizeObserver ||= class { observe() {} unobserve() {} disconnect() {} } as any;

function openTab(name: RegExp) {
  const tab = screen.getByRole('tab', { name });
  fireEvent.mouseDown(tab); fireEvent.click(tab);
}
function fillAndCreate(productName: string) {
  fireEvent.click(screen.getByRole('button', { name: 'Nouveau produit manuel' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Nom du nouveau produit' }), { target: { value: productName } });
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Prix B2C HT' }), { target: { value: '50' } });
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Volume B2C initial' }), { target: { value: '20' } });
  const create = screen.getByRole('button', { name: /^Créer le produit$/ });
  console.log('disabled?', (create as HTMLButtonElement).disabled, (screen.getByRole('spinbutton', { name: 'Année de lancement' }) as HTMLInputElement).value);
  fireEvent.click(create);
}
const renderPage = () => render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><FinancialProvider><ProductPlanPage /></FinancialProvider></MemoryRouter></QueryClientProvider>);

describe('manual product creation on the product plan page', () => {
  it('adds a product from pricing', () => {
    renderPage();
    console.log(screen.getAllByRole('tab').map(t => t.textContent).join(' | '));
    openTab(/Pricing/i);
    fillAndCreate('Produit test pricing');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getAllByDisplayValue('Produit test pricing').length + screen.queryAllByText('Produit test pricing').length).toBeGreaterThan(0);
  });
  it('adds a product from volumes', () => {
    renderPage();
    openTab(/Volumes/i);
    fillAndCreate('Produit test volumes');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryAllByText('Produit test volumes').length).toBeGreaterThan(0);
  });
});
