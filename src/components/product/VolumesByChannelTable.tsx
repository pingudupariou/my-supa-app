import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Product } from '@/engine/types';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/data/financialConfig';
import { ArrowLeft, ArrowRight, Check, Search, TrendingUp } from 'lucide-react';
import { useFinancial } from '@/context/FinancialContext';
import { supportsB2BClients } from '@/engine/b2bClients';
import { B2BClientPanel } from './B2BClientPanel';
import { ManualPlanProductDialog } from './ManualPlanProductDialog';

interface Props {
  products: Product[];
  years: number[];
  onChannelVolumeChange: (productId: string, year: number, channel: 'B2C' | 'B2B' | 'OEM', volume: number) => void;
  onBulkChannelVolumes?: (changes: { productId: string; year: number; channel: 'B2C' | 'B2B' | 'OEM'; volume: number }[]) => void;
  onUpdateProduct?: (product: Product) => void;
  onAddProduct?: (product: Product) => void;
  standbyCount?: number;
}
const CHANNELS = ['B2C', 'B2B', 'OEM'] as const;
const CHANNEL_STYLE = { B2C: 'border-accent text-accent', B2B: 'border-success text-success', OEM: 'border-warning text-foreground' };
const number = (value: number) => value.toLocaleString('fr-FR');

export function VolumesByChannelTable({ products, years, onChannelVolumeChange, onBulkChannelVolumes, onUpdateProduct, onAddProduct, standbyCount = 0 }: Props) {
  const { state } = useFinancial();
  const config = state.scenarioConfigs[state.activeScenarioId];
  const volAdj = 1 + config.volumeAdjustment;
  const priceAdj = 1 + config.priceAdjustment;
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [growthOpen, setGrowthOpen] = useState(false);
  const [growthRates, setGrowthRates] = useState<Record<string, Partial<Record<typeof CHANNELS[number], number>>>>({});
  const [growthStartYear, setGrowthStartYear] = useState<Record<string, number>>({});
  const [growthMode, setGrowthMode] = useState<'recalc' | 'fill'>('recalc');
  const filtered = products.filter(p => p.name.toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr')));
  const selected = filtered.find(p => p.id === selectedId) ?? filtered[0];
  const price = (p: Product, ch: typeof CHANNELS[number]) => ch === 'B2C' ? p.priceHT : ch === 'B2B' ? (p.priceHT_B2B || p.priceHT) : (p.priceHT_OEM || p.priceHT);
  const volume = (p: Product, year: number, ch: typeof CHANNELS[number]) => year < p.launchYear ? 0 : Math.round((p.volumesByChannel?.[ch]?.[year] || 0) * volAdj);
  const revenue = (p: Product, year: number) => CHANNELS.reduce((sum, ch) => sum + volume(p, year, ch) * price(p, ch) * priceAdj, 0);
  const yearTotals = years.map(year => ({ year, units: products.reduce((sum, p) => sum + CHANNELS.reduce((n, ch) => n + volume(p, year, ch), 0), 0), revenue: products.reduce((sum, p) => sum + revenue(p, year), 0) }));
  // B2B détaillé par client : ses volumes viennent des clients, jamais de la croissance par canal.
  const byClient = (p: Product, ch: typeof CHANNELS[number]) => ch === 'B2B' && !!p.b2bClients?.enabled;
  // Première année recalculée par la croissance : par défaut l'année suivant l'année en cours,
  // pour ne jamais réappliquer un % sur le réalisé Erplain ni sur la projection de l'année en cours.
  const startOf = (p: Product) => {
    const chosen = growthStartYear[p.id];
    if (chosen !== undefined) return Math.max(chosen, p.launchYear);
    const def = Math.max(p.launchYear, new Date().getFullYear() + 1, years[1] ?? years[0] ?? p.launchYear);
    return Math.min(def, years[years.length - 1] ?? def);
  };
  const commit = (changes: Parameters<NonNullable<Props['onBulkChannelVolumes']>>[0]) => {
    if (onBulkChannelVolumes) onBulkChannelVolumes(changes);
    else changes.forEach(c => onChannelVolumeChange(c.productId, c.year, c.channel, c.volume));
  };
  const applyGrowth = (targets: Product[]) => {
    const changes: Parameters<NonNullable<Props['onBulkChannelVolumes']>>[0] = [];
    targets.forEach(p => CHANNELS.forEach(channel => {
      if (byClient(p, channel)) return;
      const values = { ...p.volumesByChannel?.[channel] };
      const start = startOf(p);
      years.forEach((year, i) => {
        if (!i || year < start || years[i - 1] < p.launchYear) return;
        const value = Math.round((values[years[i - 1]] || 0) * (1 + (growthRates[p.id]?.[channel] ?? 0) / 100));
        if (value !== (values[year] || 0)) changes.push({ productId: p.id, year, channel, volume: value });
        values[year] = value;
      });
    }));
    commit(changes);
    setGrowthOpen(false);
  };
  const emptyChanges = () => {
    const changes: Parameters<NonNullable<Props['onBulkChannelVolumes']>>[0] = [];
    products.forEach(p => CHANNELS.forEach(channel => {
      if (byClient(p, channel)) return;
      const values = p.volumesByChannel?.[channel] || {};
      const filled = years.filter(y => (values[y] || 0) > 0);
      const last = filled[filled.length - 1];
      if (last === undefined) return;
      years.filter(y => y > last && y >= startOf(p) && !values[y]).forEach(year => changes.push({ productId: p.id, year, channel, volume: Math.round(values[last] * Math.pow(1 + (growthRates[p.id]?.[channel] ?? 0) / 100, year - Math.max(last, startOf(p) - 1))) }));
    }));
    return changes;
  };
  const missing = emptyChanges().length;
  // Produits dont on a saisi un % ou une année de départ : seuls eux sont recalculés.
  const touched = new Set([...Object.keys(growthRates), ...Object.keys(growthStartYear)].filter(id => products.some(p => p.id === id)));
  const isEmpty = (p: Product) => !years.some(y => CHANNELS.some(ch => (p.volumesByChannel?.[ch]?.[y] || 0) > 0));
  const toFill = products.filter(isEmpty).length;
  const index = selected ? filtered.findIndex(p => p.id === selected.id) : -1;
  const go = (step: number) => { const next = filtered[index + step]; if (next) setSelectedId(next.id); };
  // Entrée = case suivante (année suivante, puis canal suivant) pour une saisie rapide au clavier.
  const nextOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const inputs = [...(e.currentTarget.closest('table')?.querySelectorAll<HTMLInputElement>('input[data-volume-cell]') ?? [])];
    inputs[inputs.indexOf(e.currentTarget) + 1]?.focus();
  };

  return (
    <section className="space-y-5" aria-label="Volumes par année et canal">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Volumes par année & canal</h2>
          <p className="text-sm text-muted-foreground">{products.length} produits et catégories · {years[0]}–{years[years.length - 1]}{toFill > 0 && <> · <span className="text-warning font-medium">{toFill} à remplir</span></>}{standbyCount > 0 && <> · {standbyCount} en standby (non saisissables)</>}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onAddProduct && <ManualPlanProductDialog years={years} onAdd={p => { onAddProduct(p); setSearch(''); setSelectedId(p.id); }} />}
          <Button variant="outline" size="sm" onClick={() => setGrowthOpen(true)} disabled={!products.length}><TrendingUp className="h-4 w-4 mr-2" />Croissance & projection</Button>
        </div>
      </div>
      <ol className="grid gap-2 sm:grid-cols-3 text-xs text-muted-foreground" aria-label="Comment saisir">
        <li className="rounded-md bg-muted/40 px-3 py-2"><b className="text-foreground">1.</b> Choisissez un produit ou une catégorie dans la liste.</li>
        <li className="rounded-md bg-muted/40 px-3 py-2"><b className="text-foreground">2.</b> Tapez les unités vendues par canal et par année (Entrée = case suivante).</li>
        <li className="rounded-md bg-muted/40 px-3 py-2"><b className="text-foreground">3.</b> Le CA HT se calcule avec les prix de l’étape « Produits & prix ».</li>
      </ol>

      <div className="flex overflow-x-auto border-y divide-x" aria-label="Totaux annuels du plan">
        {yearTotals.map(t => <div key={t.year} className="min-w-[145px] flex-1 px-4 py-3 first:pl-0">
          <div className="text-sm text-muted-foreground">{t.year}</div>
          <div className="text-base font-semibold tabular-nums mt-1">{formatCurrency(t.revenue)}</div>
          <div className="text-xs text-muted-foreground mt-1">{number(t.units)} unités · CA HT</div>
        </div>)}
      </div>

      {!products.length ? <div className="py-10 text-center space-y-1">
        <p className="font-medium">Aucun produit validé à saisir</p>
        <p className="text-sm text-muted-foreground">{standbyCount > 0 ? `${standbyCount} produit(s) en standby : validez-les dans l’étape « Produits & prix » (clic sur le badge Standby), ou créez un nouveau produit.` : 'Créez un nouveau produit ou chargez le réalisé Erplain ci-dessous.'}</p>
      </div> : <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-5">
        <aside className="space-y-3 min-w-0">
          <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Rechercher un produit" placeholder="Rechercher un produit…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
          <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-y-auto lg:max-h-[510px]" aria-label="Produits à saisir">
            {filtered.map(p => <Button key={p.id} variant="ghost" aria-pressed={selected?.id === p.id} onClick={() => setSelectedId(p.id)} className={`h-auto min-w-[175px] lg:min-w-0 w-full justify-between items-start p-3 text-left whitespace-normal border-l-2 rounded-none ${selected?.id === p.id ? 'bg-muted border-primary' : 'border-transparent'}`}>
              <span className="min-w-0"><span className="block font-medium break-words">{p.name}</span><span className="block text-xs text-muted-foreground mt-1">{p.erplainMembers?.length ? `Catégorie · ${p.erplainMembers.length} produits` : 'Produit'} · {isEmpty(p) ? <span className="text-warning font-medium">à remplir</span> : formatCurrency(years.reduce((n, y) => n + revenue(p, y), 0), true)}</span></span>
              {selected?.id === p.id && <ArrowRight className="h-4 w-4 shrink-0 mt-1 ml-2" />}
            </Button>)}
          </div>
          {!filtered.length && <p className="text-sm text-muted-foreground py-3">Aucun produit trouvé.</p>}
        </aside>

        {selected && <div className="min-w-0 space-y-4" key={selected.id}>
          <header className="flex flex-wrap gap-3 items-start justify-between">
            <div><h3 className="text-lg font-semibold break-words">{selected.name}</h3><p className="text-xs text-muted-foreground mt-1">Lancement {selected.launchYear} · Coût unitaire {formatCurrency(selected.unitCost)}</p></div>
            <div className="flex items-start gap-4">
              <div className="text-right"><p className="text-xs text-muted-foreground">CA HT cumulé</p><p className="font-semibold tabular-nums">{formatCurrency(years.reduce((n, y) => n + revenue(selected, y), 0))}</p></div>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="outline" className="h-8 w-8" aria-label="Produit précédent" disabled={index <= 0} onClick={() => go(-1)}><ArrowLeft className="h-4 w-4" /></Button>
                <span className="text-xs text-muted-foreground tabular-nums w-12 text-center">{index + 1} / {filtered.length}</span>
                <Button size="icon" variant="outline" className="h-8 w-8" aria-label="Produit suivant" disabled={index >= filtered.length - 1} onClick={() => go(1)}><ArrowRight className="h-4 w-4" /></Button>
              </div>
            </div>
          </header>
          <div className="overflow-x-auto border-y">
            <Table className="min-w-[640px]">
              <TableHeader><TableRow className="bg-muted/50"><TableHead className="sticky left-0 bg-muted z-10 w-36">Canal / prix HT</TableHead>{years.map(y => <TableHead key={y} className="text-center min-w-[104px]">{y}</TableHead>)}</TableRow></TableHeader>
              <TableBody>
                {CHANNELS.map(ch => <TableRow key={ch}>
                  <TableCell className="sticky left-0 bg-background z-10"><div className={`border-l-2 pl-3 ${CHANNEL_STYLE[ch]}`}><span className="text-sm font-semibold">{ch}</span><span className="block text-xs text-muted-foreground mt-1">{formatCurrency(price(selected, ch))}</span></div></TableCell>
                  {years.map(year => <TableCell key={year} className="px-2 py-4 text-center">
                    {year >= selected.launchYear ? byClient(selected, ch) ? <div className="text-base font-medium tabular-nums" aria-label={`${selected.name} ${ch} ${year}`}>{number(selected.volumesByChannel?.B2B?.[year] || 0)}<span className="block text-[10px] text-muted-foreground">par client</span></div> : <Input aria-label={`${selected.name} ${ch} ${year}`} type="number" min={0} step={1} inputMode="numeric" value={selected.volumesByChannel?.[ch]?.[year] || 0} data-volume-cell onKeyDown={nextOnEnter} onFocus={e => e.target.select()} onChange={e => onChannelVolumeChange(selected.id, year, ch, Number(e.target.value))} className="h-11 w-full min-w-[80px] max-w-[120px] mx-auto text-center text-base font-medium tabular-nums focus-visible:ring-accent" /> : <span className="text-xs text-muted-foreground">Avant lancement</span>}
                  </TableCell>)}
                </TableRow>)}
                <TableRow className="bg-muted/40"><TableCell className="sticky left-0 bg-muted text-xs font-medium">Total unités</TableCell>{years.map(y => <TableCell key={y} className="text-center tabular-nums text-sm font-semibold">{number(CHANNELS.reduce((n, ch) => n + volume(selected, y, ch), 0))}</TableCell>)}</TableRow>
                <TableRow><TableCell className="sticky left-0 bg-background text-xs font-medium">CA de l’année HT</TableCell>{years.map(y => <TableCell key={y} className="text-center tabular-nums text-sm font-semibold">{formatCurrency(revenue(selected, y))}</TableCell>)}</TableRow>
              </TableBody>
            </Table>
          </div>
          {onUpdateProduct && supportsB2BClients(selected) && <B2BClientPanel product={selected} years={years} onChange={onUpdateProduct} />}
          {config.volumeAdjustment !== 0 || config.priceAdjustment !== 0 ? <Badge variant="secondary">Scénario {state.activeScenarioId} · volumes {config.volumeAdjustment * 100}% · prix {config.priceAdjustment * 100}%</Badge> : null}
        </div>}
      </div>}

      <Dialog open={growthOpen} onOpenChange={setGrowthOpen}><DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto" aria-describedby={undefined}><DialogHeader><DialogTitle>Croissance & projection</DialogTitle></DialogHeader>
        <ol className="grid gap-2 sm:grid-cols-3 text-xs text-muted-foreground">
          <li className="rounded-md bg-muted/40 px-3 py-2"><b className="text-foreground">1.</b> Tapez le % par canal sur les produits voulus (les autres ne bougent pas).</li>
          <li className="rounded-md bg-muted/40 px-3 py-2"><b className="text-foreground">2.</b> Choisissez l’année de départ (par défaut l’année suivant l’année en cours).</li>
          <li className="rounded-md bg-muted/40 px-3 py-2"><b className="text-foreground">3.</b> Choisissez quoi remplir, puis un seul bouton : Appliquer.</li>
        </ol>
        <div className="overflow-x-auto border-y">
          <Table className="min-w-[700px]">
            <TableHeader><TableRow><TableHead className="min-w-[200px]">Produit / catégorie</TableHead>{CHANNELS.map(ch => <TableHead key={ch} className="text-center">{ch} / an (%)</TableHead>)}<TableHead className="min-w-[145px]">Année de départ</TableHead></TableRow></TableHeader>
            <TableBody>{products.map(p => <TableRow key={p.id} className={touched.has(p.id) ? 'bg-primary/5' : ''}>
              <TableCell className="font-medium max-w-[260px] break-words">{p.name}{touched.has(p.id) && <span className="block text-[10px] font-normal text-primary">sera recalculé</span>}</TableCell>
              {CHANNELS.map(ch => byClient(p, ch) ? <TableCell key={ch} className="px-2 text-center text-xs text-muted-foreground">Par client<span className="block text-[10px]">(bloc B2B par client)</span></TableCell> : <TableCell key={ch} className="px-2"><div className="relative"><Input aria-label={`${p.name} ${ch} / an`} type="number" value={growthRates[p.id]?.[ch] ?? 0} onChange={e => setGrowthRates(prev => ({ ...prev, [p.id]: { ...prev[p.id], [ch]: Number(e.target.value) } }))} step={1} className="min-w-[90px] pr-7 text-center tabular-nums" /><span className="absolute right-3 top-2 text-muted-foreground">%</span></div></TableCell>)}
              <TableCell><Select value={String(startOf(p))} onValueChange={value => setGrowthStartYear(prev => ({ ...prev, [p.id]: Number(value) }))}><SelectTrigger aria-label={`${p.name} année de départ`} disabled={!years.some(y => y >= p.launchYear)}><SelectValue /></SelectTrigger><SelectContent>{years.filter(y => y >= p.launchYear).map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select></TableCell>
            </TableRow>)}</TableBody>
          </Table>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <RadioGroup value={growthMode} onValueChange={v => setGrowthMode(v as 'recalc' | 'fill')} className="gap-2" aria-label="Quoi remplir">
            <label className="flex items-start gap-2 text-sm cursor-pointer"><RadioGroupItem value="recalc" className="mt-0.5" /><span><b>Recalculer les années</b> à partir de l’année de départ<span className="block text-xs text-muted-foreground">Seulement les produits modifiés ci-dessus ({touched.size}). Les années avant le départ ne changent pas.</span></span></label>
            <label className="flex items-start gap-2 text-sm cursor-pointer"><RadioGroupItem value="fill" className="mt-0.5" /><span><b>Remplir seulement les cases vides</b><span className="block text-xs text-muted-foreground">Tous les produits : prolonge le dernier volume saisi, sans rien écraser ({missing} cases).</span></span></label>
          </RadioGroup>
          <Button disabled={growthMode === 'recalc' ? !touched.size : !missing} onClick={() => growthMode === 'recalc' ? applyGrowth(products.filter(p => touched.has(p.id))) : (commit(emptyChanges()), setGrowthOpen(false))}>
            <Check className="h-4 w-4 mr-2" />{growthMode === 'recalc' ? `Appliquer à ${touched.size} produit${touched.size > 1 ? 's' : ''}` : `Remplir ${missing} case${missing > 1 ? 's' : ''} vide${missing > 1 ? 's' : ''}`}
          </Button>
        </div>
      </DialogContent></Dialog>
    </section>
  );
}
