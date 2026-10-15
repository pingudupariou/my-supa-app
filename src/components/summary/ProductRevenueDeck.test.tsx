import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProductRevenueDeck } from './ProductRevenueDeck';
import type { Product } from '@/engine/types';
import { formatCurrency } from '@/data/financialConfig';

vi.mock('recharts', () => ({
  ResponsiveContainer: () => null,
  Bar: () => null, BarChart: () => null, CartesianGrid: () => null,
  LabelList: () => null, Tooltip: () => null, XAxis: () => null, YAxis: () => null,
}));
afterEach(cleanup);
const product: Product = {
  id: 'category', name: 'Galets', category: 'B2C', launchYear: 2026,
  devCost: 0, unitCost: 20, priceHT: 100, priceTTC_B2C: 120,
  priceHT_B2B: 50, priceHT_OEM: 30, vatRate: .2,
  coef_shop: 1, coef_dist: 1, coef_oem: 1,
  volumesByYear: { 2026: 999 },
  volumesByChannel: { B2C: { 2025: 100, 2026: 3 }, B2B: { 2026: 5 }, OEM: { 2026: 2 } },
  erplainMembers: ['variant'],
};

describe('Product revenue deck', () => {
  it('shows all plan rows, annual HT amounts and totals without expanding category members', () => {
    render(<ProductRevenueDeck products={[{ ...product, erplainMemberProducts: [{ ...product, id: 'variant', name: 'Membre' }] },
      { ...product, id: 'manual', name: 'Nouveau produit', volumesByChannel: undefined, volumesByYear: { 2026: 2 } }]}
      years={[2025, 2026, 2027]} volumeAdjustment={0} priceAdjustment={0} />);
    const row = screen.getByRole('row', { name: /Galets/ });
    expect(within(row).getAllByText(formatCurrency(610).replace(/\s/g, ' '))).toHaveLength(2);
    expect(within(row).getAllByText(formatCurrency(0).replace(/\s/g, ' '))).toHaveLength(2);
    expect(screen.queryByText('Membre')).not.toBeInTheDocument();
    expect(screen.getByText('Nouveau produit')).toBeInTheDocument();
    const total = screen.getByRole('row', { name: /Total CA HT/ });
    expect(within(total).getAllByText(formatCurrency(810).replace(/\s/g, ' '))).toHaveLength(2);
  });
  it('matches scenario rounding separately for each channel and applies the price adjustment', () => {
    render(<ProductRevenueDeck products={[product]} years={[2026]} volumeAdjustment={.1} priceAdjustment={.05} />);
    // round(3*1.1)*100 + round(5*1.1)*50 + round(2*1.1)*30, then +5%.
    expect(within(screen.getByRole('row', { name: /Galets/ })).getAllByText(formatCurrency(693).replace(/\s/g, ' '))).toHaveLength(2);
  });
});