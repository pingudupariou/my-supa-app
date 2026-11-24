import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { copyTable } from '@/lib/clipboard';
import { buildGrid, MONTHS, SEG_LABEL, SEGMENTS, yearShare, type RafRow } from './rafReportModel';

const COLORS = ['hsl(var(--muted-foreground))', 'hsl(var(--chart-2, 160 60% 40%))', 'hsl(var(--primary))', 'hsl(var(--chart-4, 35 90% 50%))'];
const eur = (v: number | null | undefined) => v == null ? '' : `${Math.round(v).toLocaleString('fr-FR')} €`;
const k = (v: number) => `${Math.round(v / 1000)} k`;

export function RafReport({ refreshKey, syncedAt }: { refreshKey: number; syncedAt?: string | null }) {
  const cy = new Date().getFullYear();
  const years = useMemo(() => [cy - 2, cy - 1, cy], [cy]);
  const [rows, setRows] = useState<RafRow[]>([]);
  const [lastDoc, setLastDoc] = useState<string | null>(null);
  const [budget, setBudget] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [r, b] = await Promise.all([
      supabase.rpc('sales_raf_report' as any, { _years: years, _include_shipping: false }),
      supabase.from('sales_budgets' as any).select('month,amount').eq('year', cy),
    ]);
    setLoading(false);
    if (r.error) { toast.error(`Rapport : ${r.error.message}`); return; }
    const d = r.data as any;
    setRows(d?.rows ?? []); setLastDoc(d?.last_doc ?? null);
    setBudget(Object.fromEntries(((b.data as any[]) ?? []).map((x) => [x.month, Number(x.amount)])));
  }, [years, cy]);
  useEffect(() => { load(); }, [load, refreshKey]);

  const g = useMemo(() => buildGrid(rows, years, lastDoc), [rows, years, lastDoc]);
  const seriesData = (seg: string) => MONTHS.map((m, i) => ({ mois: m.slice(0, 4), ...Object.fromEntries(years.map((y) => [y, g[y]?.[i + 1]?.[seg]])), Budget: seg === 'ALL' ? budget[i + 1] ?? null : undefined }));

  const saveBudget = async (month: number, raw: string) => {
    const amount = Number(raw.replace(/\s/g, '').replace(',', '.'));
    if (!raw.trim()) { await supabase.from('sales_budgets' as any).delete().eq('year', cy).eq('month', month); setBudget((b) => { const n = { ...b }; delete n[month]; return n; }); return; }
    if (!Number.isFinite(amount)) return toast.error('Montant invalide');
    const { error } = await supabase.from('sales_budgets' as any).upsert({ year: cy, month, amount });
    if (error) return toast.error(`Budget non enregistré : ${error.message}`);
    setBudget((b) => ({ ...b, [month]: amount }));
  };

  const copy = (seg: string, withBudget: boolean) => {
    const head = ['Mois', ...years.map(String), ...(withBudget ? ['Budget'] : [])];
    const body = MONTHS.map((m, i) => [m, ...years.map((y) => g[y]?.[i + 1]?.[seg] ?? ''), ...(withBudget ? [budget[i + 1] ?? ''] : [])]);
    const tot = ['Total', ...years.map((y) => MONTHS.reduce((s, _, i) => s + (g[y]?.[i + 1]?.[seg] ?? 0), 0)), ...(withBudget ? [Object.values(budget).reduce((a, b) => a + b, 0)] : [])];
    copyTable(head, [...body, tot] as any).then((ok) => ok ? toast.success('Copié — collez dans Excel') : toast.error('Copie impossible'));
  };

  const YearTable = ({ seg, withBudget }: { seg: string; withBudget?: boolean }) => (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="overflow-auto">
        <Table><TableHeader><TableRow><TableHead>Mois</TableHead>{years.map((y) => <TableHead key={y} className="text-right">{y}</TableHead>)}{withBudget && <TableHead className="text-right">Budget {cy}</TableHead>}{withBudget && <TableHead className="text-right">Écart</TableHead>}</TableRow></TableHeader>
          <TableBody>{MONTHS.map((m, i) => { const cur = g[cy]?.[i + 1]?.[seg]; const bud = budget[i + 1]; return (
            <TableRow key={m}><TableCell>{m}</TableCell>{years.map((y) => <TableCell key={y} className="text-right tabular-nums">{eur(g[y]?.[i + 1]?.[seg])}</TableCell>)}
              {withBudget && <TableCell className="text-right"><Input key={`${i}-${bud}`} className="h-7 w-28 ml-auto text-right" defaultValue={bud ?? ''} placeholder="—" onBlur={(e) => { if (e.target.value !== String(bud ?? '')) saveBudget(i + 1, e.target.value); }} /></TableCell>}
              {withBudget && <TableCell className={`text-right tabular-nums ${cur != null && bud != null && cur < bud ? 'text-destructive' : ''}`}>{cur != null && bud != null ? eur(cur - bud) : ''}</TableCell>}
            </TableRow>); })}
            <TableRow className="font-semibold"><TableCell>Total</TableCell>{years.map((y) => <TableCell key={y} className="text-right tabular-nums">{eur(MONTHS.reduce((s, _, i) => s + (g[y]?.[i + 1]?.[seg] ?? 0), 0))}</TableCell>)}{withBudget && <TableCell className="text-right tabular-nums">{eur(Object.values(budget).reduce((a, b) => a + b, 0))}</TableCell>}{withBudget && <TableCell />}</TableRow>
          </TableBody></Table>
        <Button size="sm" variant="outline" className="mt-2" onClick={() => copy(seg, !!withBudget)}><Copy className="h-3.5 w-3.5 mr-1" />Copier pour Excel</Button>
      </div>
      <div className="h-80"><ResponsiveContainer width="100%" height="100%">
        {withBudget ? (
          <BarChart data={seriesData(seg)}><CartesianGrid strokeDasharray="3 3" className="stroke-muted" /><XAxis dataKey="mois" fontSize={11} /><YAxis fontSize={11} tickFormatter={k} /><Tooltip formatter={(v: number) => eur(v)} /><Legend />
            {years.map((y, i) => <Bar key={y} dataKey={String(y)} fill={COLORS[i]} />)}<Bar dataKey="Budget" fill={COLORS[3]} /></BarChart>
        ) : (
          <LineChart data={seriesData(seg)}><CartesianGrid strokeDasharray="3 3" className="stroke-muted" /><XAxis dataKey="mois" fontSize={11} /><YAxis fontSize={11} tickFormatter={k} /><Tooltip formatter={(v: number) => eur(v)} /><Legend />
            {years.map((y, i) => <Line key={y} dataKey={String(y)} stroke={COLORS[i]} strokeWidth={2} connectNulls={false} />)}</LineChart>
        )}
      </ResponsiveContainer></div>
    </div>
  );

  const MixYear = ({ y }: { y: number }) => {
    const data = MONTHS.map((m, i) => ({ mois: m.slice(0, 4), ...Object.fromEntries(SEGMENTS.map((s) => [SEG_LABEL[s], g[y]?.[i + 1]?.[s]])) }));
    const share = yearShare(g, y);
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 h-72"><ResponsiveContainer width="100%" height="100%"><LineChart data={data}><CartesianGrid strokeDasharray="3 3" className="stroke-muted" /><XAxis dataKey="mois" fontSize={11} /><YAxis fontSize={11} tickFormatter={k} /><Tooltip formatter={(v: number) => eur(v)} /><Legend />
          {SEGMENTS.map((s, i) => <Line key={s} dataKey={SEG_LABEL[s]} stroke={COLORS[i]} strokeWidth={2} />)}</LineChart></ResponsiveContainer></div>
        <div className="h-72"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={share.map((s) => ({ name: SEG_LABEL[s.segment], value: Math.max(0, s.value) }))} dataKey="value" nameKey="name" outerRadius={90} label={(e: any) => `${Math.round(e.percent * 100)} %`}>
          {share.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}</Pie><Tooltip formatter={(v: number) => eur(v)} /><Legend /></PieChart></ResponsiveContainer></div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">Rapport hebdo RAF — Analyse des ventes {loading && <Loader2 className="h-4 w-4 animate-spin" />}</CardTitle>
        <p className="text-xs text-muted-foreground">CA facturé HT Erplain (factures − avoirs, hors livraison), {years[0]}–{cy}. Données arrêtées à la dernière facture lue : <b>{lastDoc ? new Date(lastDoc).toLocaleDateString('fr-FR') : '—'}</b>{syncedAt ? ` · dernière lecture Erplain le ${new Date(syncedAt).toLocaleString('fr-FR')}` : ''}. Elles restent enregistrées jusqu'à la prochaine actualisation (« Actualiser depuis Erplain »). B2B France / hors France selon le pays commercial du client.</p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="ALL">
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="ALL">CA global + budget</TabsTrigger>
            {SEGMENTS.map((s) => <TabsTrigger key={s} value={s}>{SEG_LABEL[s]}</TabsTrigger>)}
            <TabsTrigger value="mix">Par type de client</TabsTrigger>
          </TabsList>
          <TabsContent value="ALL"><YearTable seg="ALL" withBudget /></TabsContent>
          {SEGMENTS.map((s) => <TabsContent key={s} value={s}><YearTable seg={s} /></TabsContent>)}
          <TabsContent value="mix" className="space-y-6">{years.map((y) => <div key={y}><h3 className="text-sm font-semibold mb-1">{y}</h3><MixYear y={y} /></div>)}</TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
