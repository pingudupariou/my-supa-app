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
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';

type Row = { key: string; label?: string; channel?: string; ca_ht: number; qty: number; default_share?: number };
type Stats = {
  totals: { ca_ht: number; qty: number; shipping_ht: number; docs: number };
  by_month: { month: string; channel: string; ca_ht: number; qty: number }[];
  by_channel: Row[]; by_customer: Row[]; by_product: Row[]; by_commercial_country: Row[]; by_delivery_country: Row[];
  reconciliation: { docs_ht: number; lines_ht: number; invoices: number; credit_notes: number; missing_total: number; no_customer: number };
  excluded: { reason: string; doc_type: string; n: number; ht: number }[];
};
const CHANNELS = ['B2C', 'B2B', 'OEM', 'A_CLASSER'] as const;
const CH_LABEL: Record<string, string> = { B2C: 'B2C (Shopify)', B2B: 'B2B', OEM: 'OEM', A_CLASSER: 'À classer' };
const CH_COLOR: Record<string, string> = { B2C: 'hsl(var(--primary))', B2B: 'hsl(var(--chart-2, 160 60% 40%))', OEM: 'hsl(var(--chart-4, 35 90% 50%))', A_CLASSER: 'hsl(var(--muted-foreground))' };
const eur = (v: number | null | undefined) => v == null ? '—' : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
const nb = (v: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(v);
const iso = (d: Date) => d.toISOString().slice(0, 10);

function periodRange(p: string, from: string, to: string): [string, string] {
  const now = new Date();
  if (p === 'custom') return [from || '2000-01-01', to || iso(now)];
  if (p === 'all') return ['2000-01-01', iso(now)];
  if (p === 'ytd') return [`${now.getFullYear()}-01-01`, iso(now)];
  const d = new Date(now); d.setMonth(d.getMonth() - Number(p));
  return [iso(d), iso(now)];
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
  const [range0, range1] = periodRange(period, from, to);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, r, c] = await Promise.all([
      supabase.rpc('sales_stats' as any, { _from: range0, _to: range1, _include_shipping: shipping, _channels: channels.length === CHANNELS.length ? null : channels }),
      supabase.from('erplain_sales_sync_runs' as any).select('*').order('started_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('erplain_sales_customers' as any).select('customer_id,channel,commercial_country').range(0, 4999),
    ]);
    if (s.error) toast.error(`Statistiques : ${s.error.message}`); else setStats(s.data as any);
    setRun(r.data);
    setCustomers(Object.fromEntries(((c.data as any[]) ?? []).map((x) => [x.customer_id, x])));
    setLoading(false);
  }, [range0, range1, shipping, channels]);
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
              </TableRow>
            );
          })}
          {!list.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Aucune donnée</TableCell></TableRow>}
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
            <SelectContent><SelectItem value="3">3 derniers mois</SelectItem><SelectItem value="12">12 derniers mois</SelectItem><SelectItem value="24">24 derniers mois</SelectItem><SelectItem value="ytd">Année en cours</SelectItem><SelectItem value="all">Tout l'historique</SelectItem><SelectItem value="custom">Personnalisée</SelectItem></SelectContent>
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

      <Tabs defaultValue="customers">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="customers">Clients</TabsTrigger><TabsTrigger value="products">Produits</TabsTrigger>
            <TabsTrigger value="cc">Pays commercial</TabsTrigger><TabsTrigger value="dc">Pays de livraison</TabsTrigger><TabsTrigger value="channels">Canaux</TabsTrigger>
          </TabsList>
          <Input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-56" />
        </div>
        <Card className="mt-2"><CardContent className="pt-4">
          <TabsContent value="customers">{table(stats?.by_customer ?? [], 'customer')}</TabsContent>
          <TabsContent value="products">{table(stats?.by_product ?? [], 'product')}</TabsContent>
          <TabsContent value="cc">{table(stats?.by_commercial_country ?? [], 'cc')}</TabsContent>
          <TabsContent value="dc">{table(stats?.by_delivery_country ?? [], 'country')}</TabsContent>
          <TabsContent value="channels">{table((stats?.by_channel ?? []).map((r) => ({ ...r, label: CH_LABEL[r.key] ?? r.key })), 'country')}</TabsContent>
        </CardContent></Card>
      </Tabs>
    </div>
  );
}
