import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VolumesByChannelTable } from './VolumesByChannelTable';
import type { Product } from '@/engine/types';
vi.mock('@/context/FinancialContext', () => ({ useFinancial: () => ({ state: { activeScenarioId: 'base', scenarioConfigs: { base: { volumeAdjustment: 0, priceAdjustment: 0 } } } }) }));
const product = { id: 'galets', name: 'Galets', launchYear: 2026, priceHT: 100, priceHT_B2B: 50, priceHT_OEM: 30, unitCost: 20, volumesByChannel: { B2C: { 2026: 100 }, B2B: { 2026: 20 }, OEM: { 2026: 10 } } } as Product;
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
    fireEvent.change(screen.getByLabelText('B2C / an'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Appliquer à ce produit' }));
    expect(bulk).toHaveBeenCalledOnce();
    expect(bulk.mock.calls[0][0]).toEqual(expect.arrayContaining([
      { productId: 'galets', channel: 'B2C', year: 2027, volume: 110 },
      { productId: 'galets', channel: 'B2C', year: 2028, volume: 121 },
    ]));
    expect(product).toEqual(original);
  });
});