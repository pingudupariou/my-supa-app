import { useState } from 'react';
import { SectionCard } from '@/components/ui/KPICard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/data/financialConfig';
import { Trash2, Users, Download, Plus } from 'lucide-react';
import { ClientRevenueConfig, ClientRevenueEntry } from '@/context/FinancialContext';
import { useB2BClientsData } from '@/hooks/useB2BClientsData';

interface ClientRevenueEditorProps {
  config: ClientRevenueConfig;
  onChange: (config: ClientRevenueConfig) => void;
  years: number[];
}

/** Derive channel from category name */
function channelFromCategory(catName: string | null | undefined): 'B2B' | 'OEM' {
  if (!catName) return 'B2B';
  const lower = catName.toLowerCase();
  if (lower.includes('oem')) return 'OEM';
  return 'B2B';
}

export function ClientRevenueEditor({ config: rawConfig, onChange, years }: ClientRevenueEditorProps) {
  const { clients, categories, projections } = useB2BClientsData();
  const baseYear = years[0];
  const [b2cName, setB2cName] = useState('');

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

  // Add a CRM client (channel derived from category)
  const handleAddCRMClient = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    if (config.entries.some(e => e.clientId === clientId)) return;
    const cat = categories.find(c => c.id === client.category_id);
    const channel = channelFromCategory(cat?.name);

    // Auto-import historical CA from N-1
    const n1Year = baseYear - 1;
    const historicalProjection = projections?.find(p => p.client_id === clientId && p.year === n1Year);
    const baseRevenue = historicalProjection?.projected_revenue ?? 0;

    const entry: ClientRevenueEntry = {
      clientId: client.id,
      clientName: client.company_name,
      categoryId: client.category_id,
      categoryName: cat?.name || null,
      channel,
      baseRevenue,
      individualGrowthRate: null,
      revenueByYear: {},
    };
    onChange({ ...config, entries: [...config.entries, entry] });
  };

  // Add B2C entry (manual, not from CRM)
  const handleAddB2C = () => {
    if (!b2cName.trim()) return;
    const id = `b2c_${Date.now()}`;
    const entry: ClientRevenueEntry = {
      clientId: id,
      clientName: b2cName.trim(),
      categoryId: null,
      categoryName: 'B2C',
      channel: 'B2C',
      baseRevenue: 0,
      individualGrowthRate: null,
      revenueByYear: {},
    };
    onChange({ ...config, entries: [...config.entries, entry] });
    setB2cName('');
  };

  const handleRemoveEntry = (clientId: string) => {
    onChange({ ...config, entries: config.entries.filter(e => e.clientId !== clientId) });
  };

  const handleEntryChange = (clientId: string, patch: Partial<ClientRevenueEntry>) => {
    onChange({
      ...config,
      entries: config.entries.map(e => e.clientId === clientId ? { ...e, ...patch } : e),
    });
  };

  const handleYearRevenueChange = (clientId: string, year: number, value: number | null) => {
    const entry = config.entries.find(e => e.clientId === clientId);
    if (!entry) return;
    const revenueByYear = { ...entry.revenueByYear };
    if (value === null || value === undefined || isNaN(value)) {
      delete revenueByYear[year];
    } else {
      revenueByYear[year] = value;
    }
    handleEntryChange(clientId, { revenueByYear });
  };

  // Import all historical projections for a client
  const importHistorical = (clientId: string) => {
    const clientProjections = projections?.filter(p => p.client_id === clientId) ?? [];
    if (clientProjections.length === 0) return;
    const entry = config.entries.find(e => e.clientId === clientId);
    if (!entry) return;
    const revenueByYear = { ...entry.revenueByYear };
    let newBase = entry.baseRevenue;
    clientProjections.forEach(p => {
      if (years.includes(p.year) && p.projected_revenue) {
        revenueByYear[p.year] = p.projected_revenue;
      }
      if (p.year === baseYear - 1 && p.projected_revenue) {
        newBase = p.projected_revenue;
      }
    });
    handleEntryChange(clientId, { revenueByYear, baseRevenue: newBase || entry.baseRevenue });
  };

  // Calculate projected revenue
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

  // Group by channel
  const channels: Array<'B2B' | 'OEM' | 'B2C'> = ['B2B', 'OEM', 'B2C'];
  const entriesByChannel = channels
    .map(ch => ({ channel: ch, entries: config.entries.filter(e => e.channel === ch) }))
    .filter(g => g.entries.length > 0);

  const availableCRMClients = clients.filter(c => c.is_active && !config.entries.some(e => e.clientId === c.id));

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

      {/* Add clients */}
      <SectionCard title="Projection CA par Client">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {/* CRM clients (B2B/OEM based on category) */}
          <Select onValueChange={handleAddCRMClient}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Ajouter un client CRM..." />
            </SelectTrigger>
            <SelectContent>
              {availableCRMClients.map(c => {
                const cat = categories.find(ct => ct.id === c.category_id);
                const ch = channelFromCategory(cat?.name);
                return (
                  <SelectItem key={c.id} value={c.id}>
                    {c.company_name}
                    <span className="text-muted-foreground ml-1 text-xs">({ch}{cat ? ` — ${cat.name}` : ''})</span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          {/* B2C manual entry */}
          <div className="flex items-center gap-1">
            <Input
              value={b2cName}
              onChange={e => setB2cName(e.target.value)}
              placeholder="Nom canal B2C..."
              className="h-9 w-40 text-xs"
              onKeyDown={e => e.key === 'Enter' && handleAddB2C()}
            />
            <Button size="sm" variant="outline" onClick={handleAddB2C} disabled={!b2cName.trim()}>
              <Plus className="h-3 w-3 mr-1" />
              B2C
            </Button>
          </div>

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
                <TableHead className="text-xs text-right w-16">Croiss. %</TableHead>
                <TableHead className="text-xs text-right w-20">CA N-1</TableHead>
                {years.map(y => (
                  <TableHead key={y} className="text-xs text-right min-w-[85px]">{y}</TableHead>
                ))}
                <TableHead className="text-xs text-right min-w-[85px]">Total</TableHead>
                <TableHead className="text-xs w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {config.entries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={years.length + 7} className="text-center text-muted-foreground py-6">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Ajoutez des clients CRM ou des canaux B2C</p>
                  </TableCell>
                </TableRow>
              )}
              {entriesByChannel.map(group => (
                <>
                  <TableRow key={`header-${group.channel}`} className="bg-muted/30">
                    <TableCell colSpan={years.length + 7} className="py-1">
                      <Badge variant={group.channel === 'B2C' ? 'default' : 'outline'} className="text-[10px]">
                        {group.channel}
                      </Badge>
                      <span className="text-xs text-muted-foreground ml-2">
                        {group.entries.length} client(s) — Total: {formatCurrency(
                          years.reduce((s, y) => s + group.entries.reduce((s2, e) => s2 + getClientRevenue(e, y), 0), 0), true
                        )}
                      </span>
                    </TableCell>
                  </TableRow>
                  {group.entries.map(entry => {
                    const clientTotal = years.reduce((s, y) => s + getClientRevenue(entry, y), 0);
                    const hasIndividualGrowth = entry.individualGrowthRate !== null && entry.individualGrowthRate !== undefined;
                    const hasProjections = projections?.some(p => p.client_id === entry.clientId);

                    return (
                      <TableRow key={entry.clientId}>
                        <TableCell className="font-medium text-xs">{entry.clientName}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">{entry.channel}</Badge>
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
                              handleEntryChange(entry.clientId, {
                                individualGrowthRate: val === '' ? null : Number(val) / 100,
                              });
                            }}
                            className="h-7 w-14 text-right text-[10px] ml-auto"
                            placeholder={`${(config.growthRate * 100).toFixed(0)}`}
                            title="Taux individuel (vide = global)"
                          />
                        </TableCell>
                        <TableCell className="text-right font-mono text-[10px] text-muted-foreground">
                          {entry.baseRevenue > 0 ? formatCurrency(entry.baseRevenue, true) : '—'}
                        </TableCell>
                        {years.map(y => {
                          const hasManual = entry.revenueByYear?.[y] !== undefined;
                          const computed = getClientRevenue(entry, y);
                          return (
                            <TableCell key={y} className="text-right p-1">
                              <Input
                                type="number"
                                value={hasManual ? entry.revenueByYear[y] : ''}
                                onChange={e => {
                                  const val = e.target.value;
                                  handleYearRevenueChange(entry.clientId, y, val === '' ? null : Number(val));
                                }}
                                className={`h-7 w-20 text-right text-[10px] ml-auto ${hasManual ? 'border-primary/50' : ''}`}
                                placeholder={formatCurrency(computed, true)}
                              />
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-right font-mono text-xs font-medium">
                          {formatCurrency(clientTotal, true)}
                        </TableCell>
                        <TableCell className="flex gap-0.5">
                          {hasProjections && (
                            <Button size="sm" variant="ghost" onClick={() => importHistorical(entry.clientId)} title="Importer historique CA">
                              <Download className="h-3 w-3 text-primary" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => handleRemoveEntry(entry.clientId)}>
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
                    <TableCell colSpan={5}>Marge Brute ({(config.marginRate * 100).toFixed(0)}%)</TableCell>
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
