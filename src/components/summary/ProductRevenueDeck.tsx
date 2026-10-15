import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Product } from '@/engine/types';
import { channelPrices, channelVolumes } from '@/engine/calculations';
import { formatCurrency } from '@/data/financialConfig';
import { Badge } from '@/components/ui/badge';

interface ProductRevenueDeckProps {
  products: Product[];
  years: number[];
  volumeAdjustment: number;
  priceAdjustment: number;
}

export function ProductRevenueDeck({ products, years, volumeAdjustment, priceAdjustment }: ProductRevenueDeckProps) {
  // Match the plan's per-channel rounding and active scenario, not cash receipts.
  const rows = products.map(product => {
    const prices = channelPrices(product);
    const amounts = years.map(year => {
      const volumes = channelVolumes(product, year);
      return (['B2C', 'B2B', 'OEM'] as const).reduce((sum, channel) =>
        sum + Math.round(volumes[channel] * (1 + volumeAdjustment)) * prices[channel] * (1 + priceAdjustment), 0);
    });
    return { product, amounts, total: amounts.reduce((sum, amount) => sum + amount, 0) };
  }).sort((a, b) => b.total - a.total);
  const annualTotals = years.map((year, index) => ({ year, revenue: rows.reduce((sum, row) => sum + row.amounts[index], 0) }));
  const total = annualTotals.reduce((sum, entry) => sum + entry.revenue, 0);

  if (!rows.length) return <p className="py-8 text-center text-muted-foreground">Aucun produit dans le plan.</p>;

  return (
    <div className="space-y-5" data-testid="product-revenue-deck">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h4 className="font-semibold">CA annuel par produit</h4>
          <p className="text-sm text-muted-foreground">CA HT · B2C + B2B + OEM · Scénario actif</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">CA cumulé {years[0]}–{years[years.length - 1]}</p>
          <p className="text-2xl font-semibold tabular-nums">{formatCurrency(total)}</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="h-64 min-w-[600px]" role="img" aria-label="Chiffre d’affaires total par année">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={annualTotals} margin={{ top: 30, right: 30, left: 15, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="year" tickLine={false} axisLine={false} />
              <YAxis tickFormatter={value => formatCurrency(value, true)} tickLine={false} axisLine={false} width={70} />
              <Tooltip formatter={(value: number) => [formatCurrency(value), 'CA HT']} />
              <Bar dataKey="revenue" name="CA HT" fill="hsl(var(--primary))" maxBarSize={64} radius={[4, 4, 0, 0]}>
                <LabelList dataKey="revenue" position="top" formatter={(value: number) => formatCurrency(value)} fill="hsl(var(--foreground))" fontSize={12} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <caption className="sr-only">Chiffre d’affaires HT par produit et par année du plan</caption>
          <thead className="bg-muted/40">
            <tr className="border-b">
              <th scope="col" className="px-4 py-3 text-left font-medium">Produit / catégorie</th>
              {years.map(year => <th scope="col" key={year} className="px-4 py-3 text-right font-medium">{year}</th>)}
              <th scope="col" className="px-4 py-3 text-right font-medium">Cumul</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ product, amounts, total: rowTotal }) => (
              <tr key={product.id} className="border-b last:border-0">
                <th scope="row" className="min-w-[180px] px-4 py-3 text-left font-medium">
                  {product.name}
                  {!!product.erplainMembers?.length && <Badge variant="secondary" className="ml-2 text-xs">Catégorie</Badge>}
                </th>
                {amounts.map((amount, index) => <td key={years[index]} className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatCurrency(amount)}</td>)}
                <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums">{formatCurrency(rowTotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t bg-muted/40 font-semibold">
            <tr>
              <th scope="row" className="px-4 py-3 text-left">Total CA HT</th>
              {annualTotals.map(entry => <td key={entry.year} className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatCurrency(entry.revenue)}</td>)}
              <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatCurrency(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}