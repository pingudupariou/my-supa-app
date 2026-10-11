import { useEffect, useMemo, useState } from 'react';
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
import { ArrowDown, ArrowUp, ChevronDown, Loader2 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const sb = supabase as any;
const C = { shop: 'hsl(var(--mi-shopify))', g: 'hsl(var(--mi-google))', m: 'hsl(var(--mi-meta))', ga: 'hsl(var(--mi-ga4))', mer: 'hsl(var(--mi-mer))' };
const PALETTE = [C.shop, C.g, C.m, C.ga, C.mer, 'hsl(var(--primary))', 'hsl(var(--muted-foreground))'];
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addD = (s: string, n: number) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const diffD = (a: string, b: string) => Math.round((new Date(b + 'T00:00:00Z').getTime() - new Date(a + 'T00:00:00Z').getTime()) / 86400000);
const monday = (s: string) => { const d = new Date(s + 'T00:00:00Z'); return addD(s, -((d.getUTCDay() + 6) % 7)); };
const eur = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n) || 0);
const int = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(n) || 0);
const dec = (n: number | null) => (n == null || !isFinite(n) ? '—' : n.toFixed(2));
const pct = (n: number | null) => (n == null || !isFinite(n) ? '—' : `${(n * 100).toFixed(1)} %`);
const div = (a: number, b: number) => (b ? a / b : null);
const SRC: Record<string, string> = { g: 'Google Ads', m: 'Meta Ads' };

type Raw = { week: boolean; shop: any[]; products: any[]; campaigns: any[]; ads: any[]; ads_country: any[]; ga4: any[] };
type F = { countries: string[]; campaigns: string[]; adSrc: 'all' | 'g' | 'm'; channel: string; device: string };

const METRICS = {
  revenue: { l: 'CA Shopify (réel)', f: eur, color: C.shop },
  orders: { l: 'Commandes', f: int, color: C.shop },
  spend: { l: 'Dépenses Ads', f: eur, color: C.g },
  mer: { l: 'MER', f: dec, color: C.mer },
  roas: { l: 'ROAS attribué', f: dec, color: C.m },
  sessions: { l: 'Sessions GA4', f: int, color: C.ga },
  cr: { l: 'Taux de conversion', f: pct, color: C.ga },
  aov: { l: 'Panier moyen', f: eur, color: C.shop },
} as const;
type MK = keyof typeof METRICS;

/** Aggregates one period from the single payload, applying filters client-side. */
function aggregate(raw: Raw, from: string, to: string, f: F) {
  const inR = (b: string) => b >= from && b <= to;
  const cSet = new Set(f.countries), kSet = new Set(f.campaigns);
  const okC = (c: string) => !cSet.size || cSet.has(c);
  const okK = (s: string, id: string) => (f.adSrc === 'all' || f.adSrc === s) && (!kSet.size || kSet.has(`${s}:${id}`));
  const days: Record<string, any> = {};
  const day = (b: string) => (days[b] ??= { b, revenue: 0, orders: 0, spend: 0, g: 0, m: 0, value: 0, sessions: 0 });
  const t = { revenue: 0, orders: 0, spend: 0, g: 0, m: 0, value: 0, gv: 0, mv: 0, conv: 0, clicks: 0, impr: 0, sessions: 0, vi: 0, ac: 0, bc: 0, pu: 0, pr: 0 };
  const byCountry: Record<string, any> = {};
  const cty = (c: string) => (byCountry[c] ??= { c, revenue: 0, orders: 0, spend: 0, value: 0, sessions: 0, pu: 0 });
  for (const [b, c, r, n] of raw.shop) if (inR(b) && okC(c)) { t.revenue += +r; t.orders += +n; day(b).revenue += +r; day(b).orders += +n; cty(c).revenue += +r; cty(c).orders += +n; }
  // Ads totals: campaign table when no country filter, else country breakdown (part without country excluded).
  const byCamp: Record<string, any> = {};
  const camp = (s: string, id: string) => (byCamp[`${s}:${id}`] ??= { key: `${s}:${id}`, s, id, spend: 0, clicks: 0, impr: 0, conv: 0, value: 0 });
  if (!cSet.size) {
    for (const [s, b, id, sp, cl, im, cv, v] of raw.ads) if (inR(b) && okK(s, id)) {
      t.spend += +sp; t[s as 'g'] += +sp; t.value += +v; t[(s + 'v') as 'gv'] += +v; t.conv += +cv; t.clicks += +cl; t.impr += +im;
      const d = day(b); d.spend += +sp; d[s] += +sp; d.value += +v;
      const k = camp(s, id); k.spend += +sp; k.clicks += +cl; k.impr += +im; k.conv += +cv; k.value += +v;
    }
  }
  for (const [s, b, id, c, sp, cl, cv, v] of raw.ads_country) if (inR(b) && okK(s, id) && okC(c)) {
    const x = cty(c); x.spend += +sp; x.value += +v;
    if (cSet.size) {
      t.spend += +sp; t[s as 'g'] += +sp; t.value += +v; t[(s + 'v') as 'gv'] += +v; t.conv += +cv; t.clicks += +cl;
      const d = day(b); d.spend += +sp; d[s] += +sp; d.value += +v;
      const k = camp(s, id); k.spend += +sp; k.clicks += +cl; k.conv += +cv; k.value += +v;
    }
  }
  const byChannel: Record<string, any> = {}, byDevice: Record<string, any> = {};
  for (const [b, ch, c, dv, se, vi, ac, bc, pu, pr] of raw.ga4) if (inR(b) && okC(c) && (!f.channel || f.channel === ch) && (!f.device || f.device === dv)) {
    t.sessions += +se; t.vi += +vi; t.ac += +ac; t.bc += +bc; t.pu += +pu; t.pr += +pr; day(b).sessions += +se;
    cty(c).sessions += +se; cty(c).pu += +pu;
    (byChannel[ch] ??= { k: ch, sessions: 0, pu: 0, pr: 0 }); byChannel[ch].sessions += +se; byChannel[ch].pu += +pu; byChannel[ch].pr += +pr;
    (byDevice[dv] ??= { k: dv, sessions: 0, pu: 0 }); byDevice[dv].sessions += +se; byDevice[dv].pu += +pu;
  }
  const series = Object.values(days).sort((a: any, b: any) => (a.b < b.b ? -1 : 1)).map((d: any) => ({
    ...d, mer: div(d.revenue, d.spend), roas: div(d.value, d.spend), cr: div(d.orders, d.sessions), aov: div(d.revenue, d.orders),
  }));
  const kpi: Record<MK, number | null> = {
    revenue: t.revenue, orders: t.orders, spend: t.spend, mer: div(t.revenue, t.spend), roas: div(t.value, t.spend),
    sessions: t.sessions, cr: div(t.orders, t.sessions), aov: div(t.revenue, t.orders),
  };
  return { t, kpi, series, byCountry, byCamp, byChannel, byDevice };
}

/** Regroups a daily series into monthly buckets (sums + recomputed ratios). */
function byMonth(series: any[]) {
  const m: Record<string, any> = {};
  for (const d of series) {
    const k = d.b.slice(0, 7);
    const x = (m[k] ??= { b: k, revenue: 0, orders: 0, spend: 0, g: 0, m: 0, value: 0, sessions: 0 });
    x.revenue += d.revenue; x.orders += d.orders; x.spend += d.spend; x.g += d.g; x.m += d.m; x.value += d.value; x.sessions += d.sessions;
  }
  return Object.values(m).sort((a: any, b: any) => (a.b < b.b ? -1 : 1)).map((x: any) => ({
    ...x, mer: div(x.revenue, x.spend), roas: div(x.value, x.spend), cr: div(x.orders, x.sessions), aov: div(x.revenue, x.orders),
  }));
}
const fmtMonth = (b: string) => (b.length === 7 ? new Date(b + '-01T00:00:00Z').toLocaleDateString('fr-FR', { month: 'short', year: '2-digit', timeZone: 'UTC' }) : b);

function MultiPick({ label, options, value, onChange }: { label: string; options: { v: string; l: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  const [q, setQ] = useState('');
  const shown = options.filter((o) => o.l.toLowerCase().includes(q.toLowerCase())).slice(0, 200);
  return (
    <Popover>
      <PopoverTrigger asChild><Button variant="outline" size="sm" className="h-9">{label}{value.length ? ` (${value.length})` : ' : tous'}<ChevronDown className="ml-1 h-4 w-4" /></Button></PopoverTrigger>
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

function Delta({ cur, prev, invert }: { cur: number | null; prev: number | null; invert?: boolean }) {
  if (cur == null || prev == null || !prev) return <span className="text-xs text-muted-foreground">—</span>;
  const d = (cur - prev) / Math.abs(prev);
  const good = invert ? d < 0 : d > 0;
  return <span className={`inline-flex items-center text-xs font-medium ${good ? 'text-primary' : 'text-destructive'}`}>{d >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}{Math.abs(d * 100).toFixed(1)} %</span>;
}

function Kpi({ k, cur, prev, note, color }: { k: MK; cur: any; prev: any; note?: string; color: string }) {
  return (
    <div className="rounded-lg border bg-card p-3" style={{ borderLeft: `3px solid ${color}` }}>
      <div className="text-xs text-muted-foreground">{METRICS[k].l}</div>
      <div className="text-xl font-semibold">{METRICS[k].f(cur[k])}</div>
      <div className="flex items-center justify-between gap-2"><Delta cur={cur[k]} prev={prev[k]} />{note && <span className="text-[10px] text-muted-foreground truncate">{note}</span>}</div>
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
const tip = { contentStyle: { background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', fontSize: 12 } };

export function MarketingCockpit() {
  const today = iso(new Date());
  const [preset, setPreset] = useState('30');
  const [from, setFrom] = useState(addD(today, -29));
  const [to, setTo] = useState(today);
  const [raw, setRaw] = useState<Raw | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [f, setF] = useState<F>({ countries: [], campaigns: [], adSrc: 'all', channel: '', device: '' });
  const [shown, setShown] = useState<MK[]>(['revenue', 'spend', 'mer']);
  const [cmpCountries, setCmpCountries] = useState<string[]>([]);
  const [cmpCamps, setCmpCamps] = useState<string[]>([]);
  const [gran, setGran] = useState<'day' | 'month'>('day');

  useEffect(() => { if (preset !== 'custom') { setFrom(addD(today, -(Number(preset) - 1))); setTo(today); } }, [preset, today]);

  // Periods: weekly buckets when the total range exceeds 200 days (same rule as the server).
  const span = diffD(from, to) + 1;
  const weekly = 2 * span > 201;
  const cFrom = weekly ? monday(from) : from;
  const len = diffD(cFrom, to) + 1;
  const pFrom = weekly ? addD(cFrom, -Math.ceil(len / 7) * 7) : addD(cFrom, -len);
  const pTo = addD(cFrom, -1);

  useEffect(() => {
    if (from > to) return;
    let off = false; setLoading(true); setErr('');
    sb.rpc('marketing_cockpit', { _from: pFrom, _to: to, _split: cFrom }).then(({ data, error }: any) => {
      if (off) return; setLoading(false);
      if (error) setErr(error.message); else setRaw(data);
    });
    return () => { off = true; };
  }, [pFrom, cFrom, to, from]);

  const campName = useMemo(() => new Map((raw?.campaigns ?? []).map(([s, id, n]: any) => [`${s}:${id}`, n ?? id])), [raw]);
  const cur = useMemo(() => raw && aggregate(raw, cFrom, to, f), [raw, cFrom, to, f]);
  const prev = useMemo(() => raw && aggregate(raw, pFrom, pTo, f), [raw, pFrom, pTo, f]);
  const chartSeries = useMemo(() => (cur ? (gran === 'month' ? byMonth(cur.series) : cur.series) : []), [cur, gran]);
  const all = useMemo(() => raw && aggregate(raw, cFrom, to, { countries: [], campaigns: [], adSrc: 'all', channel: '', device: '' }), [raw, cFrom, to]);

  const countryOpts = useMemo(() => Object.values(all?.byCountry ?? {}).sort((a: any, b: any) => b.revenue + b.spend - a.revenue - a.spend).map((x: any) => ({ v: x.c, l: x.c })), [all]);
  const campOpts = useMemo(() => Object.values(all?.byCamp ?? {}).filter((k: any) => k.spend > 0).sort((a: any, b: any) => b.spend - a.spend).map((k: any) => ({ v: k.key, l: `${SRC[k.s]} · ${campName.get(k.key) ?? k.id}` })), [all, campName]);
  const channels = useMemo(() => Object.keys(all?.byChannel ?? {}).sort(), [all]);
  const devices = useMemo(() => Object.keys(all?.byDevice ?? {}).sort(), [all]);

  const adsFiltered = f.campaigns.length > 0 || f.adSrc !== 'all';
  const gaFiltered = !!f.channel || !!f.device;
  const merNote = adsFiltered ? 'MER partiel : CA total ÷ dépenses filtrées' : 'CA Shopify ÷ (Google + Meta)';

  return (
    <div className="space-y-4">
      {/* Global filters */}
      <div className="sticky top-0 z-20 -mx-1 rounded-lg border bg-background/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={preset} onValueChange={setPreset}>
            <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 jours</SelectItem><SelectItem value="30">30 jours</SelectItem><SelectItem value="90">3 mois</SelectItem>
              <SelectItem value="182">6 mois</SelectItem><SelectItem value="365">12 mois</SelectItem><SelectItem value="custom">Personnalisée</SelectItem>
            </SelectContent>
          </Select>
          {preset === 'custom' && <><Input type="date" className="h-9 w-36" value={from} onChange={(e) => setFrom(e.target.value)} /><Input type="date" className="h-9 w-36" value={to} max={today} onChange={(e) => setTo(e.target.value)} /></>}
          <MultiPick label="Pays" options={countryOpts} value={f.countries} onChange={(v) => setF({ ...f, countries: v })} />
          <Select value={f.adSrc} onValueChange={(v) => setF({ ...f, adSrc: v as F['adSrc'] })}>
            <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Google + Meta</SelectItem><SelectItem value="g">Google Ads seul</SelectItem><SelectItem value="m">Meta Ads seul</SelectItem></SelectContent>
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
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        <div className="mt-2 flex flex-wrap gap-1 text-xs text-muted-foreground">
          <span>Du {cFrom} au {to} · comparé au {pFrom} → {pTo}{weekly ? ' · par semaine' : ''}</span>
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
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Kpi k="revenue" cur={cur.kpi} prev={prev.kpi} color={C.shop} note="réel · référence" />
              <Kpi k="orders" cur={cur.kpi} prev={prev.kpi} color={C.shop} />
              <Kpi k="aov" cur={cur.kpi} prev={prev.kpi} color={C.shop} />
              <Kpi k="spend" cur={cur.kpi} prev={prev.kpi} color={C.g} note={`G ${eur(cur.t.g)} · M ${eur(cur.t.m)}`} />
              <Kpi k="mer" cur={cur.kpi} prev={prev.kpi} color={C.mer} note={merNote} />
              <Kpi k="roas" cur={cur.kpi} prev={prev.kpi} color={C.m} note="attribué, ≠ CA" />
              <Kpi k="sessions" cur={cur.kpi} prev={prev.kpi} color={C.ga} />
              <Kpi k="cr" cur={cur.kpi} prev={prev.kpi} color={C.ga} note="commandes Shopify ÷ sessions" />
            </div>
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
                <CardTitle className="text-base">Évolution</CardTitle>
                <div className="flex flex-wrap gap-1">{(Object.keys(METRICS) as MK[]).map((k) => (
                  <Button key={k} size="sm" variant={shown.includes(k) ? 'default' : 'outline'} className="h-7 text-xs"
                    onClick={() => setShown(shown.includes(k) ? shown.filter((x) => x !== k) : [...shown, k])}>{METRICS[k].l}</Button>))}</div>
              </CardHeader>
              <CardContent>
                <ChartBox h={320}>
                  <LineChart data={cur.series}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="b" tick={tick} />
                    <YAxis yAxisId="eur" tick={tick} />
                    <YAxis yAxisId="r" orientation="right" tick={tick} />
                    <YAxis yAxisId="n" orientation="right" tick={tick} width={45} />
                    <YAxis yAxisId="p" hide />
                    <Tooltip {...tip} formatter={(v: any, n: any) => [METRICS[n as MK]?.f(v) ?? v, METRICS[n as MK]?.l ?? n]} />
                    <Legend formatter={(n) => METRICS[n as MK]?.l ?? n} />
                    {shown.map((k, i) => <Line key={k} type="monotone" dataKey={k} yAxisId={k === 'cr' ? 'p' : ['mer', 'roas'].includes(k) ? 'r' : ['orders', 'sessions'].includes(k) ? 'n' : 'eur'} stroke={PALETTE[i % PALETTE.length]} dot={false} strokeWidth={2} connectNulls />)}
                  </LineChart>
                </ChartBox>
                <p className="mt-2 text-xs text-muted-foreground">Axe de gauche : montants en €. Axes de droite : ratios (MER, ROAS, taux) et volumes (commandes, sessions), chacun à sa propre échelle.</p>
              </CardContent>
            </Card>
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
                <BarChart data={cur.series}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="b" tick={tick} /><YAxis tick={tick} />
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
                    <Tooltip {...tip} formatter={(v: any) => eur(v)} /><Legend /><Bar dataKey="revenue" name="CA Shopify (réel)" fill={C.shop} /><Bar dataKey="spend" name="Dépenses Ads" fill={C.g} /></BarChart>
                </ChartBox>
              </CardContent>
            </Card>
            <Card><CardContent className="pt-6">
              <SortTable initial="revenue" rows={Object.values(cur.byCountry).map((x: any) => ({ ...x, mer: div(x.revenue, x.spend), cr: div(x.orders, x.sessions), d: (() => { const p = prev.byCountry[x.c]; return p?.revenue ? (x.revenue - p.revenue) / p.revenue : null; })() }))}
                cols={[{ k: 'c', l: 'Pays' }, { k: 'revenue', l: 'CA Shopify', f: eur, num: true }, { k: 'd', l: 'Var. CA', f: pct, num: true }, { k: 'orders', l: 'Commandes', f: int, num: true },
                  { k: 'spend', l: 'Dépenses Ads', f: eur, num: true }, { k: 'mer', l: 'MER pays', f: dec, num: true }, { k: 'sessions', l: 'Sessions', f: int, num: true }, { k: 'cr', l: 'Taux conv.', f: pct, num: true }]} />
              <p className="mt-2 text-xs text-muted-foreground">Dépenses par pays = ventilation par pays des régies (part sans pays connu exclue), donc leur somme peut être légèrement inférieure au total.</p>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="camp" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
                <CardTitle className="text-base">Comparer des campagnes (dépenses par {weekly ? 'semaine' : 'jour'})</CardTitle>
                <MultiPick label="Campagnes" options={campOpts} value={cmpCamps} onChange={setCmpCamps} />
              </CardHeader>
              <CardContent>{cmpCamps.length === 0 ? <p className="text-sm text-muted-foreground">Sélectionnez une ou plusieurs campagnes à comparer.</p> : (
                <ChartBox>
                  <LineChart data={(() => {
                    const m: Record<string, any> = {};
                    for (const [s, b, id, sp] of raw!.ads) { const k = `${s}:${id}`; if (b >= cFrom && b <= to && cmpCamps.includes(k)) { (m[b] ??= { b })[k] = (m[b][k] ?? 0) + +sp; } }
                    return Object.values(m).sort((a: any, b: any) => (a.b < b.b ? -1 : 1));
                  })()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="b" tick={tick} /><YAxis tick={tick} />
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
            <Card><CardContent className="pt-6 text-sm text-muted-foreground">Le diagnostic IA (anomalies, opportunités, actions prioritaires) arrive en phase 2. Il analysera uniquement les chiffres affichés ici, selon les filtres choisis.</CardContent></Card>
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
