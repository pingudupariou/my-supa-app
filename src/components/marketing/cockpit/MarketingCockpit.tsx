import { useEffect, useMemo, useState } from 'react';
import { withMovingAverage } from './movingAverage';
import { AiDiagnosis } from './AiDiagnosis';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowDown, ArrowLeft, ArrowUp, ChevronDown, Loader2, RotateCcw } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const sb = supabase as any;
const C = { shop: 'hsl(var(--mi-shopify))', g: 'hsl(var(--mi-google))', m: 'hsl(var(--mi-meta))', ga: 'hsl(var(--mi-ga4))', mer: 'hsl(var(--mi-mer))', ink: 'hsl(var(--foreground))' };
const PALETTE = [C.shop, C.g, C.m, C.ga, C.mer, 'hsl(var(--primary))', 'hsl(var(--muted-foreground))'];
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addD = (s: string, n: number) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const diffD = (a: string, b: string) => Math.round((new Date(b + 'T00:00:00Z').getTime() - new Date(a + 'T00:00:00Z').getTime()) / 86400000);
const monday = (s: string) => { const d = new Date(s + 'T00:00:00Z'); return addD(s, -((d.getUTCDay() + 6) % 7)); };
const monthEnd = (k: string) => { const [y, m] = k.split('-').map(Number); return iso(new Date(Date.UTC(y, m, 0))); };
const eur = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n) || 0);
const int = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(n) || 0);
const dec = (n: number | null) => (n == null || !isFinite(n) ? '—' : n.toFixed(2));
const pct = (n: number | null) => (n == null || !isFinite(n) ? '—' : `${(n * 100).toFixed(1)} %`);
const div = (a: number, b: number) => (b ? a / b : null);
const fd = (s: string) => new Date(s + 'T00:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const fdShort = (s: string) => new Date(s + 'T00:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const axEur = (n: number) => (Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(0)} k€` : `${Math.round(n)} €`);
const axX = (n: number) => `${Number(n).toFixed(1)}×`;
const axPct = (n: number) => `${(n * 100).toFixed(1)} %`;
const axInt = (n: number) => (Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(1)} k` : `${Math.round(n)}`);
const SRC: Record<string, string> = { g: 'Google Ads', m: 'Meta Ads' };

type Raw = { week: boolean; shop: any[]; products: any[]; campaigns: any[]; ads: any[]; ads_country: any[]; ga4: any[] };
type F = { countries: string[]; campaigns: string[]; adSrc: 'all' | 'g' | 'm'; channel: string; device: string };
type Gran = 'day' | 'week' | 'month';
const G_L: Record<Gran, string> = { day: 'jour', week: 'semaine', month: 'mois' };
const F0: F = { countries: [], campaigns: [], adSrc: 'all', channel: '', device: '' };

const METRICS = {
  revenue: { l: 'CA total Shopify HT · base MER', f: eur },
  netSales: { l: 'Ventes nettes HT hors livraison · estimées', f: eur },
  shipping: { l: 'Frais de livraison importés', f: eur },
  orders: { l: 'Commandes', f: int },
  spend: { l: 'Dépenses Ads', f: eur },
  mer: { l: 'MER global', f: dec },
  roas: { l: 'ROAS attribué', f: dec },
  sessions: { l: 'Sessions GA4', f: int },
  cr: { l: 'Ratio commandes Shopify / sessions GA4', f: pct },
  cr_ga: { l: 'Taux conv. GA4', f: pct },
  aov: { l: 'Panier moyen HT', f: eur },
} as const;
type MK = keyof typeof METRICS;

/** Aggregates one period from one payload, applying filters client-side. */
function aggregate(raw: Raw, from: string, to: string, f: F) {
  const inR = (b: string) => b >= from && b <= to;
  const cSet = new Set(f.countries), kSet = new Set(f.campaigns);
  const okC = (c: string) => !cSet.size || cSet.has(c);
  const okK = (s: string, id: string) => (f.adSrc === 'all' || f.adSrc === s) && (!kSet.size || kSet.has(`${s}:${id}`));
  const days: Record<string, any> = {};
  const day = (b: string) => (days[b] ??= { b, revenue: 0, shipping: 0, netSales: 0, orders: 0, spend: 0, g: 0, m: 0, value: 0, gv: 0, mv: 0, sessions: 0, pu: 0 });
  const t = { revenue: 0, shipping: 0, netSales: 0, orders: 0, spend: 0, g: 0, m: 0, value: 0, gv: 0, mv: 0, conv: 0, clicks: 0, impr: 0, sessions: 0, vi: 0, ac: 0, bc: 0, pu: 0, pr: 0 };
  const byCountry: Record<string, any> = {};
  const cty = (c: string) => (byCountry[c] ??= { c, revenue: 0, orders: 0, spend: 0, value: 0, sessions: 0, pu: 0 });
  for (const [b, c, r, n, sh] of raw.shop) if (inR(b) && okC(c)) {
    const shipping = Number(sh) || 0;
    t.revenue += +r; t.shipping += shipping; t.netSales += +r - shipping; t.orders += +n;
    day(b).revenue += +r; day(b).shipping += shipping; day(b).netSales += +r - shipping; day(b).orders += +n; cty(c).revenue += +r; cty(c).orders += +n;
  }
  // Ads totals: campaign table when no country filter, else country breakdown (part without country excluded).
  const byCamp: Record<string, any> = {};
  const camp = (s: string, id: string) => (byCamp[`${s}:${id}`] ??= { key: `${s}:${id}`, s, id, spend: 0, clicks: 0, impr: 0, conv: 0, value: 0 });
  if (!cSet.size) {
    for (const [s, b, id, sp, cl, im, cv, v] of raw.ads) if (inR(b) && okK(s, id)) {
      t.spend += +sp; t[s as 'g'] += +sp; t.value += +v; t[(s + 'v') as 'gv'] += +v; t.conv += +cv; t.clicks += +cl; t.impr += +im;
      const d = day(b); d.spend += +sp; d[s] += +sp; d.value += +v; d[s + 'v'] += +v;
      const k = camp(s, id); k.spend += +sp; k.clicks += +cl; k.impr += +im; k.conv += +cv; k.value += +v;
    }
  }
  for (const [s, b, id, c, sp, cl, cv, v] of raw.ads_country) if (inR(b) && okK(s, id) && okC(c)) {
    const x = cty(c); x.spend += +sp; x.value += +v;
    if (cSet.size) {
      t.spend += +sp; t[s as 'g'] += +sp; t.value += +v; t[(s + 'v') as 'gv'] += +v; t.conv += +cv; t.clicks += +cl;
      const d = day(b); d.spend += +sp; d[s] += +sp; d.value += +v; d[s + 'v'] += +v;
      const k = camp(s, id); k.spend += +sp; k.clicks += +cl; k.conv += +cv; k.value += +v;
    }
  }
  const byChannel: Record<string, any> = {}, byDevice: Record<string, any> = {};
  for (const [b, ch, c, dv, se, vi, ac, bc, pu, pr] of raw.ga4) if (inR(b) && okC(c) && (!f.channel || f.channel === ch) && (!f.device || f.device === dv)) {
    t.sessions += +se; t.vi += +vi; t.ac += +ac; t.bc += +bc; t.pu += +pu; t.pr += +pr; day(b).sessions += +se; day(b).pu += +pu;
    cty(c).sessions += +se; cty(c).pu += +pu;
    (byChannel[ch] ??= { k: ch, sessions: 0, pu: 0, pr: 0 }); byChannel[ch].sessions += +se; byChannel[ch].pu += +pu; byChannel[ch].pr += +pr;
    (byDevice[dv] ??= { k: dv, sessions: 0, pu: 0 }); byDevice[dv].sessions += +se; byDevice[dv].pu += +pu;
  }
  const kpi: Record<MK, number | null> = {
    revenue: t.revenue, shipping: t.shipping, netSales: t.netSales, orders: t.orders, spend: t.spend, mer: div(t.revenue, t.spend), roas: div(t.value, t.spend),
    sessions: t.sessions, cr: div(t.orders, t.sessions), cr_ga: div(t.pu, t.sessions), aov: div(t.revenue, t.orders),
  };
  return { t, kpi, series: Object.values(days), byCountry, byCamp, byChannel, byDevice };
}

const SUMS = ['revenue', 'shipping', 'netSales', 'orders', 'spend', 'g', 'm', 'value', 'gv', 'mv', 'sessions', 'pu'];
/** Bucket key for a raw date (daily or ISO-week rows). Weekly rows go to the month containing their Thursday. */
const makeKey = (g: Gran, weekRows: boolean) => (b: string) => g === 'day' ? b : g === 'week' ? monday(b) : (weekRows ? addD(b, 3) : b).slice(0, 7);
/** Regroups a series into buckets (sums, then ratios recomputed — never averaged) and flags incomplete buckets. */
function bucketize(series: any[], g: Gran, weekRows: boolean, from: string, to: string, today: string) {
  const key = makeKey(g, weekRows); const m: Record<string, any> = {};
  for (const d of series) { const k = key(d.b); const x = (m[k] ??= { b: k, ...Object.fromEntries(SUMS.map((s) => [s, 0])) }); for (const s of SUMS) x[s] += d[s] ?? 0; }
  return Object.values(m).sort((a: any, b: any) => (a.b < b.b ? -1 : 1)).map((x: any) => {
    const start = g === 'month' ? x.b + '-01' : x.b, end = g === 'month' ? monthEnd(x.b) : g === 'week' ? addD(x.b, 6) : x.b;
    const partial = start < from || end > to || (start <= today && end >= today);
    return { ...x, partial, mer: div(x.revenue, x.spend), roas: div(x.value, x.spend), roas_g: div(x.gv, x.g), roas_m: div(x.mv, x.m),
      cr: div(x.orders, x.sessions), cr_ga: div(x.pu, x.sessions), aov: div(x.revenue, x.orders) };
  });
}
const fmtB = (g: Gran) => (b: string) => !b ? '' : g === 'month' ? new Date(b + '-01T00:00:00Z').toLocaleDateString('fr-FR', { month: 'short', year: '2-digit', timeZone: 'UTC' }) : g === 'week' ? `sem. ${fdShort(b)}` : fdShort(b);

function MultiPick({ label, options, value, onChange }: { label: string; options: { v: string; l: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  const [q, setQ] = useState('');
  const shown = options.filter((o) => o.l.toLowerCase().includes(q.toLowerCase())).slice(0, 200);
  return (
    <Popover>
      <PopoverTrigger asChild><Button variant={value.length ? 'secondary' : 'outline'} size="sm" className="h-9" data-readonly-allow>{label}{value.length ? ` (${value.length})` : ' : tous'}<ChevronDown className="ml-1 h-4 w-4" /></Button></PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <Input placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} className="mb-2 h-8" />
        <div className="max-h-64 overflow-auto space-y-1">
          {shown.map((o) => (
            <label key={o.v} className="flex items-center gap-2 text-sm cursor-pointer px-1">
              <Checkbox checked={value.includes(o.v)} onCheckedChange={(c) => onChange(c ? [...value, o.v] : value.filter((x) => x !== o.v))} />
              <span className="truncate">{o.l}</span>
            </label>))}
        </div>
        {value.length > 0 && <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => onChange([])}>Tout effacer</Button>}
      </PopoverContent>
    </Popover>
  );
}

function Delta({ cur, prev, invert, neutral }: { cur: number | null; prev: number | null; invert?: boolean; neutral?: boolean }) {
  if (cur == null || prev == null || !prev) return <span className="text-xs text-muted-foreground">—</span>;
  const d = (cur - prev) / Math.abs(prev);
  const good = invert ? d < 0 : d > 0;
  const cls = neutral ? 'text-muted-foreground' : good ? 'text-primary' : 'text-destructive';
  return <span className={`inline-flex items-center text-xs font-medium ${cls}`}>{d >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}{Math.abs(d * 100).toFixed(1)} %</span>;
}

function Kpi({ k, cur, prev, note, color, big, neutral }: { k: MK; cur: any; prev: any; note?: string; color: string; big?: boolean; neutral?: boolean }) {
  return (
    <div className={`relative overflow-hidden rounded-xl border bg-card ${big ? 'p-4' : 'p-3'}`}>
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: color }} />
      <div className="text-xs font-medium text-muted-foreground">{METRICS[k].l}</div>
      <div className={`${big ? 'text-2xl md:text-3xl' : 'text-lg'} mt-1 font-semibold tabular-nums tracking-tight`}>{METRICS[k].f(cur[k])}</div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs"><Delta cur={cur[k]} prev={prev[k]} neutral={neutral} /><span className="text-muted-foreground tabular-nums">vs {METRICS[k].f(prev[k])}</span></div>
      {note && <div className="mt-1 text-[11px] leading-tight text-muted-foreground">{note}</div>}
    </div>
  );
}

const NA = ({ children }: { children: React.ReactNode }) => <Badge variant="outline" className="text-[10px] font-normal">{children}</Badge>;

function SortTable({ cols, rows, initial }: { cols: { k: string; l: string; f?: (v: any, r: any) => any; num?: boolean }[]; rows: any[]; initial: string }) {
  const [sort, setSort] = useState<{ k: string; asc: boolean }>({ k: initial, asc: false });
  const [q, setQ] = useState('');
  const data = useMemo(() => rows.filter((r) => !q || JSON.stringify(r).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => { const x = a[sort.k] ?? -Infinity, y = b[sort.k] ?? -Infinity; return (x < y ? -1 : x > y ? 1 : 0) * (sort.asc ? 1 : -1); }), [rows, q, sort]);
  return (
    <div className="space-y-2">
      <Input placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} className="h-8 max-w-xs" />
      <div className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow>{cols.map((c) => (
            <TableHead key={c.k} className={`cursor-pointer select-none whitespace-nowrap ${c.num ? 'text-right' : ''}`} onClick={() => setSort({ k: c.k, asc: sort.k === c.k ? !sort.asc : false })}>
              {c.l}{sort.k === c.k ? (sort.asc ? ' ↑' : ' ↓') : ''}</TableHead>))}</TableRow></TableHeader>
          <TableBody>{data.slice(0, 300).map((r, i) => (
            <TableRow key={i}>{cols.map((c) => <TableCell key={c.k} className={c.num ? 'text-right whitespace-nowrap' : ''}>{c.f ? c.f(r[c.k], r) : r[c.k]}</TableCell>)}</TableRow>))}</TableBody>
        </Table>
      </div>
    </div>
  );
}

const ChartBox = ({ children, h = 280 }: { children: React.ReactElement; h?: number }) => <div style={{ height: h }}><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>;
const tick = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' };
const tip = { contentStyle: { background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', fontSize: 12, borderRadius: 8 } };
const grid = <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.6} />;

type MDef = { k: string; l: string; color: string; f: (n: any) => string; axis?: 'l' | 'r'; on?: boolean; dash?: boolean };

/** One chart = one unit. Chips toggle curves, tooltip shows every visible value + comparison. */
function TrendChart({ title, unit, data, defs, cmp, cmpLabel, fx, yl, yr, onZoom, canZoom, note, daily = false, h = 260 }: {
  title: string; unit: string; data: any[]; defs: MDef[]; cmp: boolean; cmpLabel: string; fx: (b: string) => string;
  yl: (n: number) => string; yr?: (n: number) => string; onZoom?: (b: string) => void; canZoom?: boolean; note?: string; daily?: boolean; h?: number;
}) {
  const [on, setOn] = useState<Set<string>>(() => new Set(defs.filter((d) => d.on).map((d) => d.k)));
  const [smooth, setSmooth] = useState(false);
  const showAverage = daily && smooth;
  const plotted = useMemo(() => showAverage ? withMovingAverage(data, defs.map(d => d.k)) : data, [data, defs, showAverage]);
  const act = defs.filter((d) => on.has(d.k));
  const right = act.some((d) => d.axis === 'r');
  const toggle = (k: string) => setOn((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const Tip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null; const r = payload[0].payload;
    return (
      <div className="min-w-48 rounded-lg border bg-popover p-2.5 text-xs shadow-md">
        <div className="mb-1.5 font-medium">{fx(label)}{r.partial && <span className="ml-1 text-muted-foreground">· incomplet</span>}</div>
        {act.map((d) => (
          <div key={d.k} className="flex items-center justify-between gap-3 py-0.5">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: d.color }} />{d.l}</span>
            <span className="tabular-nums font-medium">{d.f(r[d.k])}{cmp && r['p_b'] && <span className="ml-1.5 font-normal text-muted-foreground">vs {d.f(r['p_' + d.k])} <Delta cur={r[d.k]} prev={r['p_' + d.k]} neutral /></span>}</span>
          </div>))}
        {showAverage && act.map(d => <div key={'ma7_' + d.k} className="flex justify-between gap-3 py-0.5 text-muted-foreground"><span>{d.l} · moy. 7 j</span><span className="tabular-nums">{r['ma7_' + d.k] == null ? '—' : d.f(r['ma7_' + d.k])}</span></div>)}
        {cmp && r.p_b && <div className="mt-1.5 border-t pt-1 text-muted-foreground">Comparé à : {fx(r.p_b)}{r.p_partial ? ' · incomplet' : ''}</div>}
        {canZoom && <div className="mt-1 text-muted-foreground">Cliquer pour zoomer</div>}
      </div>);
  };
  return (
    <Card className="overflow-hidden">
      <CardHeader className="space-y-2 pb-1">
        <div className="flex items-baseline justify-between gap-2"><CardTitle className="text-sm font-semibold">{title}</CardTitle><span className="text-[11px] text-muted-foreground">{unit}</span></div>
        <div className="flex flex-wrap gap-1.5">{defs.map((d) => (
          <Button key={d.k} variant="ghost" size="sm" type="button" data-readonly-allow onClick={() => toggle(d.k)}
            className={`inline-flex items-center gap-1.5 h-auto rounded-full border px-2.5 py-0.5 text-xs transition ${on.has(d.k) ? 'bg-secondary text-foreground' : 'text-muted-foreground opacity-60 hover:opacity-100'}`}>
            <span className="h-2 w-2 rounded-full" style={{ background: on.has(d.k) ? d.color : 'hsl(var(--muted-foreground))' }} />{d.l}{d.axis === 'r' && <span className="text-[10px] text-muted-foreground">(axe droit)</span>}
          </Button>))}</div>
        {daily && <label className="flex items-center gap-2 text-xs text-muted-foreground"><Checkbox checked={smooth} onCheckedChange={value => setSmooth(value === true)} data-readonly-allow />Moyenne glissante 7 jours</label>}
      </CardHeader>
      <CardContent className="pt-2">
        {act.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">Sélectionnez au moins un indicateur.</p> : (
          <ChartBox h={h}>
            <LineChart data={plotted} margin={{ top: 8, right: right ? 4 : 12, left: 0, bottom: 0 }} onClick={(e: any) => canZoom && e?.activeLabel && onZoom?.(e.activeLabel)} style={{ cursor: canZoom ? 'zoom-in' : 'default' }}>
              {grid}
              <XAxis dataKey="b" tick={tick} tickFormatter={(b, i) => fx(b) + (data[i]?.partial ? '*' : '')} tickLine={false} axisLine={false} minTickGap={16} />
              <YAxis yAxisId="l" tick={tick} tickFormatter={yl} tickLine={false} axisLine={false} width={56} />
              {right && <YAxis yAxisId="r" orientation="right" tick={tick} tickFormatter={yr ?? yl} tickLine={false} axisLine={false} width={48} />}
              <Tooltip content={<Tip />} cursor={{ stroke: 'hsl(var(--border))' }} />
              {cmp && act.map((d) => <Line key={'p' + d.k} yAxisId={d.axis ?? 'l'} dataKey={'p_' + d.k} stroke={d.color} strokeOpacity={0.45} strokeDasharray="4 4" dot={false} strokeWidth={1.5} connectNulls isAnimationActive={false} />)}
              {showAverage && act.map(d => <Line key={'ma7_' + d.k} name={d.l + ' · moyenne 7 jours'} yAxisId={d.axis ?? 'l'} type="monotone" dataKey={'ma7_' + d.k} stroke={d.color} strokeDasharray="2 3" strokeWidth={2} strokeOpacity={0.7} dot={false} connectNulls={false} isAnimationActive={false} />)}
              {act.map((d) => <Line key={d.k} yAxisId={d.axis ?? 'l'} type="monotone" dataKey={d.k} stroke={d.color} strokeDasharray={d.dash ? '6 3' : undefined} dot={data.length < 20 ? { r: 2.5 } : false} activeDot={{ r: 4 }} strokeWidth={2.25} connectNulls isAnimationActive={false} />)}
            </LineChart>
          </ChartBox>)}
        <p className="mt-1 text-[11px] text-muted-foreground">{cmp ? `Pointillés : ${cmpLabel}. ` : ''}{showAverage ? 'Moyenne 7 jours : pointillés fins, moyenne des valeurs quotidiennes sur 7 jours complets ; valeurs réelles conservées. ' : ''}* période incomplète.{note ? ` ${note}` : ''}</p>
      </CardContent>
    </Card>
  );
}

const fetchCache = new Map<string, Promise<Raw>>();
const getRaw = (a: string, b: string) => {
  const k = `${a}|${b}`;
  if (!fetchCache.has(k)) fetchCache.set(k, sb.rpc('marketing_cockpit', { _from: a, _to: b, _split: a }).then(({ data, error }: any) => { if (error) { fetchCache.delete(k); throw error; } return data as Raw; }));
  return fetchCache.get(k) ?? Promise.reject(new Error('Chargement indisponible')); 
};

export function MarketingCockpit() {
  const today = iso(new Date());
  const yesterday = addD(today, -1);
  const [preset, setPreset] = useState('30');
  const [from, setFrom] = useState(addD(yesterday, -29));
  const [to, setTo] = useState(yesterday);
  const [cmpMode, setCmpMode] = useState<'prev' | 'yoy' | 'custom'>('prev');
  const [cmpStart, setCmpStart] = useState(addD(yesterday, -394));
  const [overlay, setOverlay] = useState(true);
  const [gran, setGran] = useState<'auto' | Gran>('auto');
  const [stack, setStack] = useState<{ preset: string; from: string; to: string; gran: 'auto' | Gran }[]>([]);
  const [rawCur, setRawCur] = useState<Raw | null>(null);
  const [rawCmp, setRawCmp] = useState<Raw | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [f, setF] = useState<F>(F0);
  const [cmpCountries, setCmpCountries] = useState<string[]>([]);
  const [cmpCamps, setCmpCamps] = useState<string[]>([]);

  useEffect(() => { if (preset !== 'custom') { setFrom(addD(yesterday, -(Number(preset) - 1))); setTo(yesterday); } }, [preset, yesterday]);

  // Long ranges are served in ISO weeks (server rule > 200 days): the period then starts on a Monday.
  const span = diffD(from, to) + 1;
  const weekly = span > 195;
  const cFrom = weekly ? monday(from) : from;
  const len = diffD(cFrom, to) + 1;
  // Comparison always has the exact same length as the current period.
  const pFrom = cmpMode === 'yoy' ? addD(cFrom, -364) : cmpMode === 'custom' ? (weekly ? monday(cmpStart) : cmpStart) : addD(cFrom, weekly ? -Math.ceil(len / 7) * 7 : -len);
  const pTo = addD(pFrom, len - 1);
  const cmpLabel = cmpMode === 'yoy' ? 'N-1 (mêmes jours de semaine, −52 sem.)' : cmpMode === 'custom' ? 'période personnalisée' : 'période précédente';

  useEffect(() => {
    if (from > to) return;
    let off = false; setLoading(true); setErr('');
    Promise.all([getRaw(cFrom, to), getRaw(pFrom, pTo)]).then(([a, b]) => { if (!off) { setRawCur(a); setRawCmp(b); setLoading(false); } })
      .catch((e) => { if (!off) { setErr(e.message ?? String(e)); setLoading(false); } });
    return () => { off = true; };
  }, [cFrom, to, pFrom, pTo, from]);

  // Products: current payload = period 1, comparison payload = period 0 (same row format as before).
  const raw = useMemo<Raw | null>(() => rawCur && rawCmp && ({ ...rawCur, products: [...rawCur.products.map((p: any[]) => [1, ...p.slice(1)]), ...rawCmp.products.map((p: any[]) => [0, ...p.slice(1)])] }), [rawCur, rawCmp]);
  const weekRows = !!rawCur?.week;
  const autoG: Gran = span > 120 ? 'month' : span > 45 ? 'week' : 'day';
  const eg: Gran = (() => { const g = gran === 'auto' ? autoG : gran; return weekRows && g === 'day' ? 'week' : g; })();
  const keyOf = makeKey(eg, weekRows);
  const fx = fmtB(eg);
  const fmtMonth = fx;

  const campName = useMemo(() => new Map([...(rawCur?.campaigns ?? []), ...(rawCmp?.campaigns ?? [])].map(([s, id, n]: any) => [`${s}:${id}`, n ?? id])), [rawCur, rawCmp]);
  const cur = useMemo(() => rawCur && aggregate(rawCur, cFrom, to, f), [rawCur, cFrom, to, f]);
  const prev = useMemo(() => rawCmp && aggregate(rawCmp, pFrom, pTo, f), [rawCmp, pFrom, pTo, f]);
  const chartSeries = useMemo(() => {
    if (!cur || !prev) return [];
    const a = bucketize(cur.series, eg, weekRows, cFrom, to, today);
    // Align comparison buckets by offset from the first bucket of each period.
    const pk = makeKey(eg, weekRows); const startKey = pk(pFrom), curKey = pk(cFrom);
    const b = bucketize(prev.series, eg, weekRows, pFrom, pTo, today);
    const shift = (k: string, n: number) => eg === 'month' ? (() => { const [y, m] = k.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return iso(d).slice(0, 7); })() : addD(k, n * (eg === 'week' ? 7 : 1));
    const idx = (k: string) => eg === 'month' ? (Number(k.slice(0, 4)) * 12 + Number(k.slice(5, 7))) - (Number(curKey.slice(0, 4)) * 12 + Number(curKey.slice(5, 7))) : diffD(curKey, k) / (eg === 'week' ? 7 : 1);
    const pm = new Map(b.map((x: any) => [x.b, x]));
    return a.map((x: any) => { const p: any = pm.get(shift(startKey, idx(x.b))); return p ? { ...x, ...Object.fromEntries(Object.entries(p).map(([k, v]) => ['p_' + k, v])) } : x; });
  }, [cur, prev, eg, weekRows, cFrom, to, pFrom, pTo, today]);
  const all = useMemo(() => rawCur && aggregate(rawCur, cFrom, to, F0), [rawCur, cFrom, to]);

  // Compact summary sent to the AI diagnosis (aggregates only, never raw rows).
  const aiSummary = useMemo(() => {
    if (!cur || !prev || !raw) return null;
    const r2 = (n: any) => (n == null || !isFinite(n) ? null : Math.round(Number(n) * 100) / 100);
    const kp = (a: any) => Object.fromEntries(Object.entries(a.kpi).map(([k, v]) => [k, r2(v)]));
    const tt = (a: any) => ({ google_spend: r2(a.t.g), meta_spend: r2(a.t.m), google_attributed_value: r2(a.t.gv), meta_attributed_value: r2(a.t.mv), ads_clicks: a.t.clicks, ads_conversions_attributed: r2(a.t.conv), ga4_funnel: { view_item: a.t.vi, add_to_cart: a.t.ac, begin_checkout: a.t.bc, ga4_purchases_attributed: a.t.pu } });
    const cty = Object.values(cur.byCountry).sort((a: any, b: any) => b.revenue + b.spend - a.revenue - a.spend).slice(0, 12).map((x: any) => {
      const p: any = prev.byCountry[x.c] ?? {};
      return { country: x.c, shopify_revenue: r2(x.revenue), orders: x.orders, ads_spend: r2(x.spend), mer: r2(div(x.revenue, x.spend)), sessions: x.sessions, prev_revenue: r2(p.revenue ?? 0), prev_spend: r2(p.spend ?? 0) };
    });
    const camps = Object.values(cur.byCamp).filter((k: any) => k.spend > 0).sort((a: any, b: any) => b.spend - a.spend).slice(0, 15).map((k: any) => {
      const p: any = prev.byCamp[k.key] ?? {};
      return { source: SRC[k.s], name: campName.get(k.key) ?? k.id, spend: r2(k.spend), clicks: k.clicks, conversions_attributed: r2(k.conv), value_attributed: r2(k.value), roas_attributed: r2(div(k.value, k.spend)), prev_spend: r2(p.spend ?? 0), prev_roas: r2(div(p.value ?? 0, p.spend ?? 0)) };
    });
    const ch = Object.values(cur.byChannel).sort((a: any, b: any) => b.sessions - a.sessions).slice(0, 10).map((x: any) => ({ channel: x.k, sessions: x.sessions, ga4_purchases: x.pu }));
    const dv = Object.values(cur.byDevice).map((x: any) => ({ device: x.k, sessions: x.sessions, ga4_purchases: x.pu }));
    const set = new Set(f.countries); const pm: Record<string, any> = {};
    for (const [p, t, c, r] of raw.products) if (!set.size || set.has(c)) { const x = (pm[t] ??= { product: t, revenue: 0, prev_revenue: 0 }); p === 1 ? (x.revenue += +r) : (x.prev_revenue += +r); }
    const prods = Object.values(pm).map((x: any) => ({ ...x, revenue: r2(x.revenue), prev_revenue: r2(x.prev_revenue) }));
    const top = [...prods].sort((a: any, b: any) => b.revenue - a.revenue).slice(0, 10);
    const moves = [...prods].sort((a: any, b: any) => Math.abs(b.revenue - b.prev_revenue) - Math.abs(a.revenue - a.prev_revenue)).slice(0, 8);
    return { period: { from: cFrom, to, compared_to: { from: pFrom, to: pTo, mode: cmpLabel } }, notes: [merNote, 'Ventes nettes hors livraison estimées', 'Marges non disponibles'],
      kpi_current: kp(cur), kpi_previous: kp(prev), detail_current: tt(cur), detail_previous: tt(prev), countries: cty, campaigns: camps, ga4_channels: ch, ga4_devices: dv, top_products: top, product_moves: moves };
  }, [cur, prev, raw, f, campName, cFrom, to, pFrom, pTo, cmpLabel, merNote]);
  const countryOpts = useMemo(() => Object.values(all?.byCountry ?? {}).sort((a: any, b: any) => b.revenue + b.spend - a.revenue - a.spend).map((x: any) => ({ v: x.c, l: x.c })), [all]);
  const campOpts = useMemo(() => Object.values(all?.byCamp ?? {}).filter((k: any) => k.spend > 0).sort((a: any, b: any) => b.spend - a.spend).map((k: any) => ({ v: k.key, l: `${SRC[k.s]} · ${campName.get(k.key) ?? k.id}` })), [all, campName]);
  const channels = useMemo(() => Object.keys(all?.byChannel ?? {}).sort(), [all]);
  const devices = useMemo(() => Object.keys(all?.byDevice ?? {}).sort(), [all]);

  const adsFiltered = f.campaigns.length > 0 || f.adSrc !== 'all';
  const gaFiltered = !!f.channel || !!f.device;
  const merNote = adsFiltered ? 'Partiel : CA total HT, livraison incluse ÷ dépenses filtrées' : 'CA total HT, livraison incluse ÷ (Google + Meta)';
  const crNote = gaFiltered ? 'Non comparable : commandes Shopify non filtrables par canal/appareil — voir taux GA4' : 'Commandes Shopify ÷ sessions GA4';
  const filtersOn = f.countries.length || f.campaigns.length || f.adSrc !== 'all' || f.channel || f.device;

  const zoom = (b: string) => {
    if (eg === 'day') return;
    const s = eg === 'month' ? b + '-01' : b, e = eg === 'month' ? monthEnd(b) : addD(b, 6);
    setStack([...stack, { preset, from, to, gran }]);
    setPreset('custom'); setFrom(s); setTo(e > today ? today : e); setGran('day');
  };
  const back = () => { const p = stack[stack.length - 1]; if (!p) return; setStack(stack.slice(0, -1)); setPreset(p.preset); setFrom(p.from); setTo(p.to); setGran(p.gran); };
  const canZoom = eg !== 'day';
  const zoomHint = canZoom ? `Cliquez un${eg === 'month' ? ' mois' : 'e semaine'} pour l'afficher par jour.` : undefined;

  return (
    <div className="space-y-4">
      {/* Global filters */}
      <div className="sticky top-0 z-20 -mx-1 space-y-2 rounded-xl border bg-background/95 p-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1"><div className="text-[11px] font-medium text-muted-foreground">Période</div>
            <Select value={preset} onValueChange={(v) => { setStack([]); setPreset(v); }}>
              <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 jours</SelectItem><SelectItem value="30">30 jours</SelectItem><SelectItem value="90">3 mois</SelectItem>
                <SelectItem value="182">6 mois</SelectItem><SelectItem value="365">12 mois</SelectItem><SelectItem value="custom">Personnalisée</SelectItem>
              </SelectContent>
            </Select></div>
          {preset === 'custom' && <div className="flex gap-1"><Input type="date" className="h-9 w-36" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /><Input type="date" className="h-9 w-36" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} /></div>}
          <div className="space-y-1"><div className="text-[11px] font-medium text-muted-foreground">Comparer à</div>
            <Select value={cmpMode} onValueChange={(v) => setCmpMode(v as any)}>
              <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="prev">Période précédente</SelectItem><SelectItem value="yoy">Année précédente (N-1)</SelectItem><SelectItem value="custom">Dates personnalisées</SelectItem></SelectContent>
            </Select></div>
          {cmpMode === 'custom' && <div className="space-y-1"><div className="text-[11px] text-muted-foreground">Début (même durée)</div><Input type="date" className="h-9 w-36" value={cmpStart} max={today} onChange={(e) => setCmpStart(e.target.value)} /></div>}
          <div className="space-y-1"><div className="text-[11px] font-medium text-muted-foreground">Échelle</div>
            <Select value={gran} onValueChange={(v) => setGran(v as any)}>
              <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto ({G_L[autoG]})</SelectItem>
                <SelectItem value="day" disabled={weekRows}>Jour{weekRows ? ' (≤ 6 mois)' : ''}</SelectItem>
                <SelectItem value="week">Semaine</SelectItem><SelectItem value="month">Mois</SelectItem>
              </SelectContent>
            </Select></div>
          <Button variant={overlay ? 'secondary' : 'outline'} size="sm" className="h-9" data-readonly-allow onClick={() => setOverlay(!overlay)}>{overlay ? 'Comparaison affichée' : 'Comparaison masquée'}</Button>
          {stack.length > 0 && <Button variant="outline" size="sm" className="h-9" data-readonly-allow onClick={back}><ArrowLeft className="mr-1 h-4 w-4" />Revenir</Button>}
          {loading && <Loader2 className="mb-2 h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MultiPick label="Pays" options={countryOpts} value={f.countries} onChange={(v) => setF({ ...f, countries: v })} />
          <Select value={f.adSrc} onValueChange={(v) => setF({ ...f, adSrc: v as F['adSrc'] })}>
            <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Régie : Google + Meta</SelectItem><SelectItem value="g">Google Ads seul</SelectItem><SelectItem value="m">Meta Ads seul</SelectItem></SelectContent>
          </Select>
          <MultiPick label="Campagnes" options={campOpts} value={f.campaigns} onChange={(v) => setF({ ...f, campaigns: v })} />
          <Select value={f.channel || 'all'} onValueChange={(v) => setF({ ...f, channel: v === 'all' ? '' : v })}>
            <SelectTrigger className="h-9 w-44"><SelectValue placeholder="Canal GA4" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Canal GA4 : tous</SelectItem>{channels.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={f.device || 'all'} onValueChange={(v) => setF({ ...f, device: v === 'all' ? '' : v })}>
            <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Appareil : tous</SelectItem>{devices.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
          {filtersOn ? <Button variant="ghost" size="sm" className="h-9" data-readonly-allow onClick={() => setF(F0)}><RotateCcw className="mr-1 h-4 w-4" />Réinitialiser</Button> : null}
        </div>
        <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{fd(cFrom)} → {fd(to)}</span><span>({len} j)</span>
          <span>· comparé à {fd(pFrom)} → {fd(pTo)} ({len} j)</span>
          {weekly && cFrom !== from && <NA>Début aligné sur le lundi (données par semaine au-delà de 6 mois)</NA>}
          {to >= today && <NA>Aujourd'hui inclus : données partielles (synchro nocturne)</NA>}
          {pTo >= cFrom && <NA>Les deux périodes se chevauchent</NA>}
          {adsFiltered && <NA>Shopify et GA4 : non filtrables par campagne ni par régie</NA>}
          {gaFiltered && <NA>Canal GA4 / appareil : appliqués à GA4 uniquement</NA>}
          {f.countries.length > 0 && <NA>Pays : dépenses Ads issues de la ventilation par pays (part sans pays exclue)</NA>}
        </div>
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}
      {cur && prev && (
        <Tabs defaultValue="overview">
          <div className="overflow-x-auto"><TabsList>
            <TabsTrigger value="overview" data-readonly-allow>Vue d'ensemble</TabsTrigger>
            <TabsTrigger value="acq" data-readonly-allow>Acquisition</TabsTrigger>
            <TabsTrigger value="country" data-readonly-allow>Pays</TabsTrigger>
            <TabsTrigger value="camp" data-readonly-allow>Campagnes</TabsTrigger>
            <TabsTrigger value="prod" data-readonly-allow>Produits</TabsTrigger>
            <TabsTrigger value="funnel" data-readonly-allow>Tunnel</TabsTrigger>
            <TabsTrigger value="ai" data-readonly-allow>Diagnostic IA</TabsTrigger>
          </TabsList></div>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi big k="revenue" cur={cur.kpi} prev={prev.kpi} color={C.shop} note="Indicateur principal · livraison incluse · hors annulées et tests" />
              <Kpi big k="spend" cur={cur.kpi} prev={prev.kpi} color={C.ink} neutral note={`Google ${eur(cur.t.g)} · Meta ${eur(cur.t.m)}`} />
              <Kpi big k="mer" cur={cur.kpi} prev={prev.kpi} color={C.mer} note={merNote} />
              <Kpi big k="orders" cur={cur.kpi} prev={prev.kpi} color={C.shop} note="Shopify, hors annulées et tests" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Kpi k="netSales" cur={cur.kpi} prev={prev.kpi} color={C.shop} note="CA total HT − frais de livraison importés (approximation)" />
              <Kpi k="shipping" cur={cur.kpi} prev={prev.kpi} color={C.shop} note="Taxes de livraison non ventilées dans les données importées" />
            </div>
            <p className="text-xs text-muted-foreground">CA total HT = montant actuel Shopify − taxes ; base du MER inchangée. Les ventes nettes hors livraison sont estimées : les taxes et remboursements de livraison ne sont pas ventilés. Ce n’est pas une réconciliation exacte du rapport Shopify.</p>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
              <Kpi k="aov" cur={cur.kpi} prev={prev.kpi} color={C.shop} />
              <Kpi k="roas" cur={cur.kpi} prev={prev.kpi} color={C.m} note="Valeur attribuée par les régies ÷ dépenses (≠ CA)" />
              <Kpi k="sessions" cur={cur.kpi} prev={prev.kpi} color={C.ga} />
              <Kpi k="cr" cur={cur.kpi} prev={prev.kpi} color={C.shop} note={crNote} />
              <Kpi k="cr_ga" cur={cur.kpi} prev={prev.kpi} color={C.ga} note="Achats GA4 ÷ sessions (sous-estimé : cookies)" />
            </div>

            <TrendChart title="CA Shopify et dépenses publicitaires" unit="en €" data={chartSeries} cmp={overlay} cmpLabel={cmpLabel} fx={fx} yl={axEur} daily={eg === 'day'} canZoom={canZoom} onZoom={zoom} h={300} note={zoomHint}
              defs={[{ k: 'revenue', l: 'CA total HT · base MER', color: C.shop, f: eur, on: true }, { k: 'spend', l: 'Dépenses totales', color: C.ink, f: eur, on: true },
                { k: 'netSales', l: 'Ventes nettes HT estimées', color: C.shop, f: eur, dash: true }, { k: 'shipping', l: 'Livraison importée', color: C.ga, f: eur }, { k: 'g', l: 'Google Ads', color: C.g, f: eur }, { k: 'm', l: 'Meta Ads', color: C.m, f: eur }, { k: 'aov', l: 'Panier moyen', color: C.shop, f: eur, dash: true }]} />
            <div className="grid gap-4 lg:grid-cols-3">
              <TrendChart title="MER global et ROAS attribué" unit="multiplicateur ×" data={chartSeries} cmp={overlay} cmpLabel={cmpLabel} fx={fx} yl={axX} daily={eg === 'day'} canZoom={canZoom} onZoom={zoom}
                note="MER = CA total HT, livraison incluse ÷ dépenses. ROAS = valeur attribuée par la régie ÷ ses dépenses."
                defs={[{ k: 'mer', l: 'MER global', color: C.mer, f: dec, on: true }, { k: 'roas', l: 'ROAS attribué', color: C.ink, f: dec, on: true, dash: true },
                  { k: 'roas_g', l: 'ROAS Google', color: C.g, f: dec }, { k: 'roas_m', l: 'ROAS Meta', color: C.m, f: dec }]} />
              <TrendChart title="Sessions et commandes" unit="volumes" data={chartSeries} cmp={overlay} cmpLabel={cmpLabel} fx={fx} yl={axInt} yr={axInt} daily={eg === 'day'} canZoom={canZoom} onZoom={zoom}
                note="Axe gauche : sessions · axe droit : commandes."
                defs={[{ k: 'sessions', l: 'Sessions GA4', color: C.ga, f: int, on: true }, { k: 'orders', l: 'Commandes Shopify', color: C.shop, f: int, on: true, axis: 'r' }]} />
              <TrendChart title="Ratio Shopify / GA4 et taux GA4" unit="en %" data={chartSeries} cmp={overlay} cmpLabel={cmpLabel} fx={fx} yl={axPct} daily={eg === 'day'} canZoom={canZoom} onZoom={zoom}
                note={gaFiltered ? 'Avec filtre canal/appareil, seul le taux GA4 est cohérent.' : 'Ratio intersources, pas un taux de conversion Shopify : méthodes de mesure Shopify et GA4 différentes.'}
                defs={[{ k: 'cr', l: 'Ratio commandes Shopify / sessions GA4', color: C.shop, f: pct, on: !gaFiltered }, { k: 'cr_ga', l: 'Achats GA4 ÷ sessions', color: C.ga, f: pct, on: true }]} />
            </div>
          </TabsContent>

          <TabsContent value="acq" className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              {(['g', 'm'] as const).map((s) => (
                <Card key={s} style={{ borderTop: `3px solid ${C[s]}` }}>
                  <CardHeader className="pb-2"><CardTitle className="text-base">{SRC[s]}</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-3 gap-2 text-sm">
                    <div><div className="text-xs text-muted-foreground">Dépenses</div><div className="font-semibold">{eur(cur.t[s])}</div><Delta cur={cur.t[s]} prev={prev.t[s]} invert /></div>
                    <div><div className="text-xs text-muted-foreground">Part des dépenses</div><div className="font-semibold">{pct(div(cur.t[s], cur.t.spend))}</div></div>
                    <div><div className="text-xs text-muted-foreground">ROAS attribué</div><div className="font-semibold">{dec(div(cur.t[`${s}v`], cur.t[s]))}</div><Delta cur={div(cur.t[`${s}v`], cur.t[s])} prev={div(prev.t[`${s}v`], prev.t[s])} /></div>
                  </CardContent>
                </Card>))}
            </div>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Dépenses Google vs Meta</CardTitle></CardHeader>
              <CardContent><ChartBox>
                <BarChart data={chartSeries}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="b" tick={tick} tickFormatter={fmtMonth} /><YAxis tick={tick} />
                  <Tooltip {...tip} formatter={(v: any) => eur(v)} /><Legend /><Bar dataKey="g" name="Google Ads" stackId="a" fill={C.g} /><Bar dataKey="m" name="Meta Ads" stackId="a" fill={C.m} /></BarChart>
              </ChartBox></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Trafic GA4 par canal</CardTitle></CardHeader>
              <CardContent>
                <ChartBox h={260}>
                  <BarChart data={Object.values(cur.byChannel).sort((a: any, b: any) => b.sessions - a.sessions)} layout="vertical" margin={{ left: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis type="number" tick={tick} /><YAxis type="category" dataKey="k" tick={tick} width={110} />
                    <Tooltip {...tip} /><Bar dataKey="sessions" name="Sessions" fill={C.ga} /></BarChart>
                </ChartBox>
                <p className="text-xs text-muted-foreground">Achats et revenus GA4 = attribués par GA4, jamais ajoutés au CA Shopify.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="country" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
                <CardTitle className="text-base">Comparaison des marchés</CardTitle>
                <MultiPick label="Comparer" options={countryOpts} value={cmpCountries} onChange={setCmpCountries} />
              </CardHeader>
              <CardContent>
                <ChartBox>
                  <BarChart data={Object.values(cur.byCountry).filter((x: any) => cmpCountries.length ? cmpCountries.includes(x.c) : true).sort((a: any, b: any) => b.revenue - a.revenue).slice(0, cmpCountries.length || 12)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="c" tick={tick} /><YAxis tick={tick} />
                    <Tooltip {...tip} formatter={(v: any) => eur(v)} /><Legend /><Bar dataKey="revenue" name="CA total Shopify HT" fill={C.shop} /><Bar dataKey="spend" name="Dépenses Ads" fill={C.g} /></BarChart>
                </ChartBox>
              </CardContent>
            </Card>
            <Card><CardContent className="pt-6">
              <SortTable initial="revenue" rows={Object.values(cur.byCountry).map((x: any) => ({ ...x, mer: div(x.revenue, x.spend), cr: div(x.orders, x.sessions), d: (() => { const p = prev.byCountry[x.c]; return p?.revenue ? (x.revenue - p.revenue) / p.revenue : null; })() }))}
                cols={[{ k: 'c', l: 'Pays' }, { k: 'revenue', l: 'CA total Shopify HT', f: eur, num: true }, { k: 'd', l: 'Var. CA', f: pct, num: true }, { k: 'orders', l: 'Commandes', f: int, num: true },
                  { k: 'spend', l: 'Dépenses Ads', f: eur, num: true }, { k: 'mer', l: 'MER pays', f: dec, num: true }, { k: 'sessions', l: 'Sessions', f: int, num: true }, { k: 'cr', l: 'Ratio commandes Shopify / sessions GA4', f: pct, num: true }]} />
              <p className="mt-2 text-xs text-muted-foreground">Dépenses par pays = ventilation par pays des régies (part sans pays connu exclue), donc leur somme peut être légèrement inférieure au total.</p>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="camp" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
                <CardTitle className="text-base">Comparer des campagnes (dépenses par {G_L[eg]})</CardTitle>
                <MultiPick label="Campagnes" options={campOpts} value={cmpCamps} onChange={setCmpCamps} />
              </CardHeader>
              <CardContent>{cmpCamps.length === 0 ? <p className="text-sm text-muted-foreground">Sélectionnez une ou plusieurs campagnes à comparer.</p> : (
                <ChartBox>
                  <LineChart data={(() => {
                    const m: Record<string, any> = {};
                    for (const [s, b, id, sp] of raw!.ads) { const k = `${s}:${id}`; if (b >= cFrom && b <= to && cmpCamps.includes(k)) { const bk = keyOf(b); (m[bk] ??= { b: bk })[k] = (m[bk][k] ?? 0) + +sp; } }
                    return Object.values(m).sort((a: any, b: any) => (a.b < b.b ? -1 : 1));
                  })()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="b" tick={tick} tickFormatter={fmtMonth} /><YAxis tick={tick} />
                    <Tooltip {...tip} formatter={(v: any, n: any) => [eur(v), campName.get(n) ?? n]} /><Legend formatter={(n) => campName.get(n) ?? n} />
                    {cmpCamps.map((k, i) => <Line key={k} dataKey={k} stroke={PALETTE[i % PALETTE.length]} dot={false} strokeWidth={2} connectNulls />)}
                  </LineChart>
                </ChartBox>)}</CardContent>
            </Card>
            <Card><CardContent className="pt-6">
              <SortTable initial="spend" rows={Object.values(cur.byCamp).filter((k: any) => k.spend || k.impr).map((k: any) => ({ ...k, src: SRC[k.s], name: campName.get(k.key) ?? k.id, roas: div(k.value, k.spend), cpa: div(k.spend, k.conv), cpc: div(k.spend, k.clicks),
                d: (() => { const p = prev.byCamp[k.key]; return p?.spend ? (k.spend - p.spend) / p.spend : null; })() }))}
                cols={[{ k: 'src', l: 'Régie' }, { k: 'name', l: 'Campagne' }, { k: 'spend', l: 'Dépenses', f: eur, num: true }, { k: 'd', l: 'Var.', f: pct, num: true }, { k: 'clicks', l: 'Clics', f: int, num: true },
                  { k: 'cpc', l: 'CPC', f: (v) => (v == null ? '—' : v.toFixed(2) + ' €'), num: true }, { k: 'conv', l: 'Conv. attribuées', f: (v) => Number(v).toFixed(0), num: true },
                  { k: 'value', l: 'Valeur attribuée', f: eur, num: true }, { k: 'roas', l: 'ROAS', f: dec, num: true }, { k: 'cpa', l: 'CPA attribué', f: (v) => (v == null ? '—' : eur(v)), num: true }]} />
              <p className="mt-2 text-xs text-muted-foreground">Conversions et valeurs = attribuées par chaque régie (fenêtres différentes, recoupements possibles). Elles ne sont pas du CA.</p>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="prod" className="space-y-4">
            <ProductsView raw={raw!} countries={f.countries} />
          </TabsContent>

          <TabsContent value="funnel" className="space-y-4">
            <FunnelView cur={cur.t} prev={prev.t} />
          </TabsContent>

          <TabsContent value="ai">
            <AiDiagnosis summary={aiSummary} from={cFrom} to={to} filters={f} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function ProductsView({ raw, countries }: { raw: Raw; countries: string[] }) {
  const rows = useMemo(() => {
    const set = new Set(countries); const m: Record<string, any> = {};
    for (const [p, t, c, r, q] of raw.products) if (!set.size || set.has(c)) {
      const x = (m[t] ??= { t, r: 0, q: 0, pr: 0, pq: 0 });
      if (p === 1) { x.r += +r; x.q += +q; } else { x.pr += +r; x.pq += +q; }
    }
    return Object.values(m).map((x: any) => ({ ...x, d: x.pr ? (x.r - x.pr) / x.pr : null, delta: x.r - x.pr }));
  }, [raw, countries]);
  const up = [...rows].sort((a, b) => b.delta - a.delta).slice(0, 5).filter((x) => x.delta > 0);
  const down = [...rows].sort((a, b) => a.delta - b.delta).slice(0, 5).filter((x) => x.delta < 0);
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">En hausse</CardTitle></CardHeader><CardContent className="space-y-1 text-sm">
          {up.length ? up.map((x) => <div key={x.t} className="flex justify-between gap-2"><span className="truncate">{x.t}</span><span className="text-primary whitespace-nowrap">+{eur(x.delta)}</span></div>) : <p className="text-muted-foreground">—</p>}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">En baisse</CardTitle></CardHeader><CardContent className="space-y-1 text-sm">
          {down.length ? down.map((x) => <div key={x.t} className="flex justify-between gap-2"><span className="truncate">{x.t}</span><span className="text-destructive whitespace-nowrap">{eur(x.delta)}</span></div>) : <p className="text-muted-foreground">—</p>}</CardContent></Card>
      </div>
      <Card><CardContent className="pt-6">
        <SortTable initial="r" rows={rows} cols={[{ k: 't', l: 'Produit' }, { k: 'r', l: 'CA net HT', f: eur, num: true }, { k: 'q', l: 'Quantité', f: int, num: true },
          { k: 'pr', l: 'CA période préc.', f: eur, num: true }, { k: 'd', l: 'Var.', f: pct, num: true }]} />
        <p className="mt-2 text-xs text-muted-foreground">Ventes Shopify réelles par ligne produit (hors livraison). Filtre pays appliqué ; campagnes, canal et appareil non applicables.</p>
      </CardContent></Card>
    </>
  );
}

function FunnelView({ cur, prev }: { cur: any; prev: any }) {
  const steps = [['vi', 'Vues produit'], ['ac', 'Ajouts au panier'], ['bc', 'Passages au paiement'], ['pu', 'Achats GA4']] as const;
  const max = cur.vi || 1;
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Tunnel de conversion GA4</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        {steps.map(([k, l], i) => {
          const rate = i ? div(cur[k], cur[steps[i - 1][0]]) : null;
          const prate = i ? div(prev[k], prev[steps[i - 1][0]]) : null;
          return (
            <div key={k}>
              <div className="mb-1 flex justify-between gap-2"><span>{l}</span><span className="whitespace-nowrap">{int(cur[k])} {i > 0 && <span className="text-muted-foreground">· {pct(rate)} de l'étape préc.</span>} <Delta cur={i ? rate : cur[k]} prev={i ? prate : prev[k]} /></span></div>
              <div className="h-3 rounded bg-muted"><div className="h-3 rounded" style={{ width: `${Math.max(1, (cur[k] / max) * 100)}%`, background: C.ga }} /></div>
            </div>);
        })}
        <p className="text-xs text-muted-foreground">Sessions : {int(cur.sessions)} · achats GA4 / sessions : {pct(div(cur.pu, cur.sessions))}. Les achats GA4 ({eur(cur.pr)} attribués) sont sous-estimés (cookies refusés) et ne remplacent pas les commandes Shopify.</p>
      </CardContent>
    </Card>
  );
}
