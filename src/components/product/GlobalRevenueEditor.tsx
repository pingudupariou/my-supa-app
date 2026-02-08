import { SectionCard } from '@/components/ui/KPICard';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatPercent } from '@/data/financialConfig';
import { Wand2 } from 'lucide-react';

export interface GlobalRevenueConfig {
  b2c: Record<number, number>;
  b2b: Record<number, number>;
  oem: Record<number, number>;
  marginRates: { b2c: number; b2b: number; oem: number };
  growthRates: { b2c: number; b2b: number; oem: number };
}

export const defaultGlobalRevenueConfig: GlobalRevenueConfig = {
  b2c: {}, b2b: {}, oem: {},
  marginRates: { b2c: 0.6, b2b: 0.45, oem: 0.3 },
  growthRates: { b2c: 0.15, b2b: 0.2, oem: 0.25 },
};

export function calculateGlobalRevenue(config: GlobalRevenueConfig, year: number): number {
  return (config.b2c[year] || 0) + (config.b2b[year] || 0) + (config.oem[year] || 0);
}

export function calculateGlobalMargin(config: GlobalRevenueConfig, year: number): number {
  const rates = config.marginRates || defaultGlobalRevenueConfig.marginRates;
  return (config.b2c[year] || 0) * rates.b2c
    + (config.b2b[year] || 0) * rates.b2b
    + (config.oem[year] || 0) * rates.oem;
}

export function calculateGlobalCogs(config: GlobalRevenueConfig, year: number): number {
  return calculateGlobalRevenue(config, year) - calculateGlobalMargin(config, year);
}

interface GlobalRevenueEditorProps {
  config: GlobalRevenueConfig;
  onChange: (config: GlobalRevenueConfig) => void;
  years: number[];
}

type ChannelKey = 'b2c' | 'b2b' | 'oem';

const channels: { key: ChannelKey; label: string }[] = [
  { key: 'b2c', label: 'B2C' },
  { key: 'b2b', label: 'B2B' },
  { key: 'oem', label: 'OEM' },
];

export function GlobalRevenueEditor({ config, onChange, years }: GlobalRevenueEditorProps) {
  const marginRates = config.marginRates || defaultGlobalRevenueConfig.marginRates;
  const growthRates = config.growthRates || defaultGlobalRevenueConfig.growthRates;

  const handleChange = (channel: ChannelKey, year: number, value: number) => {
    onChange({
      ...config,
      [channel]: { ...config[channel], [year]: value },
    });
  };

  const handleMarginChange = (channel: ChannelKey, value: number) => {
    onChange({
      ...config,
      marginRates: { ...marginRates, [channel]: value },
    });
  };

  const handleGrowthChange = (channel: ChannelKey, value: number) => {
    onChange({
      ...config,
      growthRates: { ...growthRates, [channel]: value },
    });
  };

  const applyGrowth = (channel: ChannelKey) => {
    const baseYear = years[0];
    const baseValue = config[channel][baseYear] || 0;
    if (baseValue <= 0) return;
    const rate = growthRates[channel];
    const updated = { ...config[channel] };
    years.forEach((year, i) => {
      if (i === 0) return;
      updated[year] = Math.round(baseValue * Math.pow(1 + rate, i));
    });
    onChange({ ...config, [channel]: updated });
  };

  const applyAllGrowth = () => {
    let updated = { ...config };
    channels.forEach(({ key }) => {
      const baseValue = config[key][years[0]] || 0;
      if (baseValue <= 0) return;
      const rate = growthRates[key];
      const channelData = { ...config[key] };
      years.forEach((year, i) => {
        if (i === 0) return;
        channelData[year] = Math.round(baseValue * Math.pow(1 + rate, i));
      });
      updated = { ...updated, [key]: channelData };
    });
    onChange(updated);
  };

  const totalRevenue = years.reduce((s, y) => s + calculateGlobalRevenue(config, y), 0);
  const totalMargin = years.reduce((s, y) => s + calculateGlobalMargin(config, y), 0);
  const globalMarginRate = totalRevenue > 0 ? totalMargin / totalRevenue : 0;

  return (
    <div className="space-y-4">
      {/* Growth rates & margin rates */}
      <SectionCard title="Paramètres par Canal">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {channels.map(ch => (
            <div key={ch.key} className="space-y-3 p-3 rounded-lg border bg-muted/20">
              <div className="font-medium text-sm">{ch.label}</div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Taux de croissance</span>
                  <span className="font-mono">{(growthRates[ch.key] * 100).toFixed(0)}%</span>
                </div>
                <Slider
                  value={[growthRates[ch.key] * 100]}
                  onValueChange={([v]) => handleGrowthChange(ch.key, v / 100)}
                  min={0} max={100} step={1}
                />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Taux de marge</span>
                  <span className="font-mono">{(marginRates[ch.key] * 100).toFixed(0)}%</span>
                </div>
                <Slider
                  value={[marginRates[ch.key] * 100]}
                  onValueChange={([v]) => handleMarginChange(ch.key, v / 100)}
                  min={0} max={100} step={1}
                />
              </div>
              <Button
                variant="outline" size="sm" className="w-full"
                onClick={() => applyGrowth(ch.key)}
              >
                <Wand2 className="h-3 w-3 mr-1" />
                Appliquer croissance
              </Button>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="default" size="sm" onClick={applyAllGrowth}>
            <Wand2 className="h-4 w-4 mr-1" />
            Appliquer croissance à tous les canaux
          </Button>
        </div>
      </SectionCard>

      {/* Revenue table */}
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
                  <td className="py-2 px-3 font-medium">
                    {ch.label}
                    <span className="text-xs text-muted-foreground ml-1">
                      (marge {(marginRates[ch.key] * 100).toFixed(0)}%)
                    </span>
                  </td>
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
              {/* Total CA */}
              <tr className="font-semibold border-t">
                <td className="py-2 px-3">Total CA</td>
                {years.map(year => (
                  <td key={year} className="py-2 px-3 text-center font-mono-numbers">
                    {formatCurrency(calculateGlobalRevenue(config, year), true)}
                  </td>
                ))}
                <td className="py-2 px-3 text-right font-mono-numbers">
                  {formatCurrency(totalRevenue, true)}
                </td>
              </tr>
              {/* Marge */}
              <tr className="text-emerald-700 dark:text-emerald-400">
                <td className="py-2 px-3 font-medium">
                  Marge Brute
                  <span className="text-xs ml-1">({(globalMarginRate * 100).toFixed(0)}%)</span>
                </td>
                {years.map(year => (
                  <td key={year} className="py-2 px-3 text-center font-mono-numbers">
                    {formatCurrency(calculateGlobalMargin(config, year), true)}
                  </td>
                ))}
                <td className="py-2 px-3 text-right font-mono-numbers font-medium">
                  {formatCurrency(totalMargin, true)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
