import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MarketingCockpit } from './MarketingCockpit';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: vi.fn(async (_name, args) => {
  const shop = [], ads = [], ga4 = [];
  for (let date = new Date(args._from + 'T00:00:00Z'); date <= new Date(args._to + 'T00:00:00Z'); date.setUTCDate(date.getUTCDate() + 1)) {
    const day = date.toISOString().slice(0, 10);
    shop.push([day, 'FR', 120, 2, 20]);
    ads.push(['g', day, '1', 30, 10, 100, 1, 150]);
    ga4.push([day, 'Direct', 'FR', 'desktop', 100, 100, 10, 5, 1, 150]);
  }
  return { data: { week: false, shop, ads, ga4, products: [], campaigns: [], ads_country: [] }, error: null };
}) } }));
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return { ...actual, ResponsiveContainer: ({ children }: any) => <actual.ResponsiveContainer width={600} height={260}>{children}</actual.ResponsiveContainer> };
});

describe('cockpit adjustments', () => {
  it('distinguishes amounts, keeps total HT as MER base and adds optional curves', async () => {
    const { container } = render(<MarketingCockpit />);
    await screen.findByText('CA total Shopify HT · base MER');
    expect(screen.getByText('Ventes nettes HT hors livraison · estimées')).toBeInTheDocument();
    expect(screen.getByText('Frais de livraison importés')).toBeInTheDocument();
    expect(screen.getByText('CA total HT, livraison incluse ÷ (Google + Meta)')).toBeInTheDocument();
    expect(screen.getAllByText('Ratio commandes Shopify / sessions GA4').length).toBeGreaterThan(0);
    expect(screen.queryByText('Taux de conversion Shopify')).not.toBeInTheDocument();
    const originalCount = container.querySelectorAll('.recharts-line').length;
    const toggles = screen.getAllByRole('checkbox', { name: 'Moyenne glissante 7 jours' });
    expect(toggles).toHaveLength(4);
    fireEvent.click(toggles[1]);
    await waitFor(() => expect(container.querySelectorAll('.recharts-line').length).toBe(originalCount + 2));
    fireEvent.click(toggles[1]);
    await waitFor(() => expect(container.querySelectorAll('.recharts-line').length).toBe(originalCount));
    expect(screen.getByRole('tab', { name: 'Diagnostic IA' })).toBeInTheDocument();
  });
});