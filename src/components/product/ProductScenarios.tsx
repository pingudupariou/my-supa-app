import { useEffect, useMemo, useState } from 'react';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, Copy, CopyPlus, Plus, Trash2, Upload, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useFinancial } from '@/context/FinancialContext';
import { useChannelLabels } from '@/components/customers/useChannelLabels';
import { copyTable, type Cell } from '@/lib/clipboard';
import { formatCurrency } from '@/data/financialConfig';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { SectionCard } from '@/components/ui/KPICard';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { CHS, applyScenario, newScenario, overrideCount, productLines, scenarioClientVolume, scenarioCost, scenarioPrices, scenarioResults, scenarioVolumes, setClientVolume, setOverride, setVolumeOverride, type ProductScenario, type YearResult } from '@/engine/productScenarios';
import type { Product, ProductCategory } from '@/engine/types';

type Metric = 'revenue' | 'margin' | 'marginPct' | 'cogs' | 'units';
const METRICS: [Metric, string][] = [['revenue', 'CA HT'], ['margin', 'Marge après transport'], ['marginPct', 'Marge %'], ['cogs', 'Coût de revient'], ['units', 'Unités']];
interface Actual { year: number; revenue: number; units: number; cogs: number; covered: number; partial: boolean }

const parse = (s: string) => { const t = s.replace(/\s/g, '').replace(',', '.'); if (!t) return undefined; const n = Number(t); return Number.isFinite(n) ? n : undefined; };
const fmtVal = (m: Metric, v: number | null | undefined) => v == null ? '—' : m === 'marginPct' ? `${(v * 100).toFixed(1)} %` : m === 'units' ? Math.round(v).toLocaleString('fr-FR') : formatCurrency(v);

/** Réel Erplain (factures − avoirs) des années terminées et de l'année en cours à date. */
function useErplainActuals(years: number[]) {
  const [rows, setRows] = useState<Actual[]>([]);
  const thisYear = new Date().getFullYear();
  const key = years.join(',');
  useEffect(() => {
    let live = true;
    const ys = years.filter(y => y <= thisYear);
    Promise.all(ys.map(async y => {
      const { data, error } = await supabase.rpc('sales_stats' as any, { _from: `${y}-01-01`, _to: `${y}-12-31`, _include_shipping: false, _channels: null, _ship_cost_per_doc: 0 });
      if (error || !data) return null;
      const t = (data as any).totals ?? {};
      return { year: y, revenue: t.prod_ht ?? t.ca_ht ?? 0, units: t.qty ?? 0, cogs: t.cogs ?? 0, covered: t.cov_ht ?? 0, partial: y === thisYear } as Actual;
    })).then(r => { if (live) setRows(r.filter(Boolean) as Actual[]); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return rows;
}

const actualValue = (a: Actual | undefined, m: Metric): number | null => {
  if (!a) return null;
  if (m === 'revenue') return a.revenue;
  if (m === 'units') return a.units;
  if (m === 'cogs') return a.covered ? a.cogs : null;
  if (!a.covered) return null;
  const mg = a.covered - a.cogs;
  return m === 'margin' ? mg : mg / a.covered;
};

export function ProductScenarios({ years }: { years: number[] }) {
  const { state, computed, updateProducts, updateProductScenarios, updateTransportConfig } = useFinancial();
  const { name: chName } = useChannelLabels();
  const scenarios = state.productScenarios ?? [];
  const products = state.products;
  const [selId, setSelId] = useState<string | null>(scenarios[0]?.id ?? null);
  const [metric, setMetric] = useState<Metric>('margin');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [confirmApply, setConfirmApply] = useState(false);
  const sel = scenarios.find(s => s.id === selId) ?? null;
  const actuals = useErplainActuals(years);
  const thisYear = new Date().getFullYear();

  const planTransport = useMemo(() => Object.fromEntries(computed.transportByYear.map(t => [t.year, t.transport])), [computed.transportByYear]);
  const series = useMemo(() => [
    { id: 'plan', name: 'Plan actuel', color: 'hsl(var(--muted-foreground))', res: scenarioResults(products, null, years, planTransport) },
    ...scenarios.map(s => ({ id: s.id, name: s.name, color: s.color, res: scenarioResults(products, s, years, planTransport) })),
  ], [products, scenarios, years, planTransport]);

  const save = (list: ProductScenario[]) => updateProductScenarios(list);
  const patch = (sc: ProductScenario) => save(scenarios.map(s => s.id === sc.id ? sc : s));
  const create = (from?: ProductScenario) => {
    const base = newScenario(from ? `${from.name} (copie)` : `Scénario ${scenarios.length + 1}`, scenarios.length);
    const sc = from ? { ...structuredClone(from), id: base.id, name: base.name, color: base.color, createdAt: base.createdAt, appliedAt: undefined } : base;
    save([...scenarios, sc]); setSelId(sc.id);
  };
  const remove = () => { if (!sel) return; const rest = scenarios.filter(s => s.id !== sel.id); save(rest); setSelId(rest[0]?.id ?? null); };
  const apply = () => {
    if (!sel) return;
    updateProducts(applyScenario(products, sel, years));
    if (sel.transportPct != null) updateTransportConfig(state.revenueMode, { enabled: true, type: 'percent', percent: sel.transportPct / 100 });
    // Après application, le scénario repart du nouveau plan : ses écarts sont intégrés.
    patch({ ...sel, products: {}, volumePct: {}, transportPct: null, appliedAt: new Date().toISOString() });
    toast.success(`« ${sel.name} » appliqué au plan. Pensez à sauvegarder le plan.`);
  };

  const chartData = years.map(y => {
    const row: Record<string, number | null | string> = { year: String(y) };
    const a = actualValue(actuals.find(x => x.year === y), metric);
    row.reel = a == null ? null : metric === 'marginPct' ? a * 100 : a;
    series.forEach(s => { const v = (s.res.find(r => r.year === y) as YearResult)[metric]; row[s.id] = v == null ? null : metric === 'marginPct' ? v * 100 : v; });
    return row;
  });

  const copyComparison = async () => {
    const headers = ['Version', 'Indicateur', ...years.map(String), 'Total'];
    const body: Cell[][] = [];
    METRICS.forEach(([m, label]) => {
      const sum = (vals: (number | null)[]) => m === 'marginPct' ? null : vals.reduce<number>((s, v) => s + (v ?? 0), 0);
      const av = years.map(y => actualValue(actuals.find(x => x.year === y), m));
      body.push(['Réel Erplain', label, ...av.map(v => v == null ? null : m === 'marginPct' ? v * 100 : v), sum(av)]);
      series.forEach(s => { const vs = years.map(y => s.res.find(r => r.year === y)![m]); body.push([s.name, label, ...vs.map(v => v == null ? null : m === 'marginPct' ? v * 100 : v), sum(vs)]); });
    });
    const ok = await copyTable(headers, body);
    toast[ok ? 'success' : 'error'](ok ? 'Comparaison copiée : collez-la dans Excel.' : 'Copie refusée par le navigateur.');
  };
  const copyDetail = async () => {
    const lines = productLines(products, sel, years);
    const headers = ['Produit', 'Année', 'Unités', `Prix ${chName('B2C')}`, `Prix ${chName('B2B')}`, `Prix ${chName('OEM')}`, 'Coût de revient', 'CA HT', 'Coût total', 'Marge brute'];
    const body = lines.filter(l => l.units).map(l => [l.name, l.year, l.units, l.prices.B2C, l.prices.B2B, l.prices.OEM, l.cost, l.revenue, l.cogs, l.revenue - l.cogs]);
    const ok = await copyTable(headers, body);
    toast[ok ? 'success' : 'error'](ok ? `Détail « ${sel?.name ?? 'Plan actuel'} » copié pour Excel.` : 'Copie refusée par le navigateur.');
  };

  const filtered = products.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <SectionCard title="Scénarios du plan produit">
        <p className="-mt-2 mb-3 text-sm text-muted-foreground">Testez d'autres prix, coûts de revient, volumes et transport sans toucher au plan, puis comparez avec le réel Erplain.</p>
        <div className="flex flex-wrap items-center gap-2">
          {scenarios.map(s => (
            <button key={s.id} onClick={() => setSelId(s.id)} className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${s.id === selId ? 'border-primary bg-primary/10 font-medium' : 'hover:bg-muted'}`}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />{s.name}
              {s.appliedAt && <Badge variant="secondary" className="text-[10px]">appliqué</Badge>}
            </button>
          ))}
          <Button size="sm" variant="outline" onClick={() => create()}><Plus className="mr-1 h-4 w-4" />Nouveau scénario</Button>
        </div>
        {!scenarios.length && <p className="mt-3 text-sm text-muted-foreground">Créez un scénario : il part du plan actuel, vous ne changez que ce que vous voulez tester.</p>}
      </SectionCard>

      <SectionCard title="Comparaison">
        <p className="-mt-2 mb-3 text-sm text-muted-foreground">Réel Erplain (années terminées, année en cours à date) face au plan et à chaque scénario.</p>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {METRICS.map(([m, l]) => <Button key={m} size="sm" variant={metric === m ? 'default' : 'outline'} onClick={() => setMetric(m)}>{l}</Button>)}
          <Button size="sm" variant="ghost" className="ml-auto" onClick={copyComparison}><Copy className="mr-1 h-4 w-4" />Copier pour Excel</Button>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="year" />
              <YAxis tickFormatter={v => metric === 'marginPct' ? `${v} %` : metric === 'units' ? Number(v).toLocaleString('fr-FR') : `${Math.round(Number(v) / 1000)} k€`} width={70} />
              <Tooltip formatter={(v: any) => v == null ? '—' : metric === 'marginPct' ? `${Number(v).toFixed(1)} %` : metric === 'units' ? Number(v).toLocaleString('fr-FR') : formatCurrency(Number(v))} />
              <Legend />
              <Bar dataKey="reel" name="Réel Erplain" fill="hsl(var(--primary) / 0.35)" />
              {series.map(s => <Line key={s.id} dataKey={s.id} name={s.name} stroke={s.color} strokeWidth={s.id === 'plan' ? 2 : 2.5} strokeDasharray={s.id === 'plan' ? '5 4' : undefined} dot />)}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-xs text-muted-foreground"><th className="py-2 text-left">{METRICS.find(m => m[0] === metric)![1]}</th>{years.map(y => <th key={y} className="px-2 text-right">{y}{y === thisYear ? ' (à date)' : ''}</th>)}</tr></thead>
            <tbody>
              <tr className="border-b bg-muted/30"><td className="py-1.5 font-medium">Réel Erplain</td>{years.map(y => <td key={y} className="px-2 text-right font-mono text-xs">{fmtVal(metric, actualValue(actuals.find(a => a.year === y), metric))}</td>)}</tr>
              {series.map(s => (
                <tr key={s.id} className="border-b">
                  <td className="py-1.5"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />{s.name}</td>
                  {years.map(y => { const v = s.res.find(r => r.year === y)![metric]; const p = series[0].res.find(r => r.year === y)![metric];
                    const d = s.id !== 'plan' && v != null && p != null && metric !== 'marginPct' && p ? (v - p) / Math.abs(p) : null;
                    return <td key={y} className="px-2 text-right font-mono text-xs">{fmtVal(metric, v)}{d != null && Math.abs(d) > 0.0005 && <span className={`ml-1 ${d > 0 ? 'text-primary' : 'text-destructive'}`}>{d > 0 ? '+' : ''}{(d * 100).toFixed(1)}%</span>}</td>; })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted-foreground">Réel : factures − avoirs Erplain, HT hors livraison, tous produits ; marge réelle sur les seules ventes dont le coût est validé. Marge des scénarios = CA − coût de revient − transport.</p>
        </div>
      </SectionCard>

      {sel && (
        <SectionCard title={`Construire « ${sel.name} »`}>
        <p className="-mt-2 mb-3 text-sm text-muted-foreground">Référence : l'étape « Volume par année et par canal ». Une case vide reprend la valeur du plan (affichée en gris).</p>
          <VsPlan plan={series[0].res} sc={series.find(s => s.id === sel.id)!.res} years={years} />
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Input className="h-8 w-56" value={sel.name} onChange={e => patch({ ...sel, name: e.target.value })} aria-label="Nom du scénario" />
            <Button size="sm" variant="outline" onClick={() => create(sel)}><CopyPlus className="mr-1 h-4 w-4" />Dupliquer</Button>
            <Button size="sm" variant="outline" onClick={copyDetail}><Copy className="mr-1 h-4 w-4" />Copier le détail produits</Button>
            <Button size="sm" variant="outline" className="text-destructive" onClick={remove}><Trash2 className="mr-1 h-4 w-4" />Supprimer</Button>
            <Button size="sm" className="ml-auto" onClick={() => setConfirmApply(true)}><Upload className="mr-1 h-4 w-4" />Appliquer au plan</Button>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
            <div className="rounded-lg border p-3">
              <p className="mb-2 text-sm font-medium">Volumes en % du plan (tous produits)</p>
              <p className="mb-2 text-xs text-muted-foreground">Un volume saisi dans un produit ci-dessous remplace ce %.</p>
              <table className="text-sm">
                <thead><tr className="text-xs text-muted-foreground"><th className="pr-3 text-left">Canal</th>{years.map(y => <th key={y} className="px-1">{y}</th>)}</tr></thead>
                <tbody>{CHS.map(ch => (
                  <tr key={ch}><td className="pr-3">{chName(ch)}</td>{years.map(y => (
                    <td key={y} className="px-1 py-0.5"><Input className="h-7 w-16 text-right text-xs" placeholder="0" value={sel.volumePct[y]?.[ch] ?? ''}
                      onChange={e => { const v = parse(e.target.value); const row = { ...(sel.volumePct[y] ?? {}) }; if (v === undefined) delete row[ch]; else row[ch] = v; patch({ ...sel, volumePct: { ...sel.volumePct, [y]: row } }); }} /></td>
                  ))}</tr>
                ))}</tbody>
              </table>
            </div>
            <div className="rounded-lg border p-3">
              <p className="mb-2 text-sm font-medium">Transport / expédition</p>
              <div className="flex items-center gap-2 text-sm"><Input className="h-8 w-20 text-right" placeholder="plan" value={sel.transportPct ?? ''} onChange={e => patch({ ...sel, transportPct: parse(e.target.value) ?? null })} />% du CA</div>
              <p className="mt-1 text-xs text-muted-foreground">Vide : même part du CA que le plan.</p>
            </div>
          </div>

          <div className="mt-4">
            <Input className="mb-2 h-8 max-w-xs" placeholder="Rechercher un produit…" value={search} onChange={e => setSearch(e.target.value)} />
            <div className="divide-y rounded-lg border">
              {filtered.map(p => <ProductRow key={p.id} p={p} sc={sel} years={years} open={open === p.id} onToggle={() => setOpen(open === p.id ? null : p.id)} onChange={patch} chName={chName} />)}
            </div>
          </div>
        </SectionCard>
      )}

      <AlertDialog open={confirmApply} onOpenChange={setConfirmApply}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Appliquer « {sel?.name} » au plan ?</AlertDialogTitle>
            <AlertDialogDescription>Les prix et coûts saisis par année, les volumes (y compris clients B2B) et le transport du scénario remplacent ceux du plan. Les autres scénarios sont conservés. Sauvegardez ensuite le plan ; une version d'onglet précédente permet de revenir en arrière.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={apply}>Appliquer</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ProductRow({ p, sc, years, open, onToggle, onChange, chName }: { p: Product; sc: ProductScenario; years: number[]; open: boolean; onToggle: () => void; onChange: (s: ProductScenario) => void; chName: (c: ProductCategory) => string }) {
  const o = sc.products[p.id];
  const count = overrideCount(o);
  const tot = (s: ProductScenario | null) => productLines([p], s, years).reduce((a, l) => ({ rev: a.rev + l.revenue, mg: a.mg + l.revenue - l.cogs, u: a.u + l.units }), { rev: 0, mg: 0, u: 0 });
  const tp = tot(null), ts = tot(sc);
  const clients = p.b2bClients?.enabled ? p.b2bClients.clients : [];
  const fields: [ProductCategory | 'cost', string][] = [...CHS.map(c => [c, `Prix ${chName(c)} HT`] as [ProductCategory, string]), ['cost', 'Coût de revient']];
  const own = (f: ProductCategory | 'cost', y: number) => f === 'cost' ? o?.unitCost?.[y] : o?.prices?.[y]?.[f];
  const eff = (f: ProductCategory | 'cost', y: number) => f === 'cost' ? scenarioCost(p, sc, y) : scenarioPrices(p, sc, y)[f];
  const plan = (f: ProductCategory | 'cost', y: number) => f === 'cost' ? scenarioCost(p, null, y) : scenarioPrices(p, null, y)[f];
  return (
    <div>
      <button onClick={onToggle} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50">
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <span className="flex-1 truncate">{p.name}</span>
        {count > 0 && <Badge variant="secondary">{count} valeur(s) modifiée(s)</Badge>}
        {count > 0 && <span className="text-xs text-muted-foreground">CA <Delta a={ts.rev} b={tp.rev} /> · Marge <Delta a={ts.mg} b={tp.mg} /></span>}
      </button>
      {open && (
        <div className="overflow-x-auto px-3 pb-3">
          <table className="text-sm">
            <thead><tr className="text-xs text-muted-foreground"><th className="pr-3 text-left" />{years.map(y => <th key={y} className="px-1">{y}</th>)}</tr></thead>
            <tbody>
              {fields.map(([f, label]) => (
                <tr key={f}>
                  <td className="whitespace-nowrap pr-3 text-xs">{label}</td>
                  {years.map((y, i) => (
                    <td key={y} className="px-1 py-0.5">
                      <div className="flex items-center">
                        <Input className={`h-7 w-20 text-right text-xs ${own(f, y) !== undefined ? 'border-primary' : ''}`} placeholder={plan(f, y).toFixed(2).replace('.', ',')}
                          value={own(f, y) ?? ''} onChange={e => onChange(setOverride(sc, p.id, f, [y], parse(e.target.value)))} aria-label={`${label} ${y}`} />
                        {i < years.length - 1 && own(f, y) !== undefined && (
                          <button title="Recopier sur les années suivantes" className="ml-0.5 text-muted-foreground hover:text-primary" onClick={() => onChange(setOverride(sc, p.id, f, years.slice(i + 1), own(f, y)))}><ArrowRight className="h-3 w-3" /></button>
                        )}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
              <tr><td colSpan={years.length + 1} className="pt-3 text-xs font-medium">Volumes (unités) — plan en gris</td></tr>
              {CHS.map(ch => (
                <tr key={`v-${ch}`}>
                  <td className="whitespace-nowrap pr-3 text-xs">Volume {chName(ch)}{ch === 'B2B' && clients.length ? ' (total)' : ''}</td>
                  {years.map((y, i) => { const own = o?.volumes?.[y]?.[ch]; const planV = scenarioVolumes(p, null, y)[ch]; const effV = scenarioVolumes(p, sc, y)[ch];
                    return (
                    <td key={y} className="px-1 py-0.5">
                      <div className="flex items-center">
                        <Input className={`h-7 w-20 text-right text-xs ${own !== undefined ? 'border-primary' : ''}`} placeholder={String(effV)} value={own ?? ''}
                          onChange={e => onChange(setVolumeOverride(sc, p.id, ch, [y], parse(e.target.value)))} aria-label={`Volume ${chName(ch)} ${y}`} />
                        {i < years.length - 1 && own !== undefined && <button title="Recopier sur les années suivantes" className="ml-0.5 text-muted-foreground hover:text-primary" onClick={() => onChange(setVolumeOverride(sc, p.id, ch, years.slice(i + 1), own))}><ArrowRight className="h-3 w-3" /></button>}
                      </div>
                      {effV !== planV && <div className="text-right text-[10px] text-muted-foreground">plan {planV}</div>}
                    </td>); })}
                </tr>
              ))}
              {clients.map(c => (
                <tr key={`c-${c.id}`}>
                  <td className="whitespace-nowrap pl-3 pr-3 text-xs text-muted-foreground">↳ {c.name}</td>
                  {years.map((y, i) => { const own = o?.clientVolumes?.[c.id]?.[y]; const planV = scenarioClientVolume(p, c.id, null, y); const effV = scenarioClientVolume(p, c.id, sc, y);
                    return (
                    <td key={y} className="px-1 py-0.5">
                      <div className="flex items-center">
                        <Input disabled={o?.volumes?.[y]?.B2B !== undefined} className={`h-7 w-20 text-right text-xs ${own !== undefined ? 'border-primary' : ''}`} placeholder={String(effV)} value={own ?? ''}
                          onChange={e => onChange(setClientVolume(sc, p.id, c.id, [y], parse(e.target.value)))} aria-label={`Volume ${c.name} ${y}`} />
                        {i < years.length - 1 && own !== undefined && <button title="Recopier sur les années suivantes" className="ml-0.5 text-muted-foreground hover:text-primary" onClick={() => onChange(setClientVolume(sc, p.id, c.id, years.slice(i + 1), own))}><ArrowRight className="h-3 w-3" /></button>}
                      </div>
                      {effV !== planV && <div className="text-right text-[10px] text-muted-foreground">plan {planV}</div>}
                    </td>); })}
                </tr>
              ))}
              <tr><td colSpan={years.length + 1} className="pt-3" /></tr>
              <tr className="text-xs">
                <td className="pr-3 font-medium">CA HT vs plan</td>
                {years.map(y => { const a = productLines([p], sc, [y])[0], b = productLines([p], null, [y])[0]; return <td key={y} className="px-1 text-right"><div className="font-mono">{formatCurrency(a.revenue)}</div><Delta a={a.revenue} b={b.revenue} /></td>; })}
              </tr>
              <tr className="text-xs">
                <td className="pr-3 font-medium">Marge brute vs plan</td>
                {years.map(y => { const a = productLines([p], sc, [y])[0], b = productLines([p], null, [y])[0]; return <td key={y} className="px-1 text-right"><div className="font-mono">{formatCurrency(a.revenue - a.cogs)}</div><Delta a={a.revenue - a.cogs} b={b.revenue - b.cogs} /></td>; })}
              </tr>
              <tr className="text-xs text-muted-foreground">
                <td className="pr-3">Marge unitaire {chName('B2C')}</td>
                {years.map(y => { const pr = eff('B2C', y), c = eff('cost', y); return <td key={y} className="px-1 text-right">{pr ? `${(((pr - c) / pr) * 100).toFixed(0)} %` : '—'}</td>; })}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Écart scénario vs plan, en valeur et en %. */
function Delta({ a, b, unit }: { a: number; b: number; unit?: boolean }) {
  const d = a - b;
  if (Math.abs(d) < 0.5) return <span className="text-[10px] text-muted-foreground">= plan</span>;
  const pct = b ? ` (${d > 0 ? '+' : ''}${((d / Math.abs(b)) * 100).toFixed(1)} %)` : '';
  return <span className={`text-[10px] ${d > 0 ? 'text-primary' : 'text-destructive'}`}>{d > 0 ? '+' : '−'}{unit ? Math.round(Math.abs(d)).toLocaleString('fr-FR') : formatCurrency(Math.abs(d))}{pct}</span>;
}

/** Où en est le scénario par rapport au plan initial (total des années et par année). */
function VsPlan({ plan, sc, years }: { plan: YearResult[]; sc: YearResult[]; years: number[] }) {
  const sum = (r: YearResult[], k: 'revenue' | 'margin' | 'units' | 'cogs') => r.reduce((s, x) => s + x[k], 0);
  const kpis: [string, 'revenue' | 'margin' | 'units' | 'cogs'][] = [['CA HT', 'revenue'], ['Coût de revient', 'cogs'], ['Marge après transport', 'margin'], ['Unités', 'units']];
  return (
    <div className="sticky top-0 z-10 mb-4 rounded-lg border bg-card p-3 shadow-sm">
      <p className="mb-2 text-xs font-medium text-muted-foreground">Scénario vs plan initial — total {years[0]}–{years[years.length - 1]}</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map(([l, k]) => { const a = sum(sc, k), b = sum(plan, k); return (
          <div key={k}><div className="text-xs text-muted-foreground">{l}</div>
            <div className="font-mono text-sm font-semibold">{k === 'units' ? Math.round(a).toLocaleString('fr-FR') : formatCurrency(a)}</div>
            <Delta a={a} b={b} unit={k === 'units'} />
            <div className="text-[10px] text-muted-foreground">plan {k === 'units' ? Math.round(b).toLocaleString('fr-FR') : formatCurrency(b)}</div></div>); })}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {years.map(y => { const a = sc.find(r => r.year === y)!, b = plan.find(r => r.year === y)!; return <span key={y}><b>{y}</b> marge <Delta a={a.margin} b={b.margin} /></span>; })}
      </div>
    </div>
  );
}
