import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, ArrowRight, Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { copyTable, num } from '@/lib/clipboard';
import { buildPivot, byCategory, CHANNELS, CH_LABEL, type PivotMetric, type PivotRow, type Row } from './salesStatsModel';

export type CustomDim = 'category' | 'customer' | 'product';
const DIM_LABEL: Record<CustomDim, string> = { category: 'Catégorie produit', customer: 'Client', product: 'Produit' };
const MET_LABEL: Record<PivotMetric, string> = { ca: 'CA HT net (€)', qty: 'Quantités', margin: 'Marge (€)', pct: 'Marge (%)' };
const fmt = (v: number | null, m: PivotMetric) => v == null ? '—' : m === 'pct' ? `${v.toFixed(1)} %` : m === 'qty' ? new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(v) : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

export type CustomPivot = { title: string; headers: string[]; rows: PivotRow[]; unit: string };

/** Pivot by category / customer / product with channels as columns in the user's order — one server read per channel, same RPC as the page. */
export function CustomStats({ from, to, shipping, catIdx, onChange }: { from: string; to: string; shipping: boolean; catIdx: Record<string, string>; onChange: (p: CustomPivot | null) => void }) {
  const [dim, setDim] = useState<CustomDim>(() => (localStorage.getItem('sales-custom-dim') as CustomDim) || 'category');
  const [metric, setMetric] = useState<PivotMetric>('ca');
  const [order, setOrder] = useState<string[]>(() => { try { const o = JSON.parse(localStorage.getItem('sales-custom-order') ?? ''); return Array.isArray(o) && o.length ? o : [...CHANNELS]; } catch { return [...CHANNELS]; } });
  const [sort, setSort] = useState('total');
  const [data, setData] = useState<Record<string, { by_product: Row[]; by_customer: Row[] }>>({});
  const [loading, setLoading] = useState(false);
  useEffect(() => { localStorage.setItem('sales-custom-dim', dim); localStorage.setItem('sales-custom-order', JSON.stringify(order)); }, [dim, order]);

  useEffect(() => {
    let live = true; setLoading(true);
    Promise.all(CHANNELS.map((c) => supabase.rpc('sales_stats' as any, { _from: from, _to: to, _include_shipping: shipping, _channels: [c], _ship_cost_per_doc: null })))
      .then((res) => {
        if (!live) return;
        const err = res.find((r) => r.error); if (err) toast.error(`Statistiques personnalisées : ${err.error!.message}`);
        setData(Object.fromEntries(CHANNELS.map((c, i) => [c, { by_product: (res[i].data as any)?.by_product ?? [], by_customer: (res[i].data as any)?.by_customer ?? [] }])));
        setLoading(false);
      });
    return () => { live = false; };
  }, [from, to, shipping]);

  const perChannel = useMemo(() => Object.fromEntries(order.map((c) => {
    const d = data[c]; if (!d) return [c, []];
    return [c, dim === 'customer' ? d.by_customer : dim === 'product' ? d.by_product : byCategory(d.by_product, catIdx)];
  })), [data, order, dim, catIdx]);
  const rows = useMemo(() => buildPivot(perChannel, order, metric, order.includes(sort) || sort === 'name' ? sort : 'total'), [perChannel, order, metric, sort]);
  const headers = [DIM_LABEL[dim], ...order.map((c) => CH_LABEL[c] ?? c), order.length > 1 ? 'Total' : 'Total'];
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
