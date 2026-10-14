import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const CH_LABEL: Record<string, string> = { B2C: 'B2C', B2B: 'B2B', OEM: 'OEM', A_CLASSER: 'À classer' };
const eur = (v: number | null | undefined) => v == null ? '—' : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
const nb = (v: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(v);
const pctf = (v: number | null) => v == null ? '—' : `${(v * 100).toFixed(1)} %`;

type BRow = { channel: string; country: string; key: string; label: string; ca_ht: number; prod_ht: number; qty: number; cogs: number; cov_ht: number; est_ht: number };
type Agg = { key: string; label: string; ca_ht: number; qty: number; prod_ht: number; cogs: number; cov_ht: number; est_ht: number };

/** Margin on costed lines only; missing cost never counts as zero. */
const marginOf = (r: Agg) => { const m = r.cov_ht - r.cogs; return { m: r.cov_ht ? m : null, pct: r.cov_ht ? m / r.cov_ht : null, cov: r.prod_ht ? r.cov_ht / r.prod_ht : null, inc: Math.abs(r.prod_ht - r.cov_ht) > 0.5, est: r.est_ht > 0.5 }; };

/** Channel → delivery country → product drill-down (product lines only, shipping excluded). */
export function SalesBreakdown({ from, to, search }: { from: string; to: string; search: string }) {
  const [rows, setRows] = useState<BRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ch, setCh] = useState('all');
  const [cc, setCc] = useState('all');
  useEffect(() => {
    let live = true; setLoading(true); setErr(null);
    supabase.rpc('sales_breakdown' as any, { _from: from, _to: to }).then(({ data, error }) => {
      if (!live) return; if (error) setErr(error.message); setRows((data as any) ?? []); setLoading(false);
    });
    return () => { live = false; };
  }, [from, to]);
  const agg = (rs: BRow[], k: (r: BRow) => string) => Object.values(rs.reduce((m: Record<string, Agg>, r) => {
    const key = k(r); const o = m[key] ?? (m[key] = { key, label: key, ca_ht: 0, qty: 0, prod_ht: 0, cogs: 0, cov_ht: 0, est_ht: 0 });
    o.ca_ht += r.ca_ht; o.qty += r.qty; o.prod_ht += r.prod_ht; o.cogs += r.cogs; o.cov_ht += r.cov_ht; o.est_ht += r.est_ht; return m;
  }, {})).sort((a, b) => b.ca_ht - a.ca_ht);
  const inCh = rows.filter((r) => ch === 'all' || r.channel === ch);
  const chans = agg(rows, (r) => r.channel);
  const countries = agg(inCh, (r) => r.country);
  const inCc = inCh.filter((r) => cc === 'all' || r.country === cc);
  const names = new Map(inCc.map((r) => [r.key, r.label]));
  const q = search.trim().toLowerCase();
  const prods = agg(inCc, (r) => r.key).map((r) => ({ ...r, label: names.get(r.key) || r.key })).filter((r) => !q || r.label.toLowerCase().includes(q));
  const chip = (active: boolean, onClick: () => void, label: string, v: number) => (
    <Button key={label} size="sm" variant={active ? 'default' : 'outline'} onClick={onClick} className="h-7">{label} <span className="ml-1 opacity-70 tabular-nums">{eur(v)}</span></Button>);
  return (
    <div className="space-y-3">
      {err && <p className="text-sm text-destructive">{err}</p>}
      <div className="flex flex-wrap items-center gap-2"><span className="w-20 text-xs text-muted-foreground">1. Canal</span>
        {chip(ch === 'all', () => { setCh('all'); setCc('all'); }, 'Tous', chans.reduce((a, r) => a + r.ca_ht, 0))}
        {chans.map((r) => chip(ch === r.key, () => { setCh(r.key); setCc('all'); }, CH_LABEL[r.key] ?? r.key, r.ca_ht))}
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}</div>
      <div className="flex flex-wrap items-center gap-2"><span className="w-20 text-xs text-muted-foreground">2. Pays livré</span>
        {chip(cc === 'all', () => setCc('all'), 'Tous', countries.reduce((a, r) => a + r.ca_ht, 0))}
        {countries.slice(0, 20).map((r) => chip(cc === r.key, () => setCc(r.key), r.key === '?' ? 'Inconnu' : r.key, r.ca_ht))}</div>
      {prods.length > 0 && (
        <div className="h-64"><ResponsiveContainer width="100%" height="100%">
          <BarChart data={prods.slice(0, 15).map((p) => ({ n: p.label.slice(0, 20), ca: p.ca_ht, m: marginOf(p).m ?? 0 }))} margin={{ bottom: 50 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="n" interval={0} angle={-30} textAnchor="end" tick={{ fontSize: 10 }} />
            <YAxis tickFormatter={(v) => `${Math.round(v / 1000)} k€`} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number, n: string) => [eur(v), n === 'ca' ? 'CA HT' : 'Marge']} />
            <Bar dataKey="ca" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
            <Bar dataKey="m" fill="hsl(var(--chart-2, 160 60% 40%))" radius={[3, 3, 0, 0]} />
          </BarChart></ResponsiveContainer></div>)}
      <p className="text-xs text-muted-foreground">3. Produits {ch === 'all' ? 'tous canaux' : CH_LABEL[ch] ?? ch} · {cc === 'all' ? 'tous pays' : cc} — {prods.length} produits, hors livraison. Pays = pays de livraison Erplain.</p>
      <Table><TableHeader><TableRow><TableHead>Produit</TableHead><TableHead className="text-right">CA HT</TableHead><TableHead className="text-right">Qté</TableHead><TableHead className="text-right">Coût vendu</TableHead><TableHead className="text-right">Marge</TableHead><TableHead className="text-right">Marge %</TableHead><TableHead className="text-right">Couverture</TableHead></TableRow></TableHeader>
        <TableBody>{prods.slice(0, 300).map((r) => { const x = marginOf(r); return (
          <TableRow key={r.key}><TableCell className="max-w-[320px] truncate">{r.label}</TableCell><TableCell className="text-right tabular-nums">{eur(r.ca_ht)}</TableCell><TableCell className="text-right tabular-nums">{nb(r.qty)}</TableCell>
            <TableCell className="text-right tabular-nums">{eur(r.cogs)}</TableCell><TableCell className="text-right tabular-nums">{eur(x.m)}{x.est && <span className="text-muted-foreground"> est.</span>}</TableCell>
            <TableCell className="text-right tabular-nums">{pctf(x.pct)}</TableCell><TableCell className={`text-right tabular-nums ${x.inc ? 'text-destructive' : ''}`}>{pctf(x.cov)}{x.inc ? ' · incomplet' : ''}</TableCell></TableRow>); })}</TableBody></Table>
    </div>
  );
}
