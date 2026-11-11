import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ErplainCustomerPicker } from './ErplainCustomerPicker';

afterEach(cleanup);

it('can find and link a customer beyond the first page in a large list', () => {
  const customers = Array.from({ length: 4640 }, (_, i) => ({ customer_id: `e${i}`, customer_name: `Client ${i}`, channel: 'B2B', commercial_country: null }));
  const change = vi.fn();
  render(<ErplainCustomerPicker customers={customers} value={null} disabled={false} onChange={change} />);
  fireEvent.click(screen.getByRole('button', { name: 'Choisir le client Erplain lié' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Rechercher le client Erplain à lier' }), { target: { value: 'Client 4639' } });
  fireEvent.click(screen.getByRole('button', { name: /Client 4639/ }));
  expect(change).toHaveBeenCalledWith('e4639');
  expect(screen.queryByRole('textbox', { name: 'Rechercher le client Erplain à lier' })).toBeNull();
});