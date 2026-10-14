import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { SalesBreakdown } from '@/components/sales/SalesBreakdown';

type Row = { key: string; label?: string; channel?: string; ca_ht: number; qty: number; default_share?: number; prod_ht?: number; cogs?: number; cov_ht?: number; est_ht?: number; unit_cost?: number | null };
type Stats = {
  totals: { ca_ht: number; qty: number; shipping_ht: number; docs: number; prod_ht: number; cogs: number; cov_ht: number; est_ht: number };
  shipping: { billed_ht: number; docs: number; est_cost: number | null; real_cost: number | null };
  costs: { methods: number; valued: number; oldest: string | null; newest: string | null; by_method: Record<string, number>; sources: string[] };
  missing_cost: { key: string; label: string; ht: number; reason: string }[];
  by_month: { month: string; channel: string; ca_ht: number; qty: number; prod_ht: number; cogs: number; cov_ht: number; est_ht: number }[];
  by_channel: Row[]; by_customer: Row[]; by_product: Row[]; by_commercial_country: Row[]; by_delivery_country: Row[];
  reconciliation: { docs_ht: number; lines_ht: number; invoices: number; credit_notes: number; missing_total: number; no_customer: number; credit_no_qty_ht: number };
  excluded: { reason: string; doc_type: string; n: number; ht: number }[];
};
const CHANNELS = ['B2C', 'B2B', 'OEM', 'A_CLASSER'] as const;
const CH_LABEL: Record<string, string> = { B2C: 'B2C (Shopify)', B2B: 'B2B', OEM: 'OEM', A_CLASSER: 'À classer' };
const CH_COLOR: Record<string, string> = { B2C: 'hsl(var(--primary))', B2B: 'hsl(var(--chart-2, 160 60% 40%))', OEM: 'hsl(var(--chart-4, 35 90% 50%))', A_CLASSER: 'hsl(var(--muted-foreground))' };
const eur = (v: number | null | undefined) => v == null ? '—' : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
const nb = (v: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(v);
const METHOD_LABEL: Record<string, string> = { cump_finished: 'CUMP produit fini', components_plus_mfg: 'Composants + frais de fabrication', confirmed_full: 'Coût complet confirmé' };
/** Margin on lines with a validated cost only; incomplete if some product revenue has no cost, estimated if a current cost is applied to older sales. */
function margin(r: { prod_ht?: number; cogs?: number; cov_ht?: number; est_ht?: number }) {
  const prod = r.prod_ht ?? 0, cov = r.cov_ht ?? 0, cogs = r.cogs ?? 0;
  const m = cov - cogs;
  return { m: cov ? m : null, pct: cov ? m / cov : null, coverage: prod ? cov / prod : null, incomplete: Math.abs(prod - cov) > 0.5, estimated: (r.est_ht ?? 0) > 0.5 };
}
const pctf = (v: number | null) => v == null ? '—' : `${(v * 100).toFixed(1)} %`;
function MarginCell({ r }: { r: Row }) {
  const x = margin(r);
  return <>
    <TableCell className="text-right tabular-nums">{eur(r.cogs)}</TableCell>
    <TableCell className="text-right tabular-nums">{eur(x.m)}{x.estimated && <span className="text-muted-foreground"> est.</span>}</TableCell>
    <TableCell className="text-right tabular-nums">{pctf(x.pct)}</TableCell>
    <TableCell className="text-right tabular-nums">{x.coverage == null ? '—' : <span className={x.incomplete ? 'text-destructive' : ''}>{pctf(x.coverage)}{x.incomplete ? ' · incomplet' : ''}</span>}</TableCell>
  </>;
}
const iso = (d: Date) => d.toISOString().slice(0, 10);

function periodRange(p: string, from: string, to: string): [string, string] {
  const now = new Date();
  if (p === 'custom') return [from || '2000-01-01', to || iso(now)];
  if (p === 'all') return ['2000-01-01', iso(now)];
  if (p === 'ytd') return [`${now.getFullYear()}-01-01`, iso(now)];
  const d = new Date(now);
  if (p.startsWith('d')) d.setDate(d.getDate() - Number(p.slice(1))); else d.setMonth(d.getMonth() - Number(p));
  return [iso(d), iso(now)];
}

const DIMS = [['month', 'Période'], ['channel', 'Canal'], ['product', 'Produit'], ['cc', 'Pays commercial'], ['dc', 'Pays de livraison'], ['customer', 'Client']] as const;
const METRICS = [['ca', 'CA HT net', 'hsl(var(--primary))'], ['cogs', 'Coût vendu', 'hsl(var(--muted-foreground))'], ['margin', 'Marge €', 'hsl(var(--chart-2, 160 60% 40%))'], ['pct', 'Marge %', 'hsl(var(--chart-4, 35 90% 50%))'], ['qty', 'Quantités', 'hsl(var(--chart-5, 280 60% 55%))']] as const;

function Explorer({ stats }: { stats: Stats }) {
  const [dim, setDim] = useState<string>('month');
  const [mets, setMets] = useState<string[]>(['ca', 'margin', 'pct']);
  const [top, setTop] = useState(15);
  const data = useMemo(() => {
    let rows: Row[];
    if (dim === 'month') {
      const m: Record<string, Row> = {};
      for (const r of stats.by_month) { const o = m[r.month] ?? (m[r.month] = { key: r.month, ca_ht: 0, qty: 0, prod_ht: 0, cogs: 0, cov_ht: 0, est_ht: 0 }); o.ca_ht += r.ca_ht; o.qty += r.qty; o.prod_ht! += r.prod_ht; o.cogs! += r.cogs; o.cov_ht! += r.cov_ht; o.est_ht! += r.est_ht; }
      rows = Object.values(m).sort((a, b) => a.key.localeCompare(b.key));
    } else {
      const src = { channel: stats.by_channel.map((r) => ({ ...r, label: CH_LABEL[r.key] ?? r.key })), product: stats.by_product, cc: stats.by_commercial_country, dc: stats.by_delivery_country, customer: stats.by_customer }[dim] ?? [];
      rows = [...src].sort((a, b) => b.ca_ht - a.ca_ht).slice(0, top);
    }
    return rows.map((r) => { const x = margin(r); const name = (r.label || r.key || '?').trim();
      return { name: name.length > 28 ? name.slice(0, 27) + '…' : name, ca: r.ca_ht, cogs: r.cogs ?? 0, margin: x.m, pct: x.pct == null ? null : Math.round(x.pct * 1000) / 10, qty: r.qty, cov: x.coverage, est: x.estimated }; });
  }, [stats, dim, top]);
  const showEur = mets.some((m) => ['ca', 'cogs', 'margin'].includes(m));
  const vertical = dim !== 'month' && data.length > 8;
  const toggle = (m: string) => setMets((ms) => ms.includes(m) ? (ms.length > 1 ? ms.filter((x) => x !== m) : ms) : [...ms, m]);
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Explorateur</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Afficher par</span>
          {DIMS.map(([k, l]) => <Button key={k} size="sm" variant={dim === k ? 'default' : 'outline'} onClick={() => setDim(k)}>{l}</Button>)}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Indicateurs</span>
          {METRICS.map(([k, l, c]) => (
            <button key={k} type="button" onClick={() => toggle(k)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${mets.includes(k) ? 'border-primary bg-primary/10' : 'text-muted-foreground hover:bg-muted/50'}`}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />{l}</button>))}
          {dim !== 'month' && <Select value={String(top)} onValueChange={(v) => setTop(Number(v))}>
            <SelectTrigger className="h-8 w-28 ml-auto"><SelectValue /></SelectTrigger>
            <SelectContent>{[10, 15, 25, 50].map((n) => <SelectItem key={n} value={String(n)}>Top {n}</SelectItem>)}</SelectContent></Select>}
        </div>
        <div style={{ height: vertical ? Math.max(320, data.length * 30) : 340 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} layout={vertical ? 'vertical' : 'horizontal'} margin={{ left: vertical ? 10 : 0, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              {vertical ? <>
                <YAxis type="category" dataKey="name" width={180} fontSize={11} />
                <XAxis xAxisId="eur" type="number" fontSize={11} tickFormatter={(v) => mets.includes('qty') && !showEur ? nb(v) : `${Math.round(v / 1000)} k`} hide={!showEur && !mets.includes('qty')} />
                <XAxis xAxisId="pct" type="number" orientation="top" fontSize={11} unit=" %" hide={!mets.includes('pct')} />
              </> : <>
                <XAxis dataKey="name" fontSize={11} />
                <YAxis yAxisId="eur" fontSize={11} tickFormatter={(v) => showEur ? `${Math.round(v / 1000)} k` : nb(v)} />
                <YAxis yAxisId="pct" orientation="right" fontSize={11} unit=" %" hide={!mets.includes('pct')} />
              </>}
              <Tooltip formatter={(v: number, n: string) => n === 'Marge %' ? `${v} %` : n === 'Quantités' ? nb(v) : eur(v)}
                labelFormatter={(l, p) => { const d: any = p?.[0]?.payload; return d ? `${l}${d.cov != null && d.cov < 0.995 ? ` · coûts couverts ${Math.round(d.cov * 100)} % (incomplet)` : ''}${d.est ? ' · marge estimée' : ''}` : l; }} />
              <Legend />
              {METRICS.filter(([k]) => mets.includes(k)).map(([k, l, c]) => {
                const axis = k === 'pct' ? 'pct' : 'eur'; const ax = vertical ? { xAxisId: axis } : { yAxisId: axis };
                return k === 'pct' || (dim === 'month' && k === 'qty')
                  ? <Line key={k} {...ax} dataKey={k} name={l} stroke={c} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} type="monotone" />
                  : <Bar key={k} {...ax} dataKey={k} name={l} fill={c} radius={vertical ? [0, 3, 3, 0] : [3, 3, 0, 0]} />;
              })}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-muted-foreground">Marge calculée uniquement sur les ventes ayant un coût validé ; l'infobulle signale les couvertures incomplètes et les marges estimées. Quantités et euros partagent le même axe : affichez-les séparément pour mieux lire.</p>
      </CardContent>
    </Card>
  );
}

export function SalesStatsPage() {
  const { getTabPermission } = useAuth();
  const canWrite = getTabPermission('sales-stats') === 'write';
  const [period, setPeriod] = useState('12');
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [shipping, setShipping] = useState(false);
  const [channels, setChannels] = useState<string[]>([...CHANNELS]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [run, setRun] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);
  const [customers, setCustomers] = useState<Record<string, { channel: string; commercial_country: string | null }>>({});
  const [search, setSearch] = useState('');
  const [shipCost, setShipCost] = useState<string>(() => localStorage.getItem('sales-ship-cost') ?? '');
  useEffect(() => { localStorage.setItem('sales-ship-cost', shipCost); }, [shipCost]);
  const shipCostNum = shipCost.trim() === '' || !Number.isFinite(Number(shipCost.replace(',', '.'))) ? null : Number(shipCost.replace(',', '.'));
  const [range0, range1] = periodRange(period, from, to);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, r, c] = await Promise.all([
      supabase.rpc('sales_stats' as any, { _from: range0, _to: range1, _include_shipping: shipping, _channels: channels.length === CHANNELS.length ? null : channels, _ship_cost_per_doc: shipCostNum }),
      supabase.from('erplain_sales_sync_runs' as any).select('*').order('started_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('erplain_sales_customers' as any).select('customer_id,channel,commercial_country').range(0, 4999),
    ]);
    if (s.error) toast.error(`Statistiques : ${s.error.message}`); else setStats(s.data as any);
    setRun(r.data);
    setCustomers(Object.fromEntries(((c.data as any[]) ?? []).map((x) => [x.customer_id, x])));
    setLoading(false);
  }, [range0, range1, shipping, channels, shipCostNum]);
  useEffect(() => { load(); }, [load]);

  const sync = async (restart = false) => {
    setSyncing(true);
    try {
      for (let i = 0, first = true; i < 200; i++, first = false) {
        const { data, error } = await supabase.functions.invoke('erplain-sync', { body: { action: 'sales_sync', restart: restart && first } });
        if (error) throw new Error(error.message);
        if (data?.run) setRun(data.run);
        if (data?.status === 'api_error' || data?.status === 'config_error') throw new Error(data.message);
        if (data?.status !== 'partial') break;
      }
      toast.success('Lecture Erplain terminée');
    } catch (e) { toast.error(`Lecture Erplain : ${(e as Error).message}`); }
    setSyncing(false); load();
  };

  const saveCustomer = async (id: string, label: string | undefined, patch: { channel?: string; commercial_country?: string | null }) => {
    const cur = customers[id] ?? { channel: 'A_CLASSER', commercial_country: null };
    const next = { ...cur, ...patch };
    const { error } = await supabase.from('erplain_sales_customers' as any).upsert({ customer_id: id, customer_name: label ?? null, channel: next.channel, commercial_country: next.commercial_country || null });
    if (error) return toast.error(error.message);
    setCustomers((m) => ({ ...m, [id]: next })); load();
  };

  const monthly = useMemo(() => {
    const m = new Map<string, any>();
    for (const r of stats?.by_month ?? []) { const o = m.get(r.month) ?? { month: r.month }; o[r.channel] = (o[r.channel] ?? 0) + r.ca_ht; m.set(r.month, o); }
    return [...m.values()].sort((a, b) => a.month.localeCompare(b.month));
  }, [stats]);

  const rec = stats?.reconciliation;
  const recGap = rec ? Math.round((rec.docs_ht - rec.lines_ht) * 100) / 100 : 0;
  const warnings: string[] = [];
  if (!run) warnings.push('Aucune lecture Erplain effectuée : lancez « Lire les ventes Erplain ».');
  else {
    if (run.status === 'running') warnings.push('Lecture Erplain en cours ou interrompue : historique incomplet tant qu\'elle n\'est pas terminée.');
    if (run.status === 'error') warnings.push(`Dernière lecture en erreur : ${run.message ?? ''}`);
    for (const [k, t] of Object.entries<any>(run.totals ?? {})) {
      if (t.stored != null && t.expected != null && t.stored !== t.expected) warnings.push(`${k === 'invoice' ? 'Factures' : 'Avoirs'} : ${t.stored} enregistrés pour ${t.expected} annoncés par Erplain.`);
      if (t.no_lines) warnings.push(`${t.no_lines} ${k === 'invoice' ? 'facture(s)' : 'avoir(s)'} sans ligne : comptés dans les totaux documents mais pas par produit.`);
    }
  }
  if (rec?.missing_total) warnings.push(`${rec.missing_total} document(s) sans total HT, exclus.`);
  if (rec && Math.abs(recGap) > 1) warnings.push(`Écart de ${eur(recGap)} entre totaux documents Erplain et somme des lignes.`);
  const used: string[] = Object.values<any>(run?.schema ?? {}).flatMap((s) => s.used ?? []);
  if (run?.schema && !used.some((u) => /country/.test(u))) warnings.push('Aucun champ pays vérifié dans le schéma Erplain : pays non disponibles.');

  const table = (rows: Row[], kind: 'customer' | 'product' | 'country' | 'cc') => {
    const q = search.trim().toLowerCase();
    const list = rows.filter((r) => !q || `${r.key} ${r.label ?? ''}`.toLowerCase().includes(q));
    return (
      <Table>
        <TableHeader><TableRow>
          <TableHead>{kind === 'customer' ? 'Client' : kind === 'product' ? 'Produit' : 'Pays'}</TableHead>
          {kind === 'customer' && <><TableHead>Canal</TableHead><TableHead>Pays commercial</TableHead></>}
          {kind === 'cc' && <TableHead>Pays par défaut</TableHead>}
          <TableHead className="text-right">CA HT net</TableHead><TableHead className="text-right">Quantités</TableHead>
          {kind === 'product' && <TableHead className="text-right">Coût unit.</TableHead>}
          <TableHead className="text-right">Coût vendu</TableHead><TableHead className="text-right">Marge €</TableHead><TableHead className="text-right">Marge %</TableHead><TableHead className="text-right">Couverture coûts</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {list.map((r) => {
            const c = customers[r.key];
            return (
              <TableRow key={r.key}>
                <TableCell className="font-medium">{r.label || r.key}</TableCell>
                {kind === 'customer' && <>
                  <TableCell>
                    {r.channel === 'B2C' || !canWrite || r.key == null ? <Badge variant="outline">{CH_LABEL[r.channel ?? 'A_CLASSER']}</Badge> : (
                      <Select value={c?.channel ?? 'A_CLASSER'} onValueChange={(v) => saveCustomer(r.key, r.label, { channel: v })}>
                        <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>{['B2B', 'OEM', 'A_CLASSER'].map((v) => <SelectItem key={v} value={v}>{CH_LABEL[v]}</SelectItem>)}</SelectContent>
                      </Select>)}
                  </TableCell>
                  <TableCell>
                    {canWrite && r.key && r.channel !== 'B2C' ? (
                      <Input className="h-8 w-20" defaultValue={c?.commercial_country ?? ''} placeholder="auto" maxLength={3}
                        onBlur={(e) => { const v = e.target.value.trim().toUpperCase(); if (v !== (c?.commercial_country ?? '')) saveCustomer(r.key, r.label, { commercial_country: v || null }); }} />
                    ) : <span className="text-muted-foreground">{c?.commercial_country ?? 'auto'}</span>}
                  </TableCell>
                </>}
                {kind === 'cc' && <TableCell>{r.default_share != null ? `${Math.round(r.default_share * 100)} %` : '—'}</TableCell>}
                <TableCell className="text-right tabular-nums">{eur(r.ca_ht)}</TableCell>
                <TableCell className="text-right tabular-nums">{nb(r.qty)}</TableCell>
                {kind === 'product' && <TableCell className="text-right tabular-nums">{r.unit_cost == null ? <span className="text-destructive">manquant</span> : eur(r.unit_cost)}</TableCell>}
                <MarginCell r={r} />
              </TableRow>
            );
          })}
          {!list.length && <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground">Aucune donnée</TableCell></TableRow>}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Statistiques commerciales</h1>
          <p className="text-sm text-muted-foreground">Source unique : factures moins avoirs Erplain (lecture seule). Ventes Shopify classées B2C.</p>
        </div>
        {canWrite && (
          <div className="flex gap-2">
            <Button onClick={() => sync(false)} disabled={syncing}>{syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}Lire les ventes Erplain</Button>
            <Button variant="outline" onClick={() => sync(true)} disabled={syncing}>Relire tout</Button>
          </div>
        )}
      </div>

      {run && (
        <p className="text-xs text-muted-foreground">
          Dernière lecture : {new Date(run.updated_at).toLocaleString('fr-FR')} — {run.status === 'running' ? `en cours (${run.phase === 'invoices' ? 'factures' : 'avoirs'}, page ${run.page})` : run.message}
          {Object.entries<any>(run.totals ?? {}).map(([k, t]) => ` · ${k === 'invoice' ? 'Factures' : 'Avoirs'} ${t.stored ?? t.read ?? 0}/${t.expected ?? '?'}`).join('')}
        </p>
      )}

      <Card><CardContent className="pt-6 flex flex-wrap items-end gap-4">
        <div className="space-y-1"><span className="text-xs text-muted-foreground">Période</span>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="d7">7 derniers jours</SelectItem><SelectItem value="d30">30 derniers jours</SelectItem><SelectItem value="d90">90 derniers jours</SelectItem><SelectItem value="3">3 derniers mois</SelectItem><SelectItem value="12">12 derniers mois</SelectItem><SelectItem value="24">24 derniers mois</SelectItem><SelectItem value="ytd">Année en cours</SelectItem><SelectItem value="all">Tout l'historique</SelectItem><SelectItem value="custom">Personnalisée</SelectItem></SelectContent>
          </Select></div>
        {period === 'custom' && <>
          <div className="space-y-1"><span className="text-xs text-muted-foreground">Du</span><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" /></div>
          <div className="space-y-1"><span className="text-xs text-muted-foreground">Au</span><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" /></div>
        </>}
        <div className="flex gap-1">{CHANNELS.map((c) => (
          <Button key={c} size="sm" variant={channels.includes(c) ? 'default' : 'outline'}
            onClick={() => setChannels((cs) => cs.includes(c) ? (cs.length > 1 ? cs.filter((x) => x !== c) : cs) : [...cs, c])}>{CH_LABEL[c]}</Button>))}</div>
        <label className="flex items-center gap-2 text-sm"><Switch checked={shipping} onCheckedChange={setShipping} />Livraison facturée incluse</label>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </CardContent></Card>

      <div className="grid gap-4 md:grid-cols-4">
        {[['CA HT net', eur(stats?.totals.ca_ht)], ['Quantités', nb(stats?.totals.qty ?? 0)], ['Livraison facturée HT', shipping ? eur(stats?.totals.shipping_ht) : 'exclue'], ['Documents', nb(stats?.totals.docs ?? 0)]].map(([l, v]) => (
          <Card key={l}><CardContent className="pt-6"><p className="text-xs text-muted-foreground">{l}</p><p className="text-2xl font-semibold tabular-nums">{v}</p></CardContent></Card>
        ))}
      </div>

      {stats && (() => {
        const t = margin(stats.totals); const sh = stats.shipping; const co = stats.costs;
        const sumCh = (stats.by_channel ?? []).reduce((a, r) => ({ cogs: a.cogs + (r.cogs ?? 0), cov: a.cov + (r.cov_ht ?? 0) }), { cogs: 0, cov: 0 });
        const recOk = Math.abs(sumCh.cogs - stats.totals.cogs) < 1 && Math.abs(sumCh.cov - stats.totals.cov_ht) < 1;
        return (
          <Card>
            <CardHeader><CardTitle className="text-base">Marge produits (CA produits HT net − coût des produits vendus)</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid gap-4 md:grid-cols-4">
                {[['CA produits HT', eur(stats.totals.prod_ht)], ['Coût des produits vendus', eur(stats.totals.cogs)],
                  [t.estimated ? 'Marge estimée' : 'Marge', `${eur(t.m)} · ${pctf(t.pct)}`], ['Couverture des coûts', pctf(t.coverage)]].map(([l, v]) => (
                  <div key={l}><p className="text-xs text-muted-foreground">{l}</p><p className="text-xl font-semibold tabular-nums">{v}</p></div>))}
              </div>
              {t.incomplete && <p className="text-destructive">Résultat incomplet : {eur(stats.totals.prod_ht - stats.totals.cov_ht)} de CA produits sans coût validé. La marge porte uniquement sur les {eur(stats.totals.cov_ht)} couverts.</p>}
              {t.estimated && <p className="text-muted-foreground">Marge estimée : {eur(stats.totals.est_ht)} de ventes antérieures à la date de lecture de leur coût — le coût actuel est appliqué à d'anciennes ventes.</p>}
              <p className="text-xs text-muted-foreground">Coûts : {co.valued} variante(s) avec coût validé dans Production et BE ({Object.entries(co.by_method).map(([k, n]) => `${METHOD_LABEL[k] ?? k} ${n}`).join(', ') || 'aucune méthode'}) · lus dans Erplain du {co.oldest ? new Date(co.oldest).toLocaleDateString('fr-FR') : '—'} au {co.newest ? new Date(co.newest).toLocaleDateString('fr-FR') : '—'}{co.sources.length ? ` · sources : ${co.sources.slice(0, 5).join(' ; ')}` : ''}. Lien par identifiant de variante Erplain uniquement.</p>
              <p className="text-xs text-muted-foreground">Retours : un avoir avec quantité retire le CA et réintègre le coût (quantité négative × même coût). {stats.reconciliation.credit_no_qty_ht ? `${eur(stats.reconciliation.credit_no_qty_ht)} d'avoirs sans quantité réduisent le CA sans réintégrer de coût.` : ''}</p>
              <p className={`text-xs ${recOk ? 'text-muted-foreground' : 'text-destructive'}`}>Rapprochement : somme par canal coût {eur(sumCh.cogs)} / CA couvert {eur(sumCh.cov)} {recOk ? '= totaux' : '≠ totaux — à vérifier'}.</p>
              <div className="border-t pt-3 space-y-1">
                <p className="font-medium">Transport (hors marge produits)</p>
                <div className="flex flex-wrap items-center gap-3">
                  <span>Livraison facturée HT : {eur(sh.billed_ht)} ({sh.docs} document(s))</span>
                  <span>Coût d'expédition réel : <span className="text-muted-foreground">non disponible dans Erplain</span></span>
                  <label className="flex items-center gap-2">Coût estimé / facture expédiée <Input className="h-8 w-24" value={shipCost} onChange={(e) => setShipCost(e.target.value)} placeholder="€" /></label>
                </div>
                {sh.est_cost != null && <p>Marge transport estimée : {eur(sh.billed_ht)} − {eur(sh.est_cost)} = {eur(sh.billed_ht - sh.est_cost)} <Badge variant="outline">estimé</Badge></p>}
              </div>
              {stats.missing_cost.length > 0 && <details className="text-xs"><summary className="cursor-pointer">Produits sans coût ({stats.missing_cost.length})</summary>
                <ul className="mt-1 space-y-0.5">{stats.missing_cost.map((m) => <li key={m.key + m.reason}>{m.label.trim() || m.key} — {eur(m.ht)} — {m.reason}</li>)}</ul></details>}
            </CardContent>
          </Card>);
      })()}

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2">{warnings.length ? <AlertTriangle className="h-4 w-4 text-destructive" /> : <CheckCircle2 className="h-4 w-4 text-primary" />}Rapprochement avec Erplain</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {rec && <p>Période : {rec.invoices} facture(s), {rec.credit_notes} avoir(s) comptés. Totaux HT documents {eur(rec.docs_ht)} · somme des lignes {eur(rec.lines_ht)} (livraison incluse) · écart {eur(recGap)}.</p>}
          {(stats?.excluded ?? []).map((e) => <p key={e.reason + e.doc_type} className="text-muted-foreground">Exclus : {e.n} {e.doc_type === 'invoice' ? 'facture(s)' : 'avoir(s)'} — {e.reason} ({eur(e.ht)})</p>)}
          {warnings.map((w) => <p key={w} className="text-destructive">{w}</p>)}
          <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Règles de comptage</summary>
            <ul className="list-disc ml-5 mt-1 space-y-1">
              <li>Une vente = une ligne de facture, à la date de la facture. Les commandes ne sont pas lues : pas de double comptage commande + facture.</li>
              <li>Les avoirs sont déduits à leur propre date (montants et quantités négatifs).</li>
              <li>Brouillons et documents annulés : enregistrés mais exclus.</li>
              <li>CA HT net = total HT du document Erplain ; les remises sont réparties au prorata des lignes.</li>
              <li>B2C = document ou commande portant une source/intégration Shopify. Autres clients : votre classement (B2B, OEM, À classer).</li>
              <li>Pays commercial = votre choix, sinon pays de facturation (« auto ») ; pays de livraison = adresse de livraison du document.</li>
              {used.length > 0 && <li>Champs Erplain vérifiés : {[...new Set(used)].join(', ')}</li>}
            </ul></details>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">CA HT net par mois et canal</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly}><CartesianGrid strokeDasharray="3 3" className="stroke-muted" /><XAxis dataKey="month" fontSize={11} /><YAxis fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)} k`} />
              <Tooltip formatter={(v: number) => eur(v)} /><Legend />
              {CHANNELS.filter((c) => channels.includes(c)).map((c) => <Bar key={c} dataKey={c} name={CH_LABEL[c]} stackId="a" fill={CH_COLOR[c]} />)}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {stats && <Explorer stats={stats} />}

      <Tabs defaultValue="customers">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="months">Périodes</TabsTrigger><TabsTrigger value="customers">Clients</TabsTrigger><TabsTrigger value="products">Produits</TabsTrigger>
            <TabsTrigger value="cc">Pays commercial</TabsTrigger><TabsTrigger value="dc">Pays de livraison</TabsTrigger><TabsTrigger value="channels">Canaux</TabsTrigger><TabsTrigger value="breakdown">Canal › pays › produit</TabsTrigger>
          </TabsList>
          <Input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-56" />
        </div>
        <Card className="mt-2"><CardContent className="pt-4">
          <TabsContent value="months">{table(Object.values((stats?.by_month ?? []).reduce((m: Record<string, Row>, r) => {
            const o = m[r.month] ?? (m[r.month] = { key: r.month, ca_ht: 0, qty: 0, prod_ht: 0, cogs: 0, cov_ht: 0, est_ht: 0 });
            o.ca_ht += r.ca_ht; o.qty += r.qty; o.prod_ht! += r.prod_ht; o.cogs! += r.cogs; o.cov_ht! += r.cov_ht; o.est_ht! += r.est_ht; return m; }, {})).sort((a, b) => b.key.localeCompare(a.key)), 'country')}</TabsContent>
          <TabsContent value="customers">{table(stats?.by_customer ?? [], 'customer')}</TabsContent>
          <TabsContent value="products">{table(stats?.by_product ?? [], 'product')}</TabsContent>
          <TabsContent value="cc">{table(stats?.by_commercial_country ?? [], 'cc')}</TabsContent>
          <TabsContent value="dc">{table(stats?.by_delivery_country ?? [], 'country')}</TabsContent>
          <TabsContent value="channels">{table((stats?.by_channel ?? []).map((r) => ({ ...r, label: CH_LABEL[r.key] ?? r.key })), 'country')}</TabsContent>
          <TabsContent value="breakdown"><SalesBreakdown from={range0} to={range1} search={search} /></TabsContent>
        </CardContent></Card>
      </Tabs>
    </div>
  );
}
