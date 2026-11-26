import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Copy, FileDown, Loader2, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { copyTable } from '@/lib/clipboard';
import { aggregateBacklog, buildGrid, fmtAmount, MONTHS, SEG_LABEL, SEGMENTS, yearShare, type RafRow, type Unit } from './rafReportModel';
import { buildRafPdf } from './rafPdf';

const COLORS = ['hsl(var(--muted-foreground))', 'hsl(var(--chart-2, 160 60% 40%))', 'hsl(var(--primary))', 'hsl(var(--chart-4, 35 90% 50%))'];
type Mode = 'invoiced' | 'with_orders';
type View = { years: number[]; budget: boolean; gap: boolean; evol: boolean; total: boolean; unit: Unit; legend: 'bottom' | 'top' | 'right' | 'none'; chart: boolean; table: boolean; names: Record<string, string> };
const VIEW_KEY = 'raf-report-view';

export function RafReport({ refreshKey, syncedAt }: { refreshKey: number; syncedAt?: string | null }) {
  const { getTabPermission } = useAuth();
  const canWrite = getTabPermission('sales-stats') === 'write';
  const cy = new Date().getFullYear();
  const allYears = useMemo(() => [cy - 2, cy - 1, cy], [cy]);
  const [rows, setRows] = useState<RafRow[]>([]);
  const [backlog, setBacklog] = useState<{ year: number; month: number; segment: string; unbilled_ht: number; read_at: string }[]>([]);
  const [lastDoc, setLastDoc] = useState<string | null>(null);
  const [budget, setBudget] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(false);
  const [readingOrders, setReadingOrders] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>(() => (localStorage.getItem('raf-report-mode') as Mode) || 'invoiced');
  const [view, setView] = useState<View>(() => {
    const d: View = { years: allYears, budget: true, gap: true, evol: true, total: true, unit: 'eur', legend: 'bottom', chart: true, table: true, names: {} };
    try { return { ...d, ...JSON.parse(localStorage.getItem(VIEW_KEY) ?? '{}') }; } catch { return d; }
  });
  useEffect(() => { localStorage.setItem(VIEW_KEY, JSON.stringify(view)); }, [view]);
  useEffect(() => { localStorage.setItem('raf-report-mode', mode); }, [mode]);
  const years = allYears.filter((y) => view.years.includes(y));
  const nm = (k: string) => view.names[k] || (k === 'Budget' ? 'Budget' : k);
  const fmt = (v: number | null | undefined) => fmtAmount(v, view.unit);

  const load = useCallback(async () => {
    setLoading(true);
    const [r, b, bl] = await Promise.all([
      supabase.rpc('sales_raf_report' as any, { _years: allYears, _include_shipping: false }),
      supabase.from('sales_budgets' as any).select('month,amount').eq('year', cy),
      supabase.from('sales_order_backlog' as any).select('year,month,segment,unbilled_ht,read_at'),
    ]);
    setLoading(false);
    if (r.error) { toast.error(`Rapport : ${r.error.message}`); return; }
    const d = r.data as any;
    setRows(d?.rows ?? []); setLastDoc(d?.last_doc ?? null);
    setBudget(Object.fromEntries(((b.data as any[]) ?? []).map((x) => [x.month, Number(x.amount)])));
    setBacklog(((bl.data as any[]) ?? []).map((x) => ({ ...x, unbilled_ht: Number(x.unbilled_ht) })));
  }, [allYears, cy]);
  useEffect(() => { load(); }, [load, refreshKey]);

  const backlogReadAt = backlog.reduce<string | null>((m, x) => (!m || x.read_at > m ? x.read_at : m), null);
  const allRows = useMemo(() => mode === 'with_orders' ? [...rows, ...backlog.map((x) => ({ year: x.year, month: x.month, segment: x.segment, ca_ht: x.unbilled_ht }))] : rows, [rows, backlog, mode]);
  const asOfDate = useMemo(() => { const dates = [lastDoc, mode === 'with_orders' ? backlogReadAt : null].filter(Boolean) as string[]; return dates.sort().pop() ?? null; }, [lastDoc, backlogReadAt, mode]);
  const g = useMemo(() => buildGrid(allRows, allYears, asOfDate), [allRows, allYears, asOfDate]);
  const sum = (y: number, seg: string) => MONTHS.reduce((s, _, i) => s + (g[y]?.[i + 1]?.[seg] ?? 0), 0);
  const modeLabel = mode === 'invoiced' ? 'CA HT facturé (factures − avoirs)' : 'CA HT facturé + commandes actives restant à facturer';

  const readOrders = async () => {
    setReadingOrders(0);
    try {
      const custs: any[] = [];
      for (let p = 0; p < 50; p++) { const { data, error } = await supabase.from('erplain_sales_customers' as any).select('customer_id,channel,commercial_country').order('customer_id').range(p * 1000, p * 1000 + 999); if (error) throw error; custs.push(...(data ?? [])); if ((data ?? []).length < 1000) break; }
      const countries = Object.fromEntries(custs.map((c) => [String(c.customer_id), c.commercial_country]));
      const channels = Object.fromEntries(custs.map((c) => [String(c.customer_id), c.channel]));
      const orders = new Map<string, any>(); let cursor: any;
      for (let i = 0; i < 1000; i++) {
        const { data, error } = await supabase.functions.invoke('erplain-sync', { body: { action: 'pipe_orders', from: `${allYears[0]}-01-01`, to: `${cy}-12-31`, cursor } });
        if (error) throw new Error(error.message);
        if (data?.status !== 'success' && data?.status !== 'partial') throw new Error(data?.message ?? 'Lecture Erplain impossible');
        for (const o of data.orders ?? []) orders.set(String(o.id), o);
        setReadingOrders(orders.size);
        if (data.message) throw new Error(data.message);
        if (data.status === 'success') break;
        if (!data.next || (cursor && data.next.page <= cursor.page)) throw new Error('Lecture interrompue, réessayez.');
        cursor = data.next;
        if (i === 999) throw new Error('Lecture incomplète');
      }
      // Lecture complète seulement : on remplace la photo précédente.
      const agg = aggregateBacklog([...orders.values()], countries, channels);
      const read_at = new Date().toISOString();
      const del = await supabase.from('sales_order_backlog' as any).delete().gte('year', 0);
      if (del.error) throw del.error;
      if (agg.length) { const ins = await supabase.from('sales_order_backlog' as any).insert(agg.map((a) => ({ ...a, read_at }))); if (ins.error) throw ins.error; }
      toast.success(`${orders.size} commandes lues, reste à facturer enregistré`);
      await load();
    } catch (e) { toast.error(`Commandes : ${(e as Error).message} — la photo précédente est conservée.`); }
    finally { setReadingOrders(null); }
  };

  const saveBudget = async (month: number, raw: string) => {
    if (!raw.trim()) { await supabase.from('sales_budgets' as any).delete().eq('year', cy).eq('month', month); setBudget((b) => { const n = { ...b }; delete n[month]; return n; }); return; }
    const amount = Number(raw.replace(/\s/g, '').replace(',', '.'));
    if (!Number.isFinite(amount)) return toast.error('Montant invalide');
    const { error } = await supabase.from('sales_budgets' as any).upsert({ year: cy, month, amount });
    if (error) return toast.error(`Budget non enregistré : ${error.message}`);
    setBudget((b) => ({ ...b, [month]: amount }));
  };

  const prevY = years.length > 1 ? years[years.length - 2] : null; const lastY = years[years.length - 1];
  const evol = (seg: string, i: number) => { if (!prevY || lastY == null) return null; const c = g[lastY]?.[i + 1]?.[seg]; const p = g[prevY]?.[i + 1]?.[seg]; return c != null && p ? ((c - p) / p) * 100 : null; };

  const copy = (seg: string, withBudget: boolean) => {
    const head = ['Mois', ...years.map((y) => nm(String(y))), ...(withBudget && view.budget ? [nm('Budget')] : []), ...(withBudget && view.gap ? ['Écart'] : []), ...(view.evol && prevY ? ['Évol. %'] : [])];
    const body = MONTHS.map((m, i) => { const cur = g[cy]?.[i + 1]?.[seg]; const b = budget[i + 1]; const e = evol(seg, i);
      return [m, ...years.map((y) => g[y]?.[i + 1]?.[seg] ?? ''), ...(withBudget && view.budget ? [b ?? ''] : []), ...(withBudget && view.gap ? [cur != null && b != null ? cur - b : ''] : []), ...(view.evol && prevY ? [e == null ? '' : Math.round(e)] : [])]; });
    if (view.total) body.push(['Total', ...years.map((y) => sum(y, seg)), ...(withBudget && view.budget ? [Object.values(budget).reduce((a, b) => a + b, 0)] : []), ...(withBudget && view.gap ? [''] : []), ...(view.evol && prevY ? [''] : [])]);
    copyTable(head, body as any).then((ok) => ok ? toast.success('Copié — collez dans Excel') : toast.error('Copie impossible'));
  };

  const legend = view.legend === 'none' ? null : <Legend verticalAlign={view.legend === 'right' ? 'middle' : view.legend} align={view.legend === 'right' ? 'right' : 'center'} layout={view.legend === 'right' ? 'vertical' : 'horizontal'} />;
  const tick = (v: number) => fmtAmount(v, 'keur');
  const seriesData = (seg: string) => MONTHS.map((m, i) => ({ mois: m.slice(0, 4), ...Object.fromEntries(years.map((y) => [nm(String(y)), g[y]?.[i + 1]?.[seg]])), [nm('Budget')]: seg === 'ALL' ? budget[i + 1] ?? null : undefined }));

  const renderYearTable = ({ seg, withBudget }: { seg: string; withBudget?: boolean }) => {
    const showB = withBudget && view.budget, showG = withBudget && view.gap, showE = view.evol && !!prevY;
    return (
      <div className={`grid gap-4 ${view.table && view.chart ? 'lg:grid-cols-2' : ''}`}>
        {view.table && <div className="overflow-auto">
          <Table><TableHeader><TableRow><TableHead>Mois</TableHead>{years.map((y) => <TableHead key={y} className="text-right">{nm(String(y))}</TableHead>)}{showB && <TableHead className="text-right">{nm('Budget')} {cy}</TableHead>}{showG && <TableHead className="text-right">Écart</TableHead>}{showE && <TableHead className="text-right">Évol. {lastY}/{prevY}</TableHead>}</TableRow></TableHeader>
            <TableBody>{MONTHS.map((m, i) => { const cur = g[cy]?.[i + 1]?.[seg]; const bud = budget[i + 1]; const e = evol(seg, i); return (
              <TableRow key={m}><TableCell>{m}</TableCell>{years.map((y) => <TableCell key={y} className="text-right tabular-nums">{fmt(g[y]?.[i + 1]?.[seg])}</TableCell>)}
                {showB && <TableCell className="text-right">{canWrite ? <Input key={`${i}-${bud}`} className="h-7 w-28 ml-auto text-right" defaultValue={bud ?? ''} placeholder="—" onBlur={(ev) => { if (ev.target.value !== String(bud ?? '')) saveBudget(i + 1, ev.target.value); }} /> : <span className="tabular-nums">{fmt(bud)}</span>}</TableCell>}
                {showG && <TableCell className={`text-right tabular-nums ${cur != null && bud != null && cur < bud ? 'text-destructive' : ''}`}>{cur != null && bud != null ? fmt(cur - bud) : ''}</TableCell>}
                {showE && <TableCell className={`text-right tabular-nums ${e != null && e < 0 ? 'text-destructive' : ''}`}>{e == null ? '' : `${e > 0 ? '+' : ''}${e.toFixed(0)} %`}</TableCell>}
              </TableRow>); })}
              {view.total && <TableRow className="font-semibold"><TableCell>Total</TableCell>{years.map((y) => <TableCell key={y} className="text-right tabular-nums">{fmt(sum(y, seg))}</TableCell>)}{showB && <TableCell className="text-right tabular-nums">{fmt(Object.values(budget).reduce((a, b) => a + b, 0))}</TableCell>}{showG && <TableCell />}{showE && <TableCell />}</TableRow>}
            </TableBody></Table>
          <Button size="sm" variant="outline" className="mt-2" onClick={() => copy(seg, !!withBudget)}><Copy className="h-3.5 w-3.5 mr-1" />Copier pour Excel</Button>
        </div>}
        {view.chart && <div className="h-80"><ResponsiveContainer width="100%" height="100%">
          {withBudget ? (
            <BarChart data={seriesData(seg)}><CartesianGrid strokeDasharray="3 3" className="stroke-muted" /><XAxis dataKey="mois" fontSize={11} /><YAxis fontSize={11} tickFormatter={tick} /><Tooltip formatter={(v: number) => fmt(v)} />{legend}
              {years.map((y) => <Bar key={y} dataKey={nm(String(y))} fill={COLORS[allYears.indexOf(y)]} isAnimationActive={false} />)}{showB && <Bar dataKey={nm('Budget')} fill={COLORS[3]} isAnimationActive={false} />}</BarChart>
          ) : (
            <LineChart data={seriesData(seg)}><CartesianGrid strokeDasharray="3 3" className="stroke-muted" /><XAxis dataKey="mois" fontSize={11} /><YAxis fontSize={11} tickFormatter={tick} /><Tooltip formatter={(v: number) => fmt(v)} />{legend}
              {years.map((y) => <Line key={y} dataKey={nm(String(y))} stroke={COLORS[allYears.indexOf(y)]} strokeWidth={2} connectNulls={false} isAnimationActive={false} />)}</LineChart>
          )}
        </ResponsiveContainer></div>}
      </div>
    );
  };

  const renderMixYear = (y: number) => {
    const data = MONTHS.map((m, i) => ({ mois: m.slice(0, 4), ...Object.fromEntries(SEGMENTS.map((s) => [SEG_LABEL[s], g[y]?.[i + 1]?.[s]])) }));
    const share = yearShare(g, y);
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 h-72"><ResponsiveContainer width="100%" height="100%"><LineChart data={data}><CartesianGrid strokeDasharray="3 3" className="stroke-muted" /><XAxis dataKey="mois" fontSize={11} /><YAxis fontSize={11} tickFormatter={tick} /><Tooltip formatter={(v: number) => fmt(v)} />{legend}
          {SEGMENTS.map((s, i) => <Line key={s} dataKey={SEG_LABEL[s]} stroke={COLORS[i]} strokeWidth={2} isAnimationActive={false} />)}</LineChart></ResponsiveContainer></div>
        <div className="h-72"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={share.map((s) => ({ name: SEG_LABEL[s.segment], value: Math.max(0, s.value) }))} dataKey="value" nameKey="name" outerRadius={90} label={(e: any) => `${Math.round(e.percent * 100)} %`} isAnimationActive={false}>
          {share.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}</Pie><Tooltip formatter={(v: number) => fmt(v)} />{legend}</PieChart></ResponsiveContainer></div>
      </div>
    );
  };

  // PDF
  const [pdf, setPdf] = useState({ title: 'Analyse des ventes', comment: '', sections: ['ALL', ...SEGMENTS, 'mix'] as string[], tables: true, charts: true, budget: true });
  const exportPdf = () => {
    if (!pdf.sections.length) return toast.error('Choisissez au moins une section');
    if (!years.length) return toast.error('Choisissez au moins une année');
    const doc = buildRafPdf(g, budget, { ...pdf, years, unit: view.unit, modeLabel, asOf: asOfDate ? new Date(asOfDate).toLocaleDateString('fr-FR') : '—' });
    doc.save(`${pdf.title.replace(/[^\w-]+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
  };
  const SECTIONS: [string, string][] = [['ALL', 'CA global (+ budget)'], ...SEGMENTS.map((s) => [s, SEG_LABEL[s]] as [string, string]), ['mix', 'Répartition par type de client']];
  const tog = (arr: string[], v: string) => arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  return (
    <Card>
      <CardHeader className="pb-2 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">Rapport hebdo RAF — Analyse des ventes {loading && <Loader2 className="h-4 w-4 animate-spin" />}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <SelectTrigger className="h-8 w-72"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="invoiced">CA HT facturé</SelectItem><SelectItem value="with_orders">Facturé + commandes actives à facturer</SelectItem></SelectContent>
            </Select>
            {mode === 'with_orders' && canWrite && <Button size="sm" variant="outline" disabled={readingOrders != null} onClick={readOrders}>{readingOrders != null ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />{readingOrders} commandes…</> : <><RefreshCw className="h-3.5 w-3.5 mr-1" />Actualiser les commandes</>}</Button>}
            <Popover><PopoverTrigger asChild><Button size="sm" variant="outline"><SlidersHorizontal className="h-3.5 w-3.5 mr-1" />Affichage</Button></PopoverTrigger>
              <PopoverContent className="w-80 space-y-3 text-sm" align="end">
                <div><p className="font-medium mb-1">Années</p><div className="flex gap-3">{allYears.map((y) => <label key={y} className="flex items-center gap-1.5"><Checkbox checked={view.years.includes(y)} onCheckedChange={() => setView((v) => ({ ...v, years: tog(v.years.map(String), String(y)).map(Number) }))} />{y}</label>)}</div></div>
                <div><p className="font-medium mb-1">Colonnes et éléments</p><div className="grid grid-cols-2 gap-1.5">
                  {([['table', 'Tableau'], ['chart', 'Graphique'], ['budget', 'Budget'], ['gap', 'Écart budget'], ['evol', 'Évolution %'], ['total', 'Ligne total']] as const).map(([k, l]) =>
                    <label key={k} className="flex items-center gap-1.5"><Checkbox checked={view[k] as boolean} onCheckedChange={(c) => setView((v) => ({ ...v, [k]: !!c }))} />{l}</label>)}</div></div>
                <div className="flex gap-2"><div className="flex-1"><p className="font-medium mb-1">Montants HT</p><Select value={view.unit} onValueChange={(u) => setView((v) => ({ ...v, unit: u as Unit }))}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="eur">€</SelectItem><SelectItem value="keur">k€</SelectItem></SelectContent></Select></div>
                  <div className="flex-1"><p className="font-medium mb-1">Légende</p><Select value={view.legend} onValueChange={(l) => setView((v) => ({ ...v, legend: l as View['legend'] }))}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="bottom">En bas</SelectItem><SelectItem value="top">En haut</SelectItem><SelectItem value="right">À droite</SelectItem><SelectItem value="none">Masquée</SelectItem></SelectContent></Select></div></div>
                <div><p className="font-medium mb-1">Noms dans les légendes</p><div className="grid grid-cols-2 gap-1.5">{[...allYears.map(String), 'Budget'].map((k) =>
                  <Input key={k} className="h-7" placeholder={k} defaultValue={view.names[k] ?? ''} onBlur={(e) => setView((v) => ({ ...v, names: { ...v.names, [k]: e.target.value.trim() } }))} />)}</div></div>
              </PopoverContent></Popover>
            <Dialog><DialogTrigger asChild><Button size="sm"><FileDown className="h-3.5 w-3.5 mr-1" />Export PDF</Button></DialogTrigger>
              <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Export PDF du rapport hebdo</DialogTitle></DialogHeader>
                <div className="space-y-3 text-sm">
                  <div><p className="font-medium mb-1">Titre</p><Input value={pdf.title} onChange={(e) => setPdf({ ...pdf, title: e.target.value })} /></div>
                  <div><p className="font-medium mb-1">Commentaire (optionnel)</p><Textarea rows={3} value={pdf.comment} onChange={(e) => setPdf({ ...pdf, comment: e.target.value })} placeholder="Faits marquants de la semaine…" /></div>
                  <div><p className="font-medium mb-1">Sections (une page chacune)</p><div className="grid grid-cols-2 gap-1.5">{SECTIONS.map(([k, l]) => <label key={k} className="flex items-center gap-1.5"><Checkbox checked={pdf.sections.includes(k)} onCheckedChange={() => setPdf({ ...pdf, sections: SECTIONS.map(([x]) => x).filter((x) => x === k ? !pdf.sections.includes(k) : pdf.sections.includes(x)) })} />{l}</label>)}</div></div>
                  <div><p className="font-medium mb-1">Contenu</p><div className="flex gap-4">{([['tables', 'Tableaux'], ['charts', 'Graphiques'], ['budget', 'Budget et écart']] as const).map(([k, l]) => <label key={k} className="flex items-center gap-1.5"><Checkbox checked={pdf[k]} onCheckedChange={(c) => setPdf({ ...pdf, [k]: !!c })} />{l}</label>)}</div></div>
                  <p className="text-xs text-muted-foreground">Reprend les années ({years.join(', ') || 'aucune'}), l'unité ({view.unit === 'keur' ? 'k€' : '€'}) et le mode de CA choisis à l'écran.</p>
                </div>
                <DialogFooter><Button onClick={exportPdf}><FileDown className="h-4 w-4 mr-1" />Télécharger le PDF</Button></DialogFooter>
              </DialogContent></Dialog>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{modeLabel}, hors livraison. Factures lues jusqu'au <b>{lastDoc ? new Date(lastDoc).toLocaleDateString('fr-FR') : '—'}</b>{syncedAt ? ` (lecture Erplain du ${new Date(syncedAt).toLocaleString('fr-FR')})` : ''}{mode === 'with_orders' ? <> · commandes actives lues le <b>{backlogReadAt ? new Date(backlogReadAt).toLocaleString('fr-FR') : 'jamais — cliquez « Actualiser les commandes »'}</b>, seul le reste à facturer est ajouté, au mois de la commande</> : null}. Les chiffres restent enregistrés jusqu'à la prochaine actualisation. B2B France / hors France selon le pays commercial du client.</p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="ALL">
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="ALL">CA global + budget</TabsTrigger>
            {SEGMENTS.map((s) => <TabsTrigger key={s} value={s}>{SEG_LABEL[s]}</TabsTrigger>)}
            <TabsTrigger value="mix">Par type de client</TabsTrigger>
          </TabsList>
          <TabsContent value="ALL">{renderYearTable({ seg: 'ALL', withBudget: true })}</TabsContent>
          {SEGMENTS.map((s) => <TabsContent key={s} value={s}>{renderYearTable({ seg: s })}</TabsContent>)}
          <TabsContent value="mix" className="space-y-6">{years.map((y) => <div key={y}><h3 className="text-sm font-semibold mb-1">{y}</h3>{renderMixYear(y)}</div>)}</TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
