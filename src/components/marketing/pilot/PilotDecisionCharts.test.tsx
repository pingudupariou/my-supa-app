import { cloneElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PilotDecisionCharts } from './PilotDecisionCharts';
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return { ...actual, ResponsiveContainer: ({ children }: any) => cloneElement(children, { width: 600, height: 240 }) };
});
describe('decision charts', () => {
  it('loads only on disclosure and renders periods, performance and observed parameter history', () => {
    const day = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    const onLoad = vi.fn();
    const { container } = render(<PilotDecisionCharts action={{ kind: 'budget', campaign_id: '1', proposed_daily_budget: 30 }} loading={false} error={null} onLoad={onLoad} data={{
      rows: [{ campaign_id: 1, day, cost: 10, conversions: 2, conversions_value: 60, clicks: 5 }],
      campaigns: [{ id: '1', name: 'Shopping France', type: 'SHOPPING' }, { id: '2', name: 'Shopping Italie', type: 'SHOPPING' }],
      snapshots: [{ taken_at: day, campaigns: [{ id: '1', name: 'Shopping France', budget: 20 }] }],
    }} />);
    expect(onLoad).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Données pour décider' }));
    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Budget quotidien · historique observé')).toBeInTheDocument();
    expect(screen.getByText('Shopping Italie')).toBeInTheDocument();
    expect(container.querySelectorAll('.recharts-line').length).toBe(3);
    fireEvent.click(screen.getByRole('button', { name: '60 j' }));
    expect(screen.getByText('1/60')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'ROAS attribué' }));
    expect(screen.getByText('6')).toBeInTheDocument();
  });
  it('shows errors and allows retry without any approval controls', () => {
    const onLoad = vi.fn();
    render(<PilotDecisionCharts action={{ kind: 'pause' }} data={null} loading={false} error="Données indisponibles" onLoad={onLoad} />);
    fireEvent.click(screen.getByRole('button', { name: 'Données pour décider' }));
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(onLoad).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('button', { name: 'Appliquer' })).not.toBeInTheDocument();
  });
});