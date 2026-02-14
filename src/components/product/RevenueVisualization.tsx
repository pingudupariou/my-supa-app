import { Product } from '@/engine/types';
import { SectionCard } from '@/components/ui/KPICard';
import { formatCurrency } from '@/data/financialConfig';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface RevenueVisualizationProps {
  products: Product[];
  years: number[];
}

export function RevenueVisualization({ products, years }: RevenueVisualizationProps) {
  const data = years.map(year => {
    const entry: Record<string, any> = { year };
    products.forEach(p => {
      if (p.volumesByChannel) {
        const volB2C = p.volumesByChannel.B2C[year] || 0;
        const volB2B = p.volumesByChannel.B2B[year] || 0;
        const volOEM = p.volumesByChannel.OEM[year] || 0;
        entry[p.name] = (volB2C * p.priceHT + volB2B * (p.priceHT_B2B || p.priceHT) + volOEM * (p.priceHT_OEM || p.priceHT)) / 1000;
      } else {
        const vol = p.volumesByYear[year] || 0;
        entry[p.name] = (vol * p.priceHT) / 1000;
      }
    });
    return entry;
  });

  const colors = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(150, 60%, 40%)', 'hsl(38, 92%, 50%)'];

  return (
    <SectionCard title="CA par Produit">
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="year" />
            <YAxis tickFormatter={v => `${v}k€`} />
            <Tooltip formatter={(v: number) => `${v.toFixed(0)}k€`} />
            <Legend />
            {products.map((p, i) => (
              <Bar key={p.id} dataKey={p.name} stackId="a" fill={colors[i % colors.length]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}
