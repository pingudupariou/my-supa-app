import { useState, useEffect } from 'react';
import { SectionCard } from '@/components/ui/KPICard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { formatCurrency, formatPercent } from '@/data/financialConfig';
import { Wand2, Plus, Trash2, Users } from 'lucide-react';
import { ClientRevenueConfig, ClientRevenueEntry } from '@/context/FinancialContext';
import { useB2BClientsData, B2BClient, B2BClientCategory } from '@/hooks/useB2BClientsData';

interface ClientRevenueEditorProps {
  config: ClientRevenueConfig;
  onChange: (config: ClientRevenueConfig) => void;
  years: number[];
}

export function ClientRevenueEditor({ config, onChange, years }: ClientRevenueEditorProps) {
  const { clients, categories } = useB2BClientsData();
  const baseYear = years[0];

  const handleAddClient = (client: B2BClient) => {
    if (config.entries.some(e => e.clientId === client.id)) return;
    const cat = categories.find(c => c.id === client.category_id);
    const entry: ClientRevenueEntry = {
      clientId: client.id,
      clientName: client.company_name,
      categoryId: client.category_id,
      categoryName: cat?.name || null,
      baseRevenue: 0,
    };
    onChange({ ...config, entries: [...config.entries, entry] });
  };

  const handleRemoveClient = (clientId: string) => {
    onChange({ ...config, entries: config.entries.filter(e => e.clientId !== clientId) });
  };

  const handleBaseRevenueChange = (clientId: string, value: number) => {
    onChange({
      ...config,
      entries: config.entries.map(e => e.clientId === clientId ? { ...e, baseRevenue: value } : e),
    });
  };

  const handleGrowthChange = (value: number) => {
    onChange({ ...config, growthRate: value });
  };

  const handleMarginChange = (value: number) => {
    onChange({ ...config, marginRate: value });
  };

  // Calculate projections
  const getClientRevenue = (baseRevenue: number, year: number) => {
    const elapsed = year - baseYear;
    return baseRevenue * Math.pow(1 + config.growthRate, elapsed);
  };

  const totalByYear = years.map(year => {
    return config.entries.reduce((sum, e) => sum + getClientRevenue(e.baseRevenue, year), 0);
  });

  const totalRevenue = totalByYear.reduce((s, v) => s + v, 0);
  const totalMargin = totalRevenue * config.marginRate;

  // Available clients (not yet added)
  const availableClients = clients.filter(c => !config.entries.some(e => e.clientId === c.id) && c.is_active);

  // Group entries by category
  const entriesByCategory = new Map<string | null, ClientRevenueEntry[]>();
  config.entries.forEach(e => {
    const key = e.categoryId || '__none';
    if (!entriesByCategory.has(key)) entriesByCategory.set(key, []);
    entriesByCategory.get(key)!.push(e);
  });

  return (
    <div className="space-y-4">
      {/* Parameters */}
      <SectionCard title="Paramètres de projection">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2 p-3 rounded-lg border bg-muted/20">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Taux de croissance annuel</span>
              <span className="font-mono text-primary">{(config.growthRate * 100).toFixed(0)}%</span>
            </div>
            <Slider
              value={[config.growthRate * 100]}
              onValueChange={([v]) => handleGrowthChange(v / 100)}
              min={0} max={100} step={1}
            />
          </div>
          <div className="space-y-2 p-3 rounded-lg border bg-muted/20">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Taux de marge brute</span>
              <span className="font-mono text-primary">{(config.marginRate * 100).toFixed(0)}%</span>
            </div>
            <Slider
              value={[config.marginRate * 100]}
              onValueChange={([v]) => handleMarginChange(v / 100)}
              min={0} max={100} step={1}
            />
          </div>
        </div>
      </SectionCard>

      {/* Add client */}
      <SectionCard title="Clients sélectionnés">
        <div className="flex items-center gap-2 mb-4">
          <Select onValueChange={(id) => {
            const client = clients.find(c => c.id === id);
            if (client) handleAddClient(client);
          }}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Ajouter un client..." />
            </SelectTrigger>
            <SelectContent>
              {availableClients.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  {c.company_name}
                  {c.category_id && categories.find(cat => cat.id === c.category_id) && (
                    <span className="text-muted-foreground ml-1">
                      ({categories.find(cat => cat.id === c.category_id)?.name})
                    </span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">
            {config.entries.length} client(s) sélectionné(s)
          </span>
        </div>

        {/* Revenue table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs min-w-[140px]">Client</TableHead>
                <TableHead className="text-xs min-w-[90px]">Catégorie</TableHead>
                <TableHead className="text-xs text-right min-w-[100px]">CA Base ({baseYear})</TableHead>
                {years.slice(1).map(y => (
                  <TableHead key={y} className="text-xs text-right min-w-[90px]">{y}</TableHead>
                ))}
                <TableHead className="text-xs text-right min-w-[90px]">Total</TableHead>
                <TableHead className="text-xs w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {config.entries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={years.length + 3} className="text-center text-muted-foreground py-6">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Ajoutez des clients du CRM pour projeter leur CA</p>
                  </TableCell>
                </TableRow>
              )}
              {config.entries.map(entry => {
                const clientTotal = years.reduce((s, y) => s + getClientRevenue(entry.baseRevenue, y), 0);
                return (
                  <TableRow key={entry.clientId}>
                    <TableCell className="font-medium text-sm">{entry.clientName}</TableCell>
                    <TableCell>
                      {entry.categoryName ? (
                        <Badge variant="outline" className="text-[10px]">{entry.categoryName}</Badge>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        value={entry.baseRevenue || ''}
                        onChange={e => handleBaseRevenueChange(entry.clientId, Number(e.target.value))}
                        className="h-7 w-24 text-right text-xs ml-auto"
                        placeholder="0"
                      />
                    </TableCell>
                    {years.slice(1).map(y => (
                      <TableCell key={y} className="text-right font-mono text-xs">
                        {formatCurrency(getClientRevenue(entry.baseRevenue, y), true)}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-mono text-xs font-medium">
                      {formatCurrency(clientTotal, true)}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => handleRemoveClient(entry.clientId)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {/* Totals */}
              {config.entries.length > 0 && (
                <>
                  <TableRow className="font-semibold border-t-2">
                    <TableCell colSpan={2}>Total CA</TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatCurrency(totalByYear[0], true)}
                    </TableCell>
                    {years.slice(1).map((y, i) => (
                      <TableCell key={y} className="text-right font-mono text-xs">
                        {formatCurrency(totalByYear[i + 1], true)}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-mono text-xs">
                      {formatCurrency(totalRevenue, true)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                  <TableRow className="text-emerald-700 dark:text-emerald-400">
                    <TableCell colSpan={2}>
                      Marge Brute ({(config.marginRate * 100).toFixed(0)}%)
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatCurrency(totalByYear[0] * config.marginRate, true)}
                    </TableCell>
                    {years.slice(1).map((y, i) => (
                      <TableCell key={y} className="text-right font-mono text-xs">
                        {formatCurrency(totalByYear[i + 1] * config.marginRate, true)}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-mono text-xs font-medium">
                      {formatCurrency(totalMargin, true)}
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
