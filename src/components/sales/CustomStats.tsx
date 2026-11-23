import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, ArrowRight, Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { copyTable, num } from '@/lib/clipboard';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { crossPivot, CHANNELS, CH_LABEL, NO_CATEGORY, type CrossLine, type PivotMetric, type PivotRow } from './salesStatsModel';

export type CustomDim = 'category' | 'customer' | 'product';
const DIM_LABEL: Record<CustomDim, string> = { category: 'Catégorie produit', customer: 'Client', product: 'Produit' };
const MET_LABEL: Record<PivotMetric, string> = { ca: 'CA HT net (€)', qty: 'Quantités', margin: 'Marge (€)', pct: 'Marge (%)' };
const fmt = (v: number | null, m: PivotMetric) => v == null ? '—' : m === 'pct' ? `${v.toFixed(1)} %` : m === 'qty' ? new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(v) : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

export type CustomPivot = { title: string; headers: string[]; rows: PivotRow[]; unit: string };

/** Pivot by category / customer / product with channels as columns in the user's order — one server read per channel, same RPC as the page. */
export function CustomStats({ from, to, catIdx, onChange }: { from: string; to: string; shipping?: boolean; catIdx: Record<string, string>; onChange: (p: CustomPivot | null) => void }) {
  const [dim, setDim] = useState<CustomDim>(() => (localStorage.getItem('sales-custom-dim') as CustomDim) || 'category');
  const [metric, setMetric] = useState<PivotMetric>('ca');
  const [order, setOrder] = useState<string[]>(() => { try { const o = JSON.parse(localStorage.getItem('sales-custom-order') ?? ''); return Array.isArray(o) && o.length ? o : [...CHANNELS]; } catch { return [...CHANNELS]; } });
  const [sort, setSort] = useState('total');
  const [lines, setLines] = useState<CrossLine[]>([]);
  const [sub, setSub] = useState<CustomDim | 'none'>('none');
  const [custF, setCustF] = useState<string[]>([]);
  const [catF, setCatF] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => { localStorage.setItem('sales-custom-dim', dim); localStorage.setItem('sales-custom-order', JSON.stringify(order)); }, [dim, order]);

  useEffect(() => {
    let live = true; setLoading(true);
    supabase.rpc('sales_customer_product' as any, { _from: from, _to: to }).then(({ data, error }) => {
      if (!live) return;
      if (error) toast.error(`Statistiques personnalisées : ${error.message}`);
      setLines(((data as any[]) ?? []).map((l) => ({ ...l, ca_ht: Number(l.ca_ht) || 0, qty: Number(l.qty) || 0 })));
      setLoading(false);
    });
    return () => { live = false; };
  }, [from, to]);

  const allCustomers = useMemo(() => { const m = new Map<string, { label: string; ca: number }>(); for (const l of lines) { const o = m.get(l.customer) ?? { label: (l.customer_label || l.customer).trim(), ca: 0 }; o.ca += l.ca_ht; m.set(l.customer, o); } return [...m].sort((a, b) => b[1].ca - a[1].ca); }, [lines]);
  const allCats = useMemo(() => [...new Set(lines.map((l) => catIdx[l.key] ?? NO_CATEGORY))].sort((a, b) => a.localeCompare(b, 'fr')), [lines, catIdx]);
  const shownCustomers = useMemo(() => { const k = q.trim().toLowerCase(); return allCustomers.filter(([, v]) => !k || v.label.toLowerCase().includes(k)).slice(0, 60); }, [allCustomers, q]);
  const subDim = sub === 'none' || sub === dim ? null : sub;
  const rows = useMemo(() => crossPivot(lines, dim, subDim, catIdx, order, metric, order.includes(sort) || sort === 'name' ? sort : 'total', { customers: custF, categories: catF }), [lines, dim, subDim, catIdx, order, metric, sort, custF, catF]);
  const headers = [subDim ? `${DIM_LABEL[dim]} › ${DIM_LABEL[subDim]}` : DIM_LABEL[dim], ...order.map((c) => CH_LABEL[c] ?? c), 'Total'];
  const colTotals = metric === 'pct' ? null : [...order.map((_, i) => rows.reduce((s, r) => s + (r.cells[i] ?? 0), 0)), rows.reduce((s, r) => s + (r.total ?? 0), 0)];
  const unit = metric === 'qty' ? 'u' : metric === 'pct' ? '%' : '€';
  const sig = JSON.stringify([headers, rows]);
  useEffect(() => { onChange(order.length ? { title: `${DIM_LABEL[dim]} × canal — ${MET_LABEL[metric]}`, headers, rows, unit } : null); }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (c: string) => setOrder((o) => o.includes(c) ? o.filter((x) => x !== c) : [...o, c]);
  const move = (i: number, d: number) => setOrder((o) => { const n = [...o]; const j = i + d; if (j < 0 || j >= n.length) return o; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const copy = async () => {
    const body = rows.map((r) => [r.label, ...r.cells.map((v) => num(v, metric === 'qty' ? 1 : 2)), num(r.total, 2)]);
    const ok = await copyTable(headers, body);
    ok ? toast.success(`${body.length} ligne(s) copiée(s) — collez dans Excel avec Ctrl+V`) : toast.error('Copie refusée par le navigateur.');
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-[auto_1fr]">
        <span className="text-xs font-medium text-muted-foreground pt-2">Lignes</span>
        <div className="flex flex-wrap gap-1">{(Object.keys(DIM_LABEL) as CustomDim[]).map((d) => <Button key={d} size="sm" variant={dim === d ? 'default' : 'outline'} onClick={() => setDim(d)}>{DIM_LABEL[d]}</Button>)}</div>
        <span className="text-xs font-medium text-muted-foreground pt-2">Détailler par</span>
        <div className="flex flex-wrap gap-1">{(['none', ...(Object.keys(DIM_LABEL) as CustomDim[]).filter((d) => d !== dim)] as const).map((d) => <Button key={d} size="sm" variant={(subDim ?? 'none') === d ? 'default' : 'outline'} onClick={() => setSub(d)}>{d === 'none' ? 'Aucun' : DIM_LABEL[d]}</Button>)}</div>
        <span className="text-xs font-medium text-muted-foreground pt-2">Filtrer</span>
        <div className="flex flex-wrap items-center gap-2">
          <Popover><PopoverTrigger asChild><Button size="sm" variant={custF.length ? 'default' : 'outline'}>Clients : {custF.length ? `${custF.length} choisi(s)` : 'tous'}</Button></PopoverTrigger>
            <PopoverContent className="w-80 p-2" align="start">
              <Input autoFocus placeholder="Rechercher un client…" value={q} onChange={(e) => setQ(e.target.value)} className="h-8 mb-2" />
              <div className="max-h-72 overflow-auto space-y-0.5">{shownCustomers.map(([id, v]) => (
                <label key={id} className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted/50 cursor-pointer">
                  <Checkbox checked={custF.includes(id)} onCheckedChange={() => setCustF((f) => f.includes(id) ? f.filter((x) => x !== id) : [...f, id])} />
                  <span className="truncate">{v.label}</span></label>))}
                {!shownCustomers.length && <p className="text-xs text-muted-foreground p-1">Aucun client</p>}</div>
              {custF.length > 0 && <Button size="sm" variant="ghost" className="mt-1 w-full" onClick={() => setCustF([])}>Tous les clients</Button>}
            </PopoverContent></Popover>
          <Popover><PopoverTrigger asChild><Button size="sm" variant={catF.length ? 'default' : 'outline'}>Catégories : {catF.length ? `${catF.length} choisie(s)` : 'toutes'}</Button></PopoverTrigger>
            <PopoverContent className="w-72 p-2" align="start"><div className="max-h-72 overflow-auto space-y-0.5">{allCats.map((c) => (
              <label key={c} className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted/50 cursor-pointer">
                <Checkbox checked={catF.includes(c)} onCheckedChange={() => setCatF((f) => f.includes(c) ? f.filter((x) => x !== c) : [...f, c])} /><span className="truncate">{c}</span></label>))}</div>
              {catF.length > 0 && <Button size="sm" variant="ghost" className="mt-1 w-full" onClick={() => setCatF([])}>Toutes les catégories</Button>}
            </PopoverContent></Popover>
        </div>
        <span className="text-xs font-medium text-muted-foreground pt-2">Colonnes (ordre)</span>
        <div className="flex flex-wrap items-center gap-2">
          {order.map((c, i) => (
            <span key={c} className="flex items-center gap-0.5 rounded-md border border-primary bg-primary/10 px-1 py-0.5 text-sm">
              <button type="button" aria-label="Avancer" className="p-1 disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)}><ArrowLeft className="h-3 w-3" /></button>
              <button type="button" onClick={() => toggle(c)} title="Retirer">{i + 1}. {CH_LABEL[c] ?? c}</button>
              <button type="button" aria-label="Reculer" className="p-1 disabled:opacity-30" disabled={i === order.length - 1} onClick={() => move(i, 1)}><ArrowRight className="h-3 w-3" /></button>
            </span>))}
          {CHANNELS.filter((c) => !order.includes(c)).map((c) => <Button key={c} size="sm" variant="outline" onClick={() => toggle(c)}>+ {CH_LABEL[c]}</Button>)}
        </div>
        <span className="text-xs font-medium text-muted-foreground pt-2">Valeur / tri</span>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={metric} onValueChange={(v) => setMetric(v as PivotMetric)}><SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
            <SelectContent>{(Object.keys(MET_LABEL) as PivotMetric[]).map((m) => <SelectItem key={m} value={m}>{MET_LABEL[m]}</SelectItem>)}</SelectContent></Select>
          <Select value={order.includes(sort) || sort === 'name' ? sort : 'total'} onValueChange={setSort}><SelectTrigger className="h-8 w-48"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="total">Trier par total</SelectItem><SelectItem value="name">Trier par nom</SelectItem>{order.map((c) => <SelectItem key={c} value={c}>Trier par {CH_LABEL[c]}</SelectItem>)}</SelectContent></Select>
          <Button size="sm" variant="outline" onClick={copy} disabled={!rows.length}><Copy className="h-4 w-4 mr-2" />Copier pour Excel</Button>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </div>
      {!order.length ? <p className="text-sm text-muted-foreground">Ajoutez au moins un canal.</p> : (
        <div className="max-h-[520px] overflow-auto rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur"><TableRow>{headers.map((h, i) => <TableHead key={h + i} className={i ? 'text-right' : ''}>{h}</TableHead>)}</TableRow></TableHeader>
            <TableBody>
              {rows.map((r) => <TableRow key={r.key}><TableCell className="font-medium">{r.label}</TableCell>{r.cells.map((v, i) => <TableCell key={i} className="text-right tabular-nums">{fmt(v, metric)}</TableCell>)}<TableCell className="text-right tabular-nums font-semibold">{fmt(r.total, metric)}</TableCell></TableRow>)}
              {colTotals && rows.length > 0 && <TableRow className="bg-muted/40 font-semibold"><TableCell>Total</TableCell>{colTotals.map((v, i) => <TableCell key={i} className="text-right tabular-nums">{fmt(v, metric)}</TableCell>)}</TableRow>}
              {!rows.length && <TableRow><TableCell colSpan={headers.length} className="text-center text-muted-foreground">{loading ? 'Chargement…' : 'Aucune vente sur la période'}</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>)}
      <p className="text-xs text-muted-foreground">Catégories = celles du Plan produit (produits regroupés comptés une seule fois) ; produits non classés dans « Sans catégorie ». Marge calculée seulement sur les ventes dont le coût est validé.</p>
    </div>
  );
}
