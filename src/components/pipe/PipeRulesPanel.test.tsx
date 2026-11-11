import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
const { insert, update, remove } = vi.hoisted(() => ({ insert: vi.fn(), update: vi.fn(), remove: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => ({ insert, update, delete: remove }) } }));
import { PipeRulesPanel } from './PipeRulesPanel';
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it('saves a new rule and reloads the persisted rules', async () => {
  insert.mockResolvedValue({ error: null });
  const onReload = vi.fn().mockResolvedValue(undefined);
  render(<PipeRulesPanel rules={[]} orders={[]} canWrite onReload={onReload} error={null} />);
  fireEvent.click(screen.getByRole('button', { name: 'Nouvelle règle' }));
  fireEvent.change(screen.getByLabelText('Nom de la règle'), { target: { value: 'Commandes revendeurs' } });
  fireEvent.change(screen.getByLabelText('Texte recherché'), { target: { value: 'B2B-' } });
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer la règle' }));
  await vi.waitFor(() => expect(onReload).toHaveBeenCalledTimes(1));
  expect(insert).toHaveBeenCalledWith({ name: 'Commandes revendeurs', field: 'label', operator: 'contains', value: 'B2B-', channel: 'b2b', priority: 100, enabled: true });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('prevents rule changes with read-only Pipe permission', () => {
  render(<PipeRulesPanel rules={[]} orders={[]} canWrite={false} onReload={vi.fn()} error={null} />);
  expect(screen.queryByRole('button', { name: 'Nouvelle règle' })).not.toBeInTheDocument();
  expect(insert).not.toHaveBeenCalled();
});