import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Product } from '@/engine/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/data/financialConfig';
import { ArrowRight, Check, Search, TrendingUp } from 'lucide-react';
import { useFinancial } from '@/context/FinancialContext';

interface Props {
  products: Product[];
  years: number[];
  onChannelVolumeChange: (productId: string, year: number, channel: 'B2C' | 'B2B' | 'OEM', volume: number) => void;
  onBulkChannelVolumes?: (changes: { productId: string; year: number; channel: 'B2C' | 'B2B' | 'OEM'; volume: number }[]) => void;
}
const CHANNELS = ['B2C', 'B2B', 'OEM'] as const;
const CHANNEL_STYLE = { B2C: 'border-accent text-accent', B2B: 'border-success text-success', OEM: 'border-warning text-foreground' };
const number = (value: number) => value.toLocaleString('fr-FR');

export function VolumesByChannelTable({ products, years, onChannelVolumeChange, onBulkChannelVolumes }: Props) {
  const { state } = useFinancial();
  const config = state.scenarioConfigs[state.activeScenarioId];
  const volAdj = 1 + config.volumeAdjustment;
  const priceAdj = 1 + config.priceAdjustment;
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [growthOpen, setGrowthOpen] = useState(false);
  const [growthRates, setGrowthRates] = useState<Record<string, number>>({ B2C: 0, B2B: 0, OEM: 0 });
  const [growthStartYear, setGrowthStartYear] = useState<Record<string, number>>({});
  const filtered = products.filter(p => p.name.toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr')));
  const selected = filtered.find(p => p.id === selectedId) ?? filtered[0];
  const price = (p: Product, ch: typeof CHANNELS[number]) => ch === 'B2C' ? p.priceHT : ch === 'B2B' ? (p.priceHT_B2B || p.priceHT) : (p.priceHT_OEM || p.priceHT);
  const volume = (p: Product, year: number, ch: typeof CHANNELS[number]) => year < p.launchYear ? 0 : Math.round((p.volumesByChannel?.[ch]?.[year] || 0) * volAdj);
  const revenue = (p: Product, year: number) => CHANNELS.reduce((sum, ch) => sum + volume(p, year, ch) * price(p, ch) * priceAdj, 0);
  const yearTotals = years.map(year => ({ year, units: products.reduce((sum, p) => sum + CHANNELS.reduce((n, ch) => n + volume(p, year, ch), 0), 0), revenue: products.reduce((sum, p) => sum + revenue(p, year), 0) }));
  const commit = (changes: Parameters<NonNullable<Props['onBulkChannelVolumes']>>[0]) => {
    if (onBulkChannelVolumes) onBulkChannelVolumes(changes);
    else changes.forEach(c => onChannelVolumeChange(c.productId, c.year, c.channel, c.volume));
  };
  const applyGrowth = () => {
    if (!selected) return;
    const changes: Parameters<NonNullable<Props['onBulkChannelVolumes']>>[0] = [];
    CHANNELS.forEach(channel => {
      const values = { ...selected.volumesByChannel?.[channel] };
      const start = Math.max(growthStartYear[selected.id] ?? selected.launchYear, selected.launchYear);
      years.forEach((year, i) => {
        if (!i || year < start || years[i - 1] < selected.launchYear) return;
        const value = Math.round((values[years[i - 1]] || 0) * (1 + growthRates[channel] / 100));
        if (value !== (values[year] || 0)) changes.push({ productId: selected.id, year, channel, volume: value });
        values[year] = value;
      });
    });
    commit(changes);
    setGrowthOpen(false);
  };
  const emptyChanges = () => {
    const changes: Parameters<NonNullable<Props['onBulkChannelVolumes']>>[0] = [];
    products.forEach(p => CHANNELS.forEach(channel => {
      const values = p.volumesByChannel?.[channel] || {};
      const filled = years.filter(y => (values[y] || 0) > 0);
      const last = filled[filled.length - 1];
      if (last === undefined) return;
      years.filter(y => y > last && !values[y]).forEach(year => changes.push({ productId: p.id, year, channel, volume: Math.round(values[last] * Math.pow(1 + growthRates[channel] / 100, year - last)) }));
    }));
    return changes;
  };
  const missing = emptyChanges().length;

  return (
    <section className="space-y-5" aria-label="Volumes par année et canal">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-xl font-semibold">Volumes par année & canal</h2><p className="text-sm text-muted-foreground">{products.length} produits et catégories · {years[0]}–{years[years.length - 1]}</p></div>
        <Button variant="outline" size="sm" onClick={() => setGrowthOpen(true)} disabled={!products.length}><TrendingUp className="h-4 w-4 mr-2" />Croissance & projection</Button>
      </div>

      <div className="flex overflow-x-auto border-y divide-x" aria-label="Totaux annuels du plan">
        {yearTotals.map(t => <div key={t.year} className="min-w-[145px] flex-1 px-4 py-3 first:pl-0">
          <div className="text-sm text-muted-foreground">{t.year}</div>
          <div className="text-base font-semibold tabular-nums mt-1">{formatCurrency(t.revenue)}</div>
          <div className="text-xs text-muted-foreground mt-1">{number(t.units)} unités · CA HT</div>
        </div>)}
      </div>

      {!products.length ? <p className="py-10 text-center text-muted-foreground">Aucun produit validé</p> : <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-5">
        <aside className="space-y-3 min-w-0">
          <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Rechercher un produit" placeholder="Rechercher un produit…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
          <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-y-auto lg:max-h-[510px]" aria-label="Produits à saisir">
            {filtered.map(p => <Button key={p.id} variant="ghost" aria-pressed={selected?.id === p.id} onClick={() => setSelectedId(p.id)} className={`h-auto min-w-[175px] lg:min-w-0 w-full justify-between items-start p-3 text-left whitespace-normal border-l-2 rounded-none ${selected?.id === p.id ? 'bg-muted border-primary' : 'border-transparent'}`}>
              <span className="min-w-0"><span className="block font-medium break-words">{p.name}</span><span className="block text-xs text-muted-foreground mt-1">{p.erplainMembers?.length ? `Catégorie · ${p.erplainMembers.length} produits` : 'Produit'} · {formatCurrency(years.reduce((n, y) => n + revenue(p, y), 0), true)}</span></span>
              {selected?.id === p.id && <ArrowRight className="h-4 w-4 shrink-0 mt-1 ml-2" />}
            </Button>)}
          </div>
          {!filtered.length && <p className="text-sm text-muted-foreground py-3">Aucun produit trouvé.</p>}
        </aside>

        {selected && <div className="min-w-0 space-y-4" key={selected.id}>
          <header className="flex flex-wrap gap-3 items-start justify-between">
            <div><h3 className="text-lg font-semibold break-words">{selected.name}</h3><p className="text-xs text-muted-foreground mt-1">Lancement {selected.launchYear} · Coût unitaire {formatCurrency(selected.unitCost)}</p></div>
            <div className="text-right"><p className="text-xs text-muted-foreground">CA HT cumulé</p><p className="font-semibold tabular-nums">{formatCurrency(years.reduce((n, y) => n + revenue(selected, y), 0))}</p></div>
          </header>
          <div className="overflow-x-auto border-y">
            <Table className="min-w-[640px]">
              <TableHeader><TableRow className="bg-muted/50"><TableHead className="sticky left-0 bg-muted z-10 w-36">Canal / prix HT</TableHead>{years.map(y => <TableHead key={y} className="text-center min-w-[104px]">{y}</TableHead>)}</TableRow></TableHeader>
              <TableBody>
                {CHANNELS.map(ch => <TableRow key={ch}>
                  <TableCell className="sticky left-0 bg-background z-10"><div className={`border-l-2 pl-3 ${CHANNEL_STYLE[ch]}`}><span className="text-sm font-semibold">{ch}</span><span className="block text-xs text-muted-foreground mt-1">{formatCurrency(price(selected, ch))}</span></div></TableCell>
                  {years.map(year => <TableCell key={year} className="px-2 py-4 text-center">
                    {year >= selected.launchYear ? <Input aria-label={`${selected.name} ${ch} ${year}`} type="number" min={0} step={1} inputMode="numeric" value={selected.volumesByChannel?.[ch]?.[year] || 0} onFocus={e => e.target.select()} onChange={e => onChannelVolumeChange(selected.id, year, ch, Number(e.target.value))} className="h-11 w-full min-w-[80px] max-w-[120px] mx-auto text-center text-base font-medium tabular-nums focus-visible:ring-accent" /> : <span className="text-xs text-muted-foreground">Avant lancement</span>}
                  </TableCell>)}
                </TableRow>)}
                <TableRow className="bg-muted/40"><TableCell className="sticky left-0 bg-muted text-xs font-medium">Total unités</TableCell>{years.map(y => <TableCell key={y} className="text-center tabular-nums text-sm font-semibold">{number(CHANNELS.reduce((n, ch) => n + volume(selected, y, ch), 0))}</TableCell>)}</TableRow>
                <TableRow><TableCell className="sticky left-0 bg-background text-xs font-medium">CA de l’année HT</TableCell>{years.map(y => <TableCell key={y} className="text-center tabular-nums text-sm font-semibold">{formatCurrency(revenue(selected, y))}</TableCell>)}</TableRow>
              </TableBody>
            </Table>
          </div>
          {config.volumeAdjustment !== 0 || config.priceAdjustment !== 0 ? <Badge variant="secondary">Scénario {state.activeScenarioId} · volumes {config.volumeAdjustment * 100}% · prix {config.priceAdjustment * 100}%</Badge> : null}
        </div>}
      </div>}

      <Dialog open={growthOpen} onOpenChange={setGrowthOpen}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Croissance & projection</DialogTitle></DialogHeader>
        <div className="grid grid-cols-3 gap-3">{CHANNELS.map(ch => <div key={ch} className="space-y-2"><Label htmlFor={`growth-${ch}`}>{ch} / an</Label><div className="relative"><Input id={`growth-${ch}`} type="number" value={growthRates[ch]} onChange={e => setGrowthRates(prev => ({ ...prev, [ch]: Number(e.target.value) }))} step={5} className="pr-7" /><span className="absolute right-3 top-2 text-muted-foreground">%</span></div></div>)}</div>
        {selected && <div className="space-y-3 py-3 border-y"><h3 className="font-medium break-words">{selected.name}</h3><Label>Croissance à partir de</Label><Select value={String(Math.max(growthStartYear[selected.id] ?? selected.launchYear, selected.launchYear))} onValueChange={value => setGrowthStartYear(prev => ({ ...prev, [selected.id]: Number(value) }))}><SelectTrigger aria-label="Croissance à partir de"><SelectValue /></SelectTrigger><SelectContent>{years.filter(y => y >= selected.launchYear).map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select><Button onClick={applyGrowth} className="w-full"><Check className="h-4 w-4 mr-2" />Appliquer à ce produit</Button></div>}
        <Button variant="outline" disabled={!missing} onClick={() => { commit(emptyChanges()); setGrowthOpen(false); }}><TrendingUp className="h-4 w-4 mr-2" />Compléter les années vides du plan ({missing})</Button>
      </DialogContent></Dialog>
    </section>
  );
}
