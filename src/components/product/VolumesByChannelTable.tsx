import { useState } from 'react';
import { Product, VolumesByChannel } from '@/engine/types';
import { SectionCard } from '@/components/ui/KPICard';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/data/financialConfig';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { TrendingUp } from 'lucide-react';

interface Props {
  products: Product[];
  years: number[];
  onChannelVolumeChange: (productId: string, year: number, channel: 'B2C' | 'B2B' | 'OEM', volume: number) => void;
}

const CHANNELS = ['B2C', 'B2B', 'OEM'] as const;

export function VolumesByChannelTable({ products, years, onChannelVolumeChange }: Props) {
  // Growth rates per channel (local state, used to auto-fill)
  const [growthRates, setGrowthRates] = useState<Record<string, number>>({
    B2C: 0, B2B: 0, OEM: 0,
  });

  const applyGrowth = (productId: string, channel: 'B2C' | 'B2B' | 'OEM') => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const channels = product.volumesByChannel || { B2C: {}, B2B: {}, OEM: {} };
    const rate = growthRates[channel] / 100;

    years.forEach((year, i) => {
      if (year < product.launchYear) return;
      // First eligible year: keep existing volume (user-set base), don't overwrite
      if (i === 0 || years[i - 1] < product.launchYear) return;
      const prevVol = channels[channel][years[i - 1]] || 0;
      const newVol = Math.round(prevVol * (1 + rate));
      if (newVol !== (channels[channel][year] || 0)) {
        onChannelVolumeChange(productId, year, channel, newVol);
        channels[channel][year] = newVol;
      }
    });
  };

  // Compute totals per year per channel
  const yearTotals = years.map(year => {
    let b2c = 0, b2b = 0, oem = 0, caB2C = 0, caB2B = 0, caOEM = 0;
    products.forEach(p => {
      const ch = p.volumesByChannel || { B2C: {}, B2B: {}, OEM: {} };
      const vB2C = ch.B2C[year] || 0;
      const vB2B = ch.B2B[year] || 0;
      const vOEM = ch.OEM[year] || 0;
      b2c += vB2C; b2b += vB2B; oem += vOEM;
      caB2C += vB2C * p.priceHT;
      caB2B += vB2B * (p.priceHT_B2B || p.priceHT);
      caOEM += vOEM * (p.priceHT_OEM || p.priceHT);
    });
    return { year, b2c, b2b, oem, caB2C, caB2B, caOEM, caTotal: caB2C + caB2B + caOEM };
  });

  const grandTotal = yearTotals.reduce((s, t) => s + t.caTotal, 0);

  return (
    <SectionCard title="Volumes par Année & Canal">
      {/* Growth rate controls */}
      <div className="flex flex-wrap items-center gap-4 mb-4 p-3 bg-muted/30 rounded-lg border">
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Croissance annuelle :</span>
        {CHANNELS.map(ch => (
          <div key={ch} className="flex items-center gap-1">
            <span className="text-xs font-medium">{ch}</span>
            <Input
              type="number"
              value={growthRates[ch]}
              onChange={e => setGrowthRates(prev => ({ ...prev, [ch]: Number(e.target.value) }))}
              className="h-7 w-16 text-center text-xs"
              step={5}
            />
            <span className="text-xs text-muted-foreground">%</span>
          </div>
        ))}
        <span className="text-xs text-muted-foreground ml-2">
          Cliquez sur le nom d'un produit pour appliquer la croissance.
        </span>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead rowSpan={2} className="min-w-[120px]">Produit</TableHead>
              {years.map(year => (
                <TableHead key={year} colSpan={3} className="text-center border-l">{year}</TableHead>
              ))}
              <TableHead rowSpan={2} className="text-right border-l">CA Total</TableHead>
            </TableRow>
            <TableRow>
              {years.map(year => (
                CHANNELS.map(ch => (
                  <TableHead key={`${year}-${ch}`} className={`text-center text-xs ${ch === 'B2C' ? 'border-l' : ''}`}>{ch}</TableHead>
                ))
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => {
              const channels = product.volumesByChannel || { B2C: {}, B2B: {}, OEM: {} };
              const totalRevenue = years.reduce((sum, year) => {
                const vB2C = channels.B2C[year] || 0;
                const vB2B = channels.B2B[year] || 0;
                const vOEM = channels.OEM[year] || 0;
                return sum + vB2C * product.priceHT + vB2B * (product.priceHT_B2B || product.priceHT) + vOEM * (product.priceHT_OEM || product.priceHT);
              }, 0);

              return (
                <TableRow key={product.id}>
                  <TableCell>
                    <button
                      className="text-left hover:underline cursor-pointer"
                      onClick={() => CHANNELS.forEach(ch => applyGrowth(product.id, ch))}
                      title="Appliquer la croissance sur ce produit"
                    >
                      <div className="font-medium">{product.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Coût: {formatCurrency(product.unitCost)}
                      </div>
                    </button>
                  </TableCell>
                  {years.map(year => (
                    CHANNELS.map(ch => (
                      <TableCell key={`${product.id}-${year}-${ch}`} className={`text-center ${ch === 'B2C' ? 'border-l' : ''}`}>
                        {year >= product.launchYear ? (
                          <Input
                            type="number"
                            value={channels[ch][year] || 0}
                            onChange={(e) => onChannelVolumeChange(product.id, year, ch, Number(e.target.value))}
                            className="h-7 w-16 mx-auto text-center text-xs"
                          />
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>
                    ))
                  ))}
                  <TableCell className="text-right font-mono-numbers font-medium border-l">
                    {formatCurrency(totalRevenue, true)}
                  </TableCell>
                </TableRow>
              );
            })}

            {/* Total row - volumes */}
            <TableRow className="bg-muted/40 font-semibold border-t-2">
              <TableCell>Total Volumes</TableCell>
              {yearTotals.map(t => (
                CHANNELS.map(ch => (
                  <TableCell key={`total-vol-${t.year}-${ch}`} className={`text-center text-xs ${ch === 'B2C' ? 'border-l' : ''}`}>
                    {ch === 'B2C' ? t.b2c : ch === 'B2B' ? t.b2b : t.oem}
                  </TableCell>
                ))
              ))}
              <TableCell className="text-right border-l">-</TableCell>
            </TableRow>

            {/* Total row - CA */}
            <TableRow className="bg-primary/10 font-bold">
              <TableCell>CA par Année</TableCell>
              {yearTotals.map(t => (
                <TableCell key={`total-ca-${t.year}`} colSpan={3} className="text-center border-l text-xs">
                  {formatCurrency(t.caTotal, true)}
                  <div className="text-[10px] font-normal text-muted-foreground">
                    B2C: {formatCurrency(t.caB2C, true)} | B2B: {formatCurrency(t.caB2B, true)} | OEM: {formatCurrency(t.caOEM, true)}
                  </div>
                </TableCell>
              ))}
              <TableCell className="text-right font-mono-numbers border-l">
                {formatCurrency(grandTotal, true)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </SectionCard>
  );
}
