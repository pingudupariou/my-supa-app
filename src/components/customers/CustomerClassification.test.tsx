import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ getTabPermission: () => 'write' }) }));
vi.mock('./useCustomerClassification', () => ({ useCustomerClassification: () => ({ customers: Array.from({ length: 4640 }, (_, i) => ({ customer_id: `e${i}`, customer_name: `Client ${i}`, channel: 'B2B', commercial_country: null })), error: null, loading: false, reload: vi.fn() }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: (table: string) => {
  const query = { select: () => query, is: () => query, order: () => query, range: async () => ({ data: table === 'b2b_clients' ? Array.from({ length: 80 }, (_, i) => ({ id: `c${i}`, company_name: `CRM ${i}`, erplain_customer_id: null, sales_channel: 'B2B' })) : [], error: null }) };
  return query;
} } }));
import { CustomerClassificationButton } from './CustomerClassification';
afterEach(cleanup);

it('allows switching all classification tabs and closing with a large customer list', async () => {
  render(<CustomerClassificationButton />);
  fireEvent.click(screen.getByRole('button', { name: 'Classement clients' }));
  const crm = screen.getByRole('tab', { name: 'Clients CRM & liens' });
  fireEvent.mouseDown(crm); fireEvent.click(crm);
  await screen.findByText('CRM 0');
  fireEvent.click(screen.getByRole('button', { name: 'Afficher plus de clients' }));
  expect(screen.getByText('CRM 79')).toBeInTheDocument();
  const rules = screen.getByRole('tab', { name: 'Règles & affectation groupée' });
  fireEvent.mouseDown(rules); fireEvent.click(rules);
  expect(screen.getByRole('button', { name: 'Nouvelle règle' })).toBeEnabled();
  const clients = screen.getByRole('tab', { name: 'Clients Erplain' });
  fireEvent.mouseDown(clients); fireEvent.click(clients);
  expect(screen.getByRole('textbox', { name: 'Rechercher un client' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(screen.queryByRole('dialog')).toBeNull();
}, 15000);