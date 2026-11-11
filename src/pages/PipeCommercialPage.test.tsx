import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke }, from: () => ({ select: () => { const query = { order: () => query, range: () => Promise.resolve({ data: [], error: null }) }; return query; } }) } }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ getTabPermission: () => 'write' }) }));
vi.mock('@/components/pipe/PipeSheet', () => ({ PipeSheet: ({ orders }: { orders: { label: string }[] }) => <div>{orders.map(o => o.label).join(', ')}</div> }));
import { PipeCommercialPage } from './PipeCommercialPage';

const order = { id: '1', label: 'BC-NOV', status: 'active', dated_at: '2026-11-10', channel: 'b2b', total_ht: 100, billed: 0, unbilled: 100, paid: 0, unpaid: 120, lines: [] };
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.useRealTimers(); });

describe('Pipe refresh', () => {
  it('requests the selected month and continues partial pages without duplicate orders', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-11T06:15:00Z'));
    invoke.mockResolvedValueOnce({ data: { status: 'partial', orders: [order], total: 2, next: { page: 6, size: 10 }, read_at: '2026-11-11' } });
    invoke.mockResolvedValueOnce({ data: { status: 'success', orders: [order, { ...order, id: '2', label: 'BC-NOV-2' }], total: 2, read_at: '2026-11-11' } });
    render(<PipeCommercialPage />);
    await screen.findByText('BC-NOV, BC-NOV-2');
    expect(invoke.mock.calls[0][1].body.from).toBe('2026-11-01');
    expect(invoke.mock.calls[0][1].body.to).toBe('2026-11-11');
    expect(invoke.mock.calls[1][1].body.cursor).toEqual({ page: 6, size: 10 });
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it('shows an API error and permits a successful refresh retry', async () => {
    invoke.mockResolvedValueOnce({ data: { status: 'api_error', message: 'Erplain indisponible' } });
    invoke.mockResolvedValueOnce({ data: { status: 'success', orders: [], total: 0, read_at: '2026-11-11' } });
    render(<PipeCommercialPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Erplain indisponible');
    fireEvent.click(screen.getByRole('button', { name: 'Actualiser' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(invoke).toHaveBeenCalledTimes(2);
  });
});