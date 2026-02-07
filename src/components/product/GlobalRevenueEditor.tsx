import { SectionCard } from '@/components/ui/KPICard';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/data/financialConfig';

export interface GlobalRevenueConfig {
  b2c: Record<number, number>;
  b2b: Record<number, number>;
  oem: Record<number, number>;
}

export function calculateGlobalRevenue(config: GlobalRevenueConfig, year: number): number {
  return (config.b2c[year] || 0) + (config.b2b[year] || 0) + (config.oem[year] || 0);
}

interface GlobalRevenueEditorProps {
  config: GlobalRevenueConfig;
  onChange: (config: GlobalRevenueConfig) => void;
  years: number[];
}

export function GlobalRevenueEditor({ config, onChange, years }: GlobalRevenueEditorProps) {
  const channels = [
    { key: 'b2c' as const, label: 'B2C' },
    { key: 'b2b' as const, label: 'B2B' },
    { key: 'oem' as const, label: 'OEM' },
  ];

  const handleChange = (channel: keyof GlobalRevenueConfig, year: number, value: number) => {
    onChange({
      ...config,
      [channel]: { ...config[channel], [year]: value },
    });
  };

  return (
    <SectionCard title="CA Global par Canal">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-3">Canal</th>
              {years.map(y => <th key={y} className="text-center py-2 px-3">{y}</th>)}
              <th className="text-right py-2 px-3">Total</th>
            </tr>
          </thead>
          <tbody>
            {channels.map(ch => (
              <tr key={ch.key} className="border-b">
                <td className="py-2 px-3 font-medium">{ch.label}</td>
                {years.map(year => (
                  <td key={year} className="py-2 px-3 text-center">
                    <Input
                      type="number"
                      value={config[ch.key][year] || 0}
                      onChange={e => handleChange(ch.key, year, Number(e.target.value))}
                      className="h-8 w-24 mx-auto text-right"
                    />
                  </td>
                ))}
                <td className="py-2 px-3 text-right font-mono-numbers font-medium">
                  {formatCurrency(years.reduce((s, y) => s + (config[ch.key][y] || 0), 0), true)}
                </td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="py-2 px-3">Total</td>
              {years.map(year => (
                <td key={year} className="py-2 px-3 text-center font-mono-numbers">
                  {formatCurrency(calculateGlobalRevenue(config, year), true)}
                </td>
              ))}
              <td className="py-2 px-3 text-right font-mono-numbers">
                {formatCurrency(years.reduce((s, y) => s + calculateGlobalRevenue(config, y), 0), true)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
