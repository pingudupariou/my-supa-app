import { SectionCard } from '@/components/ui/KPICard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, formatPercent } from '@/data/financialConfig';
import { Trash2, Users, Download } from 'lucide-react';
import { ClientRevenueConfig, ClientRevenueEntry } from '@/context/FinancialContext';
import { useB2BClientsData } from '@/hooks/useB2BClientsData';

interface ClientRevenueEditorProps {
  config: ClientRevenueConfig;
  onChange: (config: ClientRevenueConfig) => void;
  years: number[];
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
  };

  const handleAddClient = (clientId: string, channel: 'B2C' | 'B2B') => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    if (config.entries.some(e => e.clientId === clientId && e.channel === channel)) return;
    const cat = categories.find(c => c.id === client.category_id);
    const entry: ClientRevenueEntry = {
      clientId: client.id,
      clientName: client.company_name,
      categoryId: client.category_id,
      categoryName: cat?.name || null,
      channel,
      baseRevenue: 0,
      individualGrowthRate: null,
      revenueByYear: {},
    };
    onChange({ ...config, entries: [...config.entries, entry] });
  };

  const handleRemoveClient = (clientId: string, channel: string) => {
    onChange({ ...config, entries: config.entries.filter(e => !(e.clientId === clientId && e.channel === channel)) });
  };

  const handleEntryChange = (clientId: string, channel: string, patch: Partial<ClientRevenueEntry>) => {
    onChange({
      ...config,
      entries: config.entries.map(e =>
        e.clientId === clientId && e.channel === channel ? { ...e, ...patch } : e
      ),
    });
  };

  const handleYearRevenueChange = (clientId: string, channel: string, year: number, value: number | null) => {
    const entry = config.entries.find(e => e.clientId === clientId && e.channel === channel);
    if (!entry) return;
    const revenueByYear = { ...entry.revenueByYear };
    if (value === null || value === undefined || isNaN(value)) {
      delete revenueByYear[year];
    } else {
      revenueByYear[year] = value;
    }
    handleEntryChange(clientId, channel, { revenueByYear });
  };

  const importHistorical = (clientId: string, channel: string) => {
    const clientProjections = projections?.filter(p => p.client_id === clientId) ?? [];
    if (clientProjections.length === 0) return;
    const entry = config.entries.find(e => e.clientId === clientId && e.channel === channel);
    if (!entry) return;
    const revenueByYear = { ...entry.revenueByYear };
    let lastHistorical = entry.baseRevenue;
    clientProjections.forEach(p => {
      if (years.includes(p.year)) {
        revenueByYear[p.year] = p.projected_revenue ?? 0;
      }
      // Use last historical year before baseYear as baseRevenue
      if (p.year === baseYear - 1 && p.projected_revenue) {
        lastHistorical = p.projected_revenue;
      }
    });
    handleEntryChange(clientId, channel, { revenueByYear, baseRevenue: lastHistorical || entry.baseRevenue });
  };

  // Calculate projected revenue for an entry for a given year
  const getClientRevenue = (entry: ClientRevenueEntry, year: number) => {
    if (entry.revenueByYear?.[year] !== undefined && entry.revenueByYear[year] !== null) {
      return entry.revenueByYear[year];
    }
    const elapsed = year - baseYear;
    const growth = entry.individualGrowthRate !== null && entry.individualGrowthRate !== undefined
      ? entry.individualGrowthRate
      : config.growthRate;
    return entry.baseRevenue * Math.pow(1 + growth, elapsed);
  };

  const totalByYear = years.map(year =>
    config.entries.reduce((sum, e) => sum + getClientRevenue(e, year), 0)
  );
  const totalRevenue = totalByYear.reduce((s, v) => s + v, 0);

  const availableClients = clients.filter(c => c.is_active);

  return (
    <div className="space-y-4">
      {/* Global Parameters */}
      <SectionCard title="Paramètres globaux">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2 p-3 rounded-lg border bg-muted/20">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Taux de croissance global</span>
              <span className="font-mono text-primary">{(config.growthRate * 100).toFixed(0)}%</span>
            </div>
            <Slider
              value={[config.growthRate * 100]}
              onValueChange={([v]) => onChange({ ...config, growthRate: v / 100 })}
              min={-20} max={100} step={1}
            />
            <p className="text-[10px] text-muted-foreground">Appliqué aux clients sans taux individuel</p>
          </div>
          <div className="space-y-2 p-3 rounded-lg border bg-muted/20">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Taux de marge brute</span>
              <span className="font-mono text-primary">{(config.marginRate * 100).toFixed(0)}%</span>
            </div>
            <Slider
              value={[config.marginRate * 100]}
              onValueChange={([v]) => onChange({ ...config, marginRate: v / 100 })}
              min={0} max={100} step={1}
            />
          </div>
        </div>
      </SectionCard>

      {/* Client Selection & Table */}
      <SectionCard title="Projection CA par Client">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Select onValueChange={(val) => {
            const [id, ch] = val.split('::');
            handleAddClient(id, ch as 'B2C' | 'B2B');
          }}>
            <SelectTrigger className="w-72">
              <SelectValue placeholder="Ajouter un client (canal)..." />
            </SelectTrigger>
            <SelectContent>
              {availableClients.map(c => (
                <>
                  {!config.entries.some(e => e.clientId === c.id && e.channel === 'B2B') && (
                    <SelectItem key={`${c.id}::B2B`} value={`${c.id}::B2B`}>
                      {c.company_name} — B2B
                    </SelectItem>
                  )}
                  {!config.entries.some(e => e.clientId === c.id && e.channel === 'B2C') && (
                    <SelectItem key={`${c.id}::B2C`} value={`${c.id}::B2C`}>
                      {c.company_name} — B2C
                    </SelectItem>
                  )}
                </>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="secondary" className="text-xs">
            {config.entries.length} entrée(s)
          </Badge>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs min-w-[130px]">Client</TableHead>
                <TableHead className="text-xs w-14">Canal</TableHead>
                <TableHead className="text-xs w-14">Catég.</TableHead>
                <TableHead className="text-xs text-right w-20">Croiss.</TableHead>
                {years.map(y => (
                  <TableHead key={y} className="text-xs text-right min-w-[90px]">{y}</TableHead>
                ))}
                <TableHead className="text-xs text-right min-w-[90px]">Total</TableHead>
                <TableHead className="text-xs w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {config.entries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={years.length + 6} className="text-center text-muted-foreground py-6">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Ajoutez des clients pour projeter leur CA</p>
                  </TableCell>
                </TableRow>
              )}
              {config.entries.map(entry => {
                const key = `${entry.clientId}::${entry.channel}`;
                const clientTotal = years.reduce((s, y) => s + getClientRevenue(entry, y), 0);
                const hasIndividualGrowth = entry.individualGrowthRate !== null && entry.individualGrowthRate !== undefined;
                const hasProjections = projections?.some(p => p.client_id === entry.clientId);

                return (
                  <TableRow key={key}>
                    <TableCell className="font-medium text-xs">{entry.clientName}</TableCell>
                    <TableCell>
                      <Badge variant={entry.channel === 'B2C' ? 'default' : 'outline'} className="text-[10px]">
                        {entry.channel}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[10px] text-muted-foreground">
                      {entry.categoryName || '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        value={hasIndividualGrowth ? (entry.individualGrowthRate! * 100).toFixed(0) : ''}
                        onChange={e => {
                          const val = e.target.value;
                          handleEntryChange(entry.clientId, entry.channel, {
                            individualGrowthRate: val === '' ? null : Number(val) / 100,
                          });
                        }}
                        className="h-7 w-16 text-right text-[10px] ml-auto"
                        placeholder={`${(config.growthRate * 100).toFixed(0)}%`}
                        title="Taux individuel (vide = global)"
                      />
                    </TableCell>
                    {years.map((y, yi) => {
                      const hasManual = entry.revenueByYear?.[y] !== undefined;
                      const computed = getClientRevenue(entry, y);
                      return (
                        <TableCell key={y} className="text-right p-1">
                          <Input
                            type="number"
                            value={hasManual ? entry.revenueByYear[y] : (yi === 0 ? (entry.baseRevenue || '') : '')}
                            onChange={e => {
                              const val = e.target.value;
                              if (yi === 0 && !hasManual) {
                                // First year = baseRevenue
                                handleEntryChange(entry.clientId, entry.channel, { baseRevenue: Number(val) || 0 });
                              } else {
                                handleYearRevenueChange(entry.clientId, entry.channel, y, val === '' ? null : Number(val));
                              }
                            }}
                            className={`h-7 w-20 text-right text-[10px] ml-auto ${hasManual && yi > 0 ? 'border-primary/50' : ''}`}
                            placeholder={yi > 0 ? formatCurrency(computed, true) : '0'}
                          />
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-right font-mono text-xs font-medium">
                      {formatCurrency(clientTotal, true)}
                    </TableCell>
                    <TableCell className="flex gap-1">
                      {hasProjections && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => importHistorical(entry.clientId, entry.channel)}
                          title="Importer l'historique CA"
                        >
                          <Download className="h-3 w-3 text-primary" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => handleRemoveClient(entry.clientId, entry.channel)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {config.entries.length > 0 && (
                <>
                  <TableRow className="font-semibold border-t-2">
                    <TableCell colSpan={4}>Total CA</TableCell>
                    {years.map((y, i) => (
                      <TableCell key={y} className="text-right font-mono text-xs">
                        {formatCurrency(totalByYear[i], true)}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-mono text-xs">
                      {formatCurrency(totalRevenue, true)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                  <TableRow className="text-muted-foreground">
                    <TableCell colSpan={4}>Marge Brute ({(config.marginRate * 100).toFixed(0)}%)</TableCell>
                    {years.map((y, i) => (
                      <TableCell key={y} className="text-right font-mono text-xs">
                        {formatCurrency(totalByYear[i] * config.marginRate, true)}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-mono text-xs font-medium">
                      {formatCurrency(totalRevenue * config.marginRate, true)}
                    </TableCell>
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
