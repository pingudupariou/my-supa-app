import { useState } from 'react';
import { Product } from '@/engine/types';
import { SectionCard } from '@/components/ui/KPICard';
import { formatCurrency } from '@/data/financialConfig';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { Button } from '@/components/ui/button';
import { useFinancial } from '@/context/FinancialContext';

type ViewMode = 'by-product' | 'by-channel';

interface RevenueVisualizationProps {
  products: Product[];
  years: number[];
}

const CHANNEL_COLORS = {
  B2C: 'hsl(var(--primary))',
  B2B: 'hsl(38, 92%, 50%)',
  OEM: 'hsl(150, 60%, 40%)',
};
const PRODUCT_COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(150, 60%, 40%)', 'hsl(38, 92%, 50%)', 'hsl(280, 60%, 50%)'];

export function RevenueVisualization({ products, years }: RevenueVisualizationProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('by-product');
  const { computed, state } = useFinancial();
  const config = state.scenarioConfigs[state.activeScenarioId];

  const dataByProduct = years.map(year => {
    const entry: Record<string, any> = { year };
    products.forEach(p => {
      if (p.volumesByChannel) {
        const volB2C = Math.round((p.volumesByChannel.B2C[year] || 0) * (1 + config.volumeAdjustment));
        const volB2B = Math.round((p.volumesByChannel.B2B[year] || 0) * (1 + config.volumeAdjustment));
        const volOEM = Math.round((p.volumesByChannel.OEM[year] || 0) * (1 + config.volumeAdjustment));
        entry[p.name] = (volB2C * p.priceHT * (1 + config.priceAdjustment) + volB2B * (p.priceHT_B2B || p.priceHT) * (1 + config.priceAdjustment) + volOEM * (p.priceHT_OEM || p.priceHT) * (1 + config.priceAdjustment)) / 1000;
      } else {
        const vol = Math.round((p.volumesByYear[year] || 0) * (1 + config.volumeAdjustment));
        entry[p.name] = (vol * p.priceHT * (1 + config.priceAdjustment)) / 1000;
      }
    });
    return entry;
  });

  const dataByChannel = years.map(year => {
    let b2c = 0, b2b = 0, oem = 0;
    products.forEach(p => {
      const ch = p.volumesByChannel || { B2C: {}, B2B: {}, OEM: {} };
      const volB2C = Math.round((ch.B2C[year] || 0) * (1 + config.volumeAdjustment));
      const volB2B = Math.round((ch.B2B[year] || 0) * (1 + config.volumeAdjustment));
      const volOEM = Math.round((ch.OEM[year] || 0) * (1 + config.volumeAdjustment));
      b2c += volB2C * p.priceHT * (1 + config.priceAdjustment);
      b2b += volB2B * (p.priceHT_B2B || p.priceHT) * (1 + config.priceAdjustment);
      oem += volOEM * (p.priceHT_OEM || p.priceHT) * (1 + config.priceAdjustment);
    });
    return { year, B2C: b2c / 1000, B2B: b2b / 1000, OEM: oem / 1000 };
  });

  const totalByChannel = { B2C: 0, B2B: 0, OEM: 0 };
  products.forEach(p => {
    const ch = p.volumesByChannel || { B2C: {}, B2B: {}, OEM: {} };
    years.forEach(year => {
      const volB2C = Math.round((ch.B2C[year] || 0) * (1 + config.volumeAdjustment));
      const volB2B = Math.round((ch.B2B[year] || 0) * (1 + config.volumeAdjustment));
      const volOEM = Math.round((ch.OEM[year] || 0) * (1 + config.volumeAdjustment));
      totalByChannel.B2C += volB2C * p.priceHT * (1 + config.priceAdjustment);
      totalByChannel.B2B += volB2B * (p.priceHT_B2B || p.priceHT) * (1 + config.priceAdjustment);
      totalByChannel.OEM += volOEM * (p.priceHT_OEM || p.priceHT) * (1 + config.priceAdjustment);
    });
  });
  const pieData = (['B2C', 'B2B', 'OEM'] as const).map(ch => ({
    name: ch,
    value: Math.round(totalByChannel[ch]),
  })).filter(d => d.value > 0);

  return (
    <SectionCard title="CA par Produit & Canal">
      <div className="flex gap-2 mb-4">
        <Button variant={viewMode === 'by-product' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('by-product')}>
          Par Produit
        </Button>
        <Button variant={viewMode === 'by-channel' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('by-channel')}>
          Par Canal
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 h-64">
          <ResponsiveContainer width="100%" height="100%">
            {viewMode === 'by-product' ? (
              <BarChart data={dataByProduct}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis tickFormatter={v => `${v}k€`} />
                <Tooltip formatter={(v: number) => `${v.toFixed(0)}k€`} />
                <Legend />
                {products.map((p, i) => (
                  <Bar key={p.id} dataKey={p.name} stackId="a" fill={PRODUCT_COLORS[i % PRODUCT_COLORS.length]} />
                ))}
              </BarChart>
            ) : (
              <BarChart data={dataByChannel}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis tickFormatter={v => `${v}k€`} />
                <Tooltip formatter={(v: number) => `${v.toFixed(0)}k€`} />
                <Legend />
                <Bar dataKey="B2C" stackId="a" fill={CHANNEL_COLORS.B2C} />
                <Bar dataKey="B2B" stackId="a" fill={CHANNEL_COLORS.B2B} />
                <Bar dataKey="OEM" stackId="a" fill={CHANNEL_COLORS.OEM} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        <div className="h-64">
          <p className="text-xs text-muted-foreground text-center mb-1">Répartition CA par canal</p>
          <ResponsiveContainer width="100%" height="90%">
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {pieData.map((d) => (
                  <Cell key={d.name} fill={CHANNEL_COLORS[d.name as keyof typeof CHANNEL_COLORS]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => formatCurrency(v, true)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </SectionCard>
  );
}
