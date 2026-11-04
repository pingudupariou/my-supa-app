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
import { parseAmount } from '@/components/product/ManualPlanProductDialog';

afterEach(cleanup);
global.ResizeObserver ||= class { observe() {} unobserve() {} disconnect() {} } as any;

function openTab(name: RegExp) {
  const tab = screen.getByRole('tab', { name });
  fireEvent.mouseDown(tab); fireEvent.click(tab);
}
function fillAndCreate(productName: string) {
  fireEvent.click(screen.getByRole('button', { name: 'Nouveau produit manuel' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Nom du nouveau produit' }), { target: { value: productName } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Prix B2C HT' }), { target: { value: '49,90' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Volume B2C initial' }), { target: { value: '20' } });
  fireEvent.click(screen.getByRole('button', { name: /^Créer le produit$/ }));
}
const renderPage = () => render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><FinancialProvider><ProductPlanPage /></FinancialProvider></MemoryRouter></QueryClientProvider>);

describe('manual product creation on the product plan page', () => {
  it('reads French decimals and refuses unreadable amounts', () => {
    expect(parseAmount('49,90')).toBe(49.9);
    expect(parseAmount('1 250,5')).toBe(1250.5);
    expect(parseAmount('')).toBe(0);
    expect(parseAmount('abc')).toBeNaN();
  });
  it('explains why a product cannot be created instead of doing nothing', () => {
    renderPage();
    openTab(/Volumes/i);
    fireEvent.click(screen.getByRole('button', { name: 'Nouveau produit manuel' }));
    fireEvent.click(screen.getByRole('button', { name: /^Créer le produit$/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('Indiquez le nom du produit.');
  });
  it('adds a product from pricing', () => {
    renderPage();
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
