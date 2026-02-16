import { useState } from 'react';
import { SectionCard } from '@/components/ui/KPICard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/data/financialConfig';
import { Trash2, Users, Plus, ChevronRight } from 'lucide-react';
import { ClientRevenueConfig, ClientRevenueEntry } from '@/context/FinancialContext';
import { useB2BClientsData } from '@/hooks/useB2BClientsData';

interface ClientRevenueEditorProps {
  config: ClientRevenueConfig;
  onChange: (config: ClientRevenueConfig) => void;
  years: number[];
}

function channelFromCategory(catName: string | null | undefined): 'B2B' | 'OEM' {
  if (!catName) return 'B2B';
  return catName.toLowerCase().includes('oem') ? 'OEM' : 'B2B';
}

export function ClientRevenueEditor({ config: rawConfig, onChange, years }: ClientRevenueEditorProps) {
  const { clients, categories, projections } = useB2BClientsData();
  const baseYear = years[0];

  const config: ClientRevenueConfig = {
    entries: (rawConfig?.entries ?? []).map(e => ({
      ...e,
      channel: e.channel ?? 'B2B',
      individualGrowthRate: e.individualGrowthRate ?? null,
      revenueByYear: e.revenueByYear ?? {},
    })),
    growthRate: rawConfig?.growthRate ?? 0.1,
    marginRate: rawConfig?.marginRate ?? 0.5,
    marginB2C: rawConfig?.marginB2C ?? 0.6,
    marginByCategory: rawConfig?.marginByCategory ?? {},
  };

  // --- Handlers ---
  const update = (patch: Partial<ClientRevenueConfig>) => onChange({ ...config, ...patch });

  const updateEntry = (clientId: string, patch: Partial<ClientRevenueEntry>) => {
    update({ entries: config.entries.map(e => e.clientId === clientId ? { ...e, ...patch } : e) });
  };

  const handleAddCRMClient = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (!client || config.entries.some(e => e.clientId === clientId)) return;
    const cat = categories.find(c => c.id === client.category_id);
    const channel = channelFromCategory(cat?.name);
    const n1 = projections?.find(p => p.client_id === clientId && p.year === baseYear - 1);
    update({
      entries: [...config.entries, {
        clientId: client.id, clientName: client.company_name,
        categoryId: client.category_id, categoryName: cat?.name || null,
        channel, baseRevenue: n1?.projected_revenue ?? 0,
        individualGrowthRate: null, revenueByYear: {},
      }],
    });
  };

  const handleAddB2C = () => {
    const id = `b2c_${Date.now()}`;
    update({
      entries: [...config.entries, {
        clientId: id, clientName: 'Ventes B2C',
        categoryId: null, categoryName: null,
        channel: 'B2C', baseRevenue: 0,
        individualGrowthRate: null, revenueByYear: {},
      }],
    });
  };

  // Apply growth % to fill all future years from baseRevenue
  const applyGrowth = (clientId: string) => {
    const entry = config.entries.find(e => e.clientId === clientId);
    if (!entry || !entry.baseRevenue) return;
    const growth = entry.individualGrowthRate ?? config.growthRate;
    const revenueByYear: Record<number, number> = {};
    years.forEach((y, i) => {
      revenueByYear[y] = Math.round(entry.baseRevenue * Math.pow(1 + growth, i));
    });
    updateEntry(clientId, { revenueByYear });
  };

  const getRevenue = (entry: ClientRevenueEntry, year: number) => {
    if (entry.revenueByYear?.[year] !== undefined) return entry.revenueByYear[year];
    const elapsed = year - baseYear;
    const growth = entry.individualGrowthRate ?? config.growthRate;
    return entry.baseRevenue * Math.pow(1 + growth, elapsed);
  };

  const totalByYear = years.map(y => config.entries.reduce((s, e) => s + getRevenue(e, y), 0));
  const totalRevenue = totalByYear.reduce((s, v) => s + v, 0);

  const channels: Array<'B2B' | 'OEM' | 'B2C'> = ['B2B', 'OEM', 'B2C'];
  const entriesByChannel = channels
    .map(ch => ({ channel: ch, entries: config.entries.filter(e => e.channel === ch) }))
    .filter(g => g.entries.length > 0);

  const availableCRM = clients.filter(c => c.is_active && !config.entries.some(e => e.clientId === c.id));
  const hasB2C = config.entries.some(e => e.channel === 'B2C');
  // Categories actually used by entries
  const usedCatIds = [...new Set(config.entries.map(e => e.categoryId).filter(Boolean))] as string[];
  const usedCategories = usedCatIds.map(id => categories.find(c => c.id === id)).filter(Boolean) as Array<{ id: string; name: string }>;

  return (
    <div className="space-y-4">
      {/* Parameters */}
      <SectionCard title="Paramètres globaux">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2 p-3 rounded-lg border bg-muted/20">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Croissance globale</span>
              <span className="font-mono text-primary">{(config.growthRate * 100).toFixed(0)}%</span>
            </div>
            <Slider value={[config.growthRate * 100]} onValueChange={([v]) => update({ growthRate: v / 100 })} min={-20} max={100} step={1} />
            <p className="text-[10px] text-muted-foreground">Par défaut si pas de taux individuel</p>
          </div>
          <div className="space-y-2 p-3 rounded-lg border bg-muted/20">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Marge B2B/OEM</span>
              <span className="font-mono text-primary">{(config.marginRate * 100).toFixed(0)}%</span>
            </div>
            <Slider value={[config.marginRate * 100]} onValueChange={([v]) => update({ marginRate: v / 100 })} min={0} max={100} step={1} />
            <p className="text-[10px] text-muted-foreground">Marge par défaut</p>
          </div>
          <div className="space-y-2 p-3 rounded-lg border bg-muted/20">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Marge B2C</span>
              <span className="font-mono text-primary">{(config.marginB2C * 100).toFixed(0)}%</span>
            </div>
            <Slider value={[config.marginB2C * 100]} onValueChange={([v]) => update({ marginB2C: v / 100 })} min={0} max={100} step={1} />
          </div>
        </div>

        {/* Per-category margins */}
        {usedCategories.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm font-medium mb-3">Marge par catégorie</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {usedCategories.map(cat => {
                const catMargin = config.marginByCategory[cat.id] ?? config.marginRate;
                return (
                  <div key={cat.id} className="space-y-1 p-2 rounded border bg-muted/10">
                    <div className="flex justify-between text-xs">
                      <span>{cat.name}</span>
                      <span className="font-mono text-primary">{(catMargin * 100).toFixed(0)}%</span>
                    </div>
                    <Slider
                      value={[catMargin * 100]}
                      onValueChange={([v]) => update({ marginByCategory: { ...config.marginByCategory, [cat.id]: v / 100 } })}
                      min={0} max={100} step={1}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </SectionCard>

      {/* Table */}
      <SectionCard title="CA par Client">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <Select onValueChange={handleAddCRMClient}>
            <SelectTrigger className="w-60">
              <SelectValue placeholder="Ajouter client CRM..." />
            </SelectTrigger>
            <SelectContent>
              {availableCRM.map(c => {
                const cat = categories.find(ct => ct.id === c.category_id);
                return (
                  <SelectItem key={c.id} value={c.id}>
                    {c.company_name} <span className="text-muted-foreground text-xs ml-1">({channelFromCategory(cat?.name)})</span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          {!hasB2C && (
            <Button size="sm" variant="outline" onClick={handleAddB2C}>
              <Plus className="h-3 w-3 mr-1" /> Canal B2C
            </Button>
          )}
          <Badge variant="secondary" className="text-xs">{config.entries.length} entrée(s)</Badge>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs min-w-[120px]">Client</TableHead>
                <TableHead className="text-xs w-12">Canal</TableHead>
                <TableHead className="text-xs text-right w-16">% Croiss.</TableHead>
                <TableHead className="text-xs text-center w-10"></TableHead>
                <TableHead className="text-xs text-right w-20">CA N-1</TableHead>
                {years.map(y => (
                  <TableHead key={y} className="text-xs text-right min-w-[85px]">{y}</TableHead>
                ))}
                <TableHead className="text-xs text-right min-w-[85px]">Total</TableHead>
                <TableHead className="text-xs w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {config.entries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={years.length + 7} className="text-center text-muted-foreground py-6">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Ajoutez des clients CRM ou un canal B2C</p>
                  </TableCell>
                </TableRow>
              )}
              {entriesByChannel.map(group => (
                <>
                  <TableRow key={`h-${group.channel}`} className="bg-muted/30">
                    <TableCell colSpan={years.length + 7} className="py-1">
                      <Badge variant={group.channel === 'B2C' ? 'default' : 'outline'} className="text-[10px]">{group.channel}</Badge>
                      <span className="text-xs text-muted-foreground ml-2">
                        {formatCurrency(years.reduce((s, y) => s + group.entries.reduce((s2, e) => s2 + getRevenue(e, y), 0), 0), true)}
                      </span>
                    </TableCell>
                  </TableRow>
                  {group.entries.map(entry => {
                    const total = years.reduce((s, y) => s + getRevenue(entry, y), 0);
                    const hasGrowth = entry.individualGrowthRate !== null && entry.individualGrowthRate !== undefined;
                    return (
                      <TableRow key={entry.clientId}>
                        <TableCell className="font-medium text-xs">{entry.clientName}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{entry.channel}</Badge></TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            value={hasGrowth ? (entry.individualGrowthRate! * 100).toFixed(0) : ''}
                            onChange={e => updateEntry(entry.clientId, { individualGrowthRate: e.target.value === '' ? null : Number(e.target.value) / 100 })}
                            className="h-7 w-14 text-right text-[10px] ml-auto"
                            placeholder={`${(config.growthRate * 100).toFixed(0)}`}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm" variant="ghost"
                            onClick={() => applyGrowth(entry.clientId)}
                            title="Appliquer la croissance sur toute la ligne"
                            className="h-6 w-6 p-0"
                          >
                            <ChevronRight className="h-3 w-3" />
                          </Button>
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            value={entry.baseRevenue || ''}
                            onChange={e => updateEntry(entry.clientId, { baseRevenue: Number(e.target.value) || 0 })}
                            className="h-7 w-20 text-right text-[10px] ml-auto"
                            placeholder="0"
                          />
                        </TableCell>
                        {years.map(y => {
                          const hasManual = entry.revenueByYear?.[y] !== undefined;
                          const computed = getRevenue(entry, y);
                          return (
                            <TableCell key={y} className="text-right p-1">
                              <Input
                                type="number"
                                value={hasManual ? entry.revenueByYear[y] : ''}
                                onChange={e => {
                                  const val = e.target.value;
                                  const rev = { ...entry.revenueByYear };
                                  if (val === '') { delete rev[y]; } else { rev[y] = Number(val); }
                                  updateEntry(entry.clientId, { revenueByYear: rev });
                                }}
                                className={`h-7 w-20 text-right text-[10px] ml-auto ${hasManual ? 'border-primary/50' : ''}`}
                                placeholder={formatCurrency(computed, true)}
                              />
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-right font-mono text-xs font-medium">{formatCurrency(total, true)}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" onClick={() => update({ entries: config.entries.filter(e => e.clientId !== entry.clientId) })}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </>
              ))}
              {config.entries.length > 0 && (
                <>
                  <TableRow className="font-semibold border-t-2">
                    <TableCell colSpan={5}>Total CA</TableCell>
                    {years.map((y, i) => (
                      <TableCell key={y} className="text-right font-mono text-xs">{formatCurrency(totalByYear[i], true)}</TableCell>
                    ))}
                    <TableCell className="text-right font-mono text-xs">{formatCurrency(totalRevenue, true)}</TableCell>
                    <TableCell />
                  </TableRow>
                  <TableRow className="text-muted-foreground">
                    <TableCell colSpan={5}>Marge ({(config.marginRate * 100).toFixed(0)}%)</TableCell>
                    {years.map((y, i) => (
                      <TableCell key={y} className="text-right font-mono text-xs">{formatCurrency(totalByYear[i] * config.marginRate, true)}</TableCell>
                    ))}
                    <TableCell className="text-right font-mono text-xs font-medium">{formatCurrency(totalRevenue * config.marginRate, true)}</TableCell>
                    <TableCell />
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </SectionCard>
    </div>
  );
}
