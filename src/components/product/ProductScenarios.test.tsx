import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductScenarios } from './ProductScenarios';
import { newScenario, scenarioVolumes, setClientGrowth, setVolumeOverride, type ProductScenario } from '@/engine/productScenarios';
import type { Product } from '@/engine/types';

const store = vi.hoisted(() => ({ products: [] as Product[], scenarios: [] as ProductScenario[] }));
vi.mock('@/context/FinancialContext', () => ({
  useFinancial: () => {
    const [scenarios, setScenarios] = useState(store.scenarios);
    return {
      state: { products: store.products, productScenarios: scenarios },
      computed: { transportByYear: [] },
      updateProductScenarios: (next: ProductScenario[]) => { store.scenarios = next; setScenarios(next); },
      updateProducts: vi.fn(), updateTransportConfig: vi.fn(),
    };
  },
}));
vi.mock('@/components/customers/useChannelLabels', () => ({ useChannelLabels: () => ({ name: (ch: string) => ch }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: vi.fn(async () => ({ data: null, error: null })) } }));
vi.mock('recharts', async importOriginal => ({ ...await importOriginal<object>(), ResponsiveContainer: () => null }));

const product: Product = {
  id: 'galets', name: 'Galets', launchYear: 2026, category: 'B2C', devCost: 0,
  unitCost: 4, priceHT: 10, priceTTC_B2C: 12, priceHT_B2B: 8, priceHT_OEM: 6,
  vatRate: .2, coef_shop: 1, coef_dist: 1, coef_oem: 1, volumesByYear: {},
  volumesByChannel: { B2C: {}, B2B: { 2026: 150, 2027: 150, 2028: 150 }, OEM: {} },
  b2bClients: { enabled: true, historyYears: [], clients: [
    { id: 'alpha', name: 'Alpha', volumes: { 2026: 100, 2027: 100, 2028: 100 }, growthRate: 0, adjustment: 0 },
    { id: 'beta', name: 'Beta', volumes: { 2026: 50, 2027: 50, 2028: 50 }, growthRate: 0, adjustment: 0 },
  ] },
};
const openProduct = () => fireEvent.click(screen.getByRole('button', { name: /^Galets/ }));
beforeEach(() => { store.products = [structuredClone(product)]; store.scenarios = [newScenario('Clients', 0)]; });
afterEach(cleanup);

describe('saisie de croissance des clients dans un scénario', () => {
  it('ajuste un client, recopie son taux et retrouve les taux après réouverture', async () => {
    const view = render(<ProductScenarios years={[2026, 2027, 2028]} />);
    openProduct();
    fireEvent.change(screen.getByLabelText('Croissance Alpha 2027'), { target: { value: '10' } });
    expect(scenarioVolumes(store.products[0], store.scenarios[0], 2027).B2B).toBe(160);
    fireEvent.click(screen.getByRole('button', { name: 'Recopier la croissance de Alpha 2027' }));
    expect(scenarioVolumes(store.products[0], store.scenarios[0], 2028).B2B).toBe(171);
    expect(store.scenarios[0].products.galets.clientGrowthPct?.alpha[2028]).toBe(10);
    await waitFor(() => expect(screen.getByLabelText('Croissance Alpha 2028')).toHaveValue('10'));
    view.unmount();
    render(<ProductScenarios years={[2026, 2027, 2028]} />);
    openProduct();
    await act(async () => {});
    expect(screen.getByLabelText('Croissance Alpha 2027')).toHaveValue('10');
    expect(screen.getByLabelText('Croissance Alpha 2028')).toHaveValue('10');
    expect(screen.getByLabelText('Volume Alpha 2028')).toHaveAttribute('placeholder', '121');
  });
  it('bloque la croissance client quand un total est saisi et retrouve le taux en retirant ce total', async () => {
    store.scenarios = [setVolumeOverride(setClientGrowth(store.scenarios[0], 'galets', 'alpha', [2027], 10), 'galets', 'B2B', [2027], 300)];
    render(<ProductScenarios years={[2026, 2027, 2028]} />);
    openProduct();
    expect(screen.getByLabelText('Croissance Alpha 2027')).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Volume B2B 2027'), { target: { value: '' } });
    expect(screen.getByLabelText('Croissance Alpha 2027')).toBeEnabled();
    expect(screen.getByLabelText('Croissance Alpha 2027')).toHaveValue('10');
    expect(scenarioVolumes(store.products[0], store.scenarios[0], 2027).B2B).toBe(160);
    await act(async () => {});
  });
});