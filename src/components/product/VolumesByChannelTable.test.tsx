import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VolumesByChannelTable } from './VolumesByChannelTable';
import type { Product } from '@/engine/types';
vi.mock('@/context/FinancialContext', () => ({ useFinancial: () => ({ state: { activeScenarioId: 'base', scenarioConfigs: { base: { volumeAdjustment: 0, priceAdjustment: 0 } } } }) }));
const product: Product = { id: 'galets', name: 'Galets', category: 'B2C', devCost: 0, priceTTC_B2C: 120, vatRate: .2, coef_shop: 1, coef_dist: 1, coef_oem: 1, volumesByYear: { 2026: 130 }, launchYear: 2026, priceHT: 100, priceHT_B2B: 50, priceHT_OEM: 30, unitCost: 20, volumesByChannel: { B2C: { 2026: 100 }, B2B: { 2026: 20 }, OEM: { 2026: 10 } } };
const years = [2025, 2026, 2027, 2028];
afterEach(cleanup);
describe('visual volume entry', () => {
  it('shows labeled inputs, launch limits and yearly revenue', () => {
    const change = vi.fn();
    render(<VolumesByChannelTable products={[product]} years={years} onChannelVolumeChange={change} />);
    expect(screen.queryByLabelText('Galets B2C 2025')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Galets B2C 2026')).toHaveValue(100);
    fireEvent.change(screen.getByLabelText('Galets OEM 2027'), { target: { value: '42' } });
    expect(change).toHaveBeenCalledWith('galets', 2027, 'OEM', 42);
    expect(screen.getAllByText(/11.*300/).length).toBeGreaterThan(0);
  });
  it('filters products without altering data', () => {
    const change = vi.fn();
    render(<VolumesByChannelTable products={[product, { ...product, id: 'ecrou', name: 'Écrou disque' }]} years={years} onChannelVolumeChange={change} />);
    fireEvent.change(screen.getByLabelText('Rechercher un produit'), { target: { value: 'Écrou' } });
    expect(screen.getByLabelText('Écrou disque B2C 2026')).toHaveValue(100);
    expect(screen.queryByLabelText('Galets B2C 2026')).not.toBeInTheDocument();
    expect(change).not.toHaveBeenCalled();
  });
  it('applies growth in one batch without mutating source data', () => {
    const bulk = vi.fn();
    const original = structuredClone(product);
    render(<VolumesByChannelTable products={[product]} years={years} onChannelVolumeChange={vi.fn()} onBulkChannelVolumes={bulk} />);
    fireEvent.click(screen.getByRole('button', { name: 'Croissance & projection' }));
    fireEvent.change(screen.getByLabelText('Galets B2C / an'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Appliquer à Galets' }));
    expect(bulk).toHaveBeenCalledOnce();
    expect(bulk.mock.calls[0][0]).toEqual(expect.arrayContaining([
      { productId: 'galets', channel: 'B2C', year: 2027, volume: 110 },
      { productId: 'galets', channel: 'B2C', year: 2028, volume: 121 },
    ]));
    expect(product).toEqual(original);
  });
  it('uses independent rates for every product and channel', () => {
    const bulk = vi.fn();
    render(<VolumesByChannelTable products={[product, { ...product, id: 'ecrou', name: 'Écrou' }]} years={years} onChannelVolumeChange={vi.fn()} onBulkChannelVolumes={bulk} />);
    fireEvent.click(screen.getByRole('button', { name: 'Croissance & projection' }));
    fireEvent.change(screen.getByLabelText('Galets B2C / an'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Écrou B2B / an'), { target: { value: '50' } });
    fireEvent.change(screen.getByLabelText('Écrou OEM / an'), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Appliquer à tous les produits' }));
    expect(bulk).toHaveBeenCalledOnce();
    expect(bulk.mock.calls[0][0]).toEqual(expect.arrayContaining([
      { productId: 'galets', channel: 'B2C', year: 2028, volume: 121 },
      { productId: 'galets', channel: 'B2B', year: 2028, volume: 20 },
      { productId: 'ecrou', channel: 'B2C', year: 2028, volume: 100 },
      { productId: 'ecrou', channel: 'B2B', year: 2028, volume: 45 },
      { productId: 'ecrou', channel: 'OEM', year: 2028, volume: 14 },
    ]));
  });
  it('preserves earlier years and other products with a row-specific start year', async () => {
    const bulk = vi.fn();
    render(<VolumesByChannelTable products={[{ ...product, volumesByChannel: { ...product.volumesByChannel, B2C: { 2026: 100, 2027: 200 } } }, { ...product, id: 'ecrou', name: 'Écrou' }]} years={years} onChannelVolumeChange={vi.fn()} onBulkChannelVolumes={bulk} />);
    fireEvent.click(screen.getByRole('button', { name: 'Croissance & projection' }));
    fireEvent.change(screen.getByLabelText('Galets B2C / an'), { target: { value: '10' } });
    fireEvent.click(screen.getByLabelText('Galets année de départ'));
    fireEvent.click(await screen.findByRole('option', { name: '2028' }));
    fireEvent.click(screen.getByRole('button', { name: 'Appliquer à Galets' }));
    const changes = bulk.mock.calls[0][0];
    expect(changes).toContainEqual({ productId: 'galets', channel: 'B2C', year: 2028, volume: 220 });
    expect(changes.every((c: { year: number; productId: string }) => c.year === 2028 && c.productId === 'galets')).toBe(true);
  });
});