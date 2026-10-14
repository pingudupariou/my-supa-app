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
  const [sortKey, setSortKey] = useState('ca_ht');
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const toggleSort = (k: string) => { if (sortKey === k) setSortDir((d) => (d === 1 ? -1 : 1)); else { setSortKey(k); setSortDir(-1); } };
  const sortVal = (r: Agg, extra?: { spend: number; after: number | null }) => {
    const x = marginOf(r);
    switch (sortKey) {
      case 'label': return r.label.toLowerCase();
      case 'qty': return r.qty; case 'cogs': return r.cogs;
      case 'm': return x.m ?? -Infinity; case 'pct': return x.pct ?? -Infinity; case 'cov': return x.cov ?? -Infinity;
      case 'spend': return extra?.spend ?? -Infinity; case 'after': return extra?.after ?? -Infinity;
      default: return r.ca_ht;
    }
  };
  const cmpRows = <T extends { r: Agg; spend?: number; after?: number | null }>(a: T, b: T) => {
    const va = sortVal(a.r, a as any), vb = sortVal(b.r, b as any);
    const c = typeof va === 'string' ? va.localeCompare(vb as string, 'fr') : (va as number) - (vb as number);
    return c * sortDir;
  };
  const Th = ({ k, label, right = true }: { k: string; label: string; right?: boolean }) => (
    <TableHead className={`cursor-pointer select-none ${right ? 'text-right' : ''}`} onClick={() => toggleSort(k)}>
      {label}{sortKey === k ? (sortDir === -1 ? ' ▼' : ' ▲') : ''}
    </TableHead>);
  useEffect(() => {
    let live = true; setLoading(true); setErr(null);
    supabase.rpc('sales_breakdown' as any, { _from: from, _to: to }).then(({ data, error }) => {
      if (!live) return; if (error) setErr(error.message); setRows((data as any) ?? []); setLoading(false);
    });
    return () => { live = false; };
  }, [from, to]);
  const [ads, setAds] = useState<any>(null);
  const [adsErr, setAdsErr] = useState<string | null>(null);
  useEffect(() => {
    if (ch !== 'B2C') return;
    let live = true; setAdsErr(null);
    supabase.rpc('b2c_ad_margin' as any, { _from: from, _to: to, _include_shipping: false, _ship_cost_per_doc: null }).then(({ data, error }) => {
      if (!live) return; if (error) setAdsErr(error.message.includes('forbidden') ? 'Accès Marketing Intelligence requis pour voir les dépenses Ads.' : error.message); setAds(data);
    });
    return () => { live = false; };
  }, [ch, from, to]);
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
      {ch === 'B2C' && (() => {
        const tot = agg(inCc, () => 'x')[0];
        const before = tot ? tot.cov_ht - tot.cogs : 0;
        const crow = cc === 'all' ? null : (ads?.by_country ?? []).find((r: any) => r.k === cc);
        const g = cc === 'all' ? ads?.totals?.google ?? 0 : crow?.google ?? 0, m = cc === 'all' ? ads?.totals?.meta ?? 0 : crow?.meta ?? 0;
        const inc = tot && Math.abs(tot.prod_ht - tot.cov_ht) > 0.5;
        const k = (l: string, v: string, s?: string, strong?: boolean) => <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">{l}</div><div className={`text-lg tabular-nums ${strong ? 'font-semibold' : ''}`}>{v}</div>{s && <div className="text-xs text-muted-foreground">{s}</div>}</div>;
        return <div className="space-y-1">
          <div className="grid gap-2 md:grid-cols-4">
            {k('CA produits HT B2C', eur(tot?.prod_ht ?? 0), tot ? `couverture coûts ${pctf(marginOf(tot).cov)}` : '')}
            {k('Marge avant Ads', eur(before), tot ? pctf(marginOf(tot).pct) : '')}
            {k(cc === 'all' ? 'Dépenses Ads (Google + Meta)' : `Ads ciblant ${cc}`, ads ? eur(g + m) : adsErr ? '—' : '…', `Google ${eur(g)} · Meta ${eur(m)}`)}
            {k('Marge après Ads', ads ? eur(before - g - m) : '—', inc ? 'incomplète : coûts manquants' : before ? pctf((before - g - m) / tot!.cov_ht) : '', true)}
          </div>
          {adsErr && <p className="text-xs text-destructive">{adsErr}</p>}
          <p className="text-xs text-muted-foreground">{cc === 'all' ? 'Toutes les dépenses Google + Meta de la période.' : 'Dépenses dont le pays publicitaire = ce pays de livraison (approximation). Les Ads sans pays connu restent hors pays.'} Valeurs attribuées par Google/Meta non additionnées. Même calcul que « Marge B2C après Ads » dans Marketing Intelligence.</p>
        </div>;
      })()}
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
      {ch === 'B2C' && cc === 'all' && (() => {
        const byK = new Map((ads?.by_product ?? []).map((p: any) => [p.k, p]));
        const withAds = prods.map((r) => { const a: any = byK.get(r.key); const spend = a ? (a.direct ?? 0) + (a.alloc ?? 0) : 0; const x = marginOf(r); const after = x.m == null ? null : x.m - spend; return { r, x, spend, after, direct: a?.direct ?? 0 }; });
        return (<>
          <p className="text-xs text-muted-foreground">3. Produits B2C · tous pays — {prods.length} produits, hors livraison. Colonne « Ads » = dépenses directement attribuées au produit annoncé + part estimée au prorata du CA ; elle ne concerne que le B2C.</p>
          <Table><TableHeader><TableRow><Th k="label" label="Produit" right={false} /><Th k="ca_ht" label="CA HT" /><Th k="qty" label="Qté" /><Th k="cogs" label="Coût vendu" /><Th k="m" label="Marge" /><Th k="spend" label="Ads" /><Th k="after" label="Marge après Ads" /><Th k="pct" label="Marge %" /><Th k="cov" label="Couverture" /></TableRow></TableHeader>
            <TableBody>{withAds.slice().sort(cmpRows).slice(0, 300).map(({ r, x, spend, after, direct }) => (
              <TableRow key={r.key}><TableCell className="max-w-[320px] truncate">{r.label}</TableCell><TableCell className="text-right tabular-nums">{eur(r.ca_ht)}</TableCell><TableCell className="text-right tabular-nums">{nb(r.qty)}</TableCell>
                <TableCell className="text-right tabular-nums">{eur(r.cogs)}</TableCell><TableCell className="text-right tabular-nums">{eur(x.m)}{x.est && <span className="text-muted-foreground"> est.</span>}</TableCell>
                <TableCell className="text-right tabular-nums" title={direct > 0 ? `dont ${eur(direct)} attribués directement` : 'Part estimée au prorata du CA'}>{ads ? eur(spend) : '…'}</TableCell>
                <TableCell className="text-right tabular-nums">{ads ? eur(after) : '…'}</TableCell>
                <TableCell className="text-right tabular-nums">{pctf(x.pct)}</TableCell><TableCell className={`text-right tabular-nums ${x.inc ? 'text-destructive' : ''}`}>{pctf(x.cov)}{x.inc ? ' · incomplet' : ''}</TableCell></TableRow>))}</TableBody></Table>
        </>);
      })()}
      {(ch !== 'B2C' || cc !== 'all') && (<>
        <p className="text-xs text-muted-foreground">3. Produits {ch === 'all' ? 'tous canaux' : CH_LABEL[ch] ?? ch} · {cc === 'all' ? 'tous pays' : cc} — {prods.length} produits, hors livraison. Pays = pays de livraison Erplain.{ch === 'B2C' && cc !== 'all' ? ' Le détail Ads par produit n\'est disponible que tous pays confondus.' : ''}</p>
        <Table><TableHeader><TableRow><Th k="label" label="Produit" right={false} /><Th k="ca_ht" label="CA HT" /><Th k="qty" label="Qté" /><Th k="cogs" label="Coût vendu" /><Th k="m" label="Marge" /><Th k="pct" label="Marge %" /><Th k="cov" label="Couverture" /></TableRow></TableHeader>
          <TableBody>{prods.map((r) => ({ r })).sort(cmpRows).slice(0, 300).map(({ r }) => { const x = marginOf(r); return (
            <TableRow key={r.key}><TableCell className="max-w-[320px] truncate">{r.label}</TableCell><TableCell className="text-right tabular-nums">{eur(r.ca_ht)}</TableCell><TableCell className="text-right tabular-nums">{nb(r.qty)}</TableCell>
              <TableCell className="text-right tabular-nums">{eur(r.cogs)}</TableCell><TableCell className="text-right tabular-nums">{eur(x.m)}{x.est && <span className="text-muted-foreground"> est.</span>}</TableCell>
              <TableCell className="text-right tabular-nums">{pctf(x.pct)}</TableCell><TableCell className={`text-right tabular-nums ${x.inc ? 'text-destructive' : ''}`}>{pctf(x.cov)}{x.inc ? ' · incomplet' : ''}</TableCell></TableRow>); })}</TableBody></Table>
      </>)}
    </div>
  );
}
