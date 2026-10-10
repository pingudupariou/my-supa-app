import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, RefreshCw } from 'lucide-react';
import { ShopifyReconciliation } from '@/components/marketing/ShopifyReconciliation';

const sb = supabase as any;
type Period = '30' | '90' | '365' | 'all' | 'custom';
const PERIODS: Record<Period, string> = { '30': '30 jours', '90': '90 jours', '365': '12 mois', all: "Tout l'historique", custom: 'Dates personnalisées' };
const day = (d: Date) => d.toISOString().slice(0, 10);
const ago = (n: number) => new Date(Date.now() - n * 86400e3);

async function readFnError(error: any) {
  const ctx = error?.context;
  return (ctx && typeof ctx.json === 'function' ? await ctx.json().catch(() => null) : null) ?? { status: 'error', message: error.message };
}

function ShopifyTest() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const test = async (mode?: string) => {
    setLoading(true); setResult(null);
    const { data, error } = await supabase.functions.invoke('shopify-test', { method: 'POST', body: mode ? { mode } : {} });
    setResult(error ? await readFnError(error) : data);
    setLoading(false);
  };
  return (
    <div className="space-y-2 text-sm">
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => test()} disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Tester la connexion
        </Button>
        <Button variant="outline" size="sm" onClick={() => test('diag')} disabled={loading}>Diagnostic droits</Button>
      </div>
      {result?.status === 'error' && <p className="text-destructive">Échec{result.step ? ` (${result.step})` : ''}{result.http ? ` — HTTP ${result.http}` : ''} : {result.message}</p>}
      {result?.status === 'success' && <p>Connecté à <b>{result.shop?.name}</b> — droits : {result.scopes}</p>}
      {result?.status === 'diag' && (
        <div className="rounded border p-3 space-y-1">
          <p><b>Droits accordés :</b> {result.granted_scopes?.join(', ') || '—'} {result.scopes_error && <span className="text-destructive">({result.scopes_error})</span>}</p>
          <p><b>read_all_orders :</b> {result.has_read_all_orders ? 'accordé' : 'non accordé'}</p>
          <p><b>Commande de plus de 60 jours (avant {result.cutoff?.slice(0, 10)}) :</b>{' '}
            {result.old_order ? `lue — ${result.old_order.name} du ${result.old_order.createdAt?.slice(0, 10)}` : result.old_error ? 'refusée' : 'aucune renvoyée'}</p>
          {result.old_error && <p className="text-destructive"><b>Message Shopify (HTTP {result.old_http}) :</b> {result.old_error}</p>}
          <p><b>Action :</b> {result.action}</p>
        </div>
      )}
    </div>
  );
}

function ShopifySection({ canWrite }: { canWrite: boolean }) {
  const [period, setPeriod] = useState<Period>('30');
  const [from, setFrom] = useState(day(ago(30)));
  const [to, setTo] = useState(day(new Date()));
  const [run, setRun] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [dash, setDash] = useState<any>(null);
  const [dFrom, setDFrom] = useState(day(ago(30)));
  const [dTo, setDTo] = useState(day(new Date()));

  const loadHistory = useCallback(async () => {
    const { data } = await sb.from('shopify_sync_runs').select('*').order('id', { ascending: false }).limit(10);
    setHistory(data ?? []);
  }, []);
  const loadDash = useCallback(async () => {
    const end = new Date(dTo); end.setDate(end.getDate() + 1);
    const { data, error } = await sb.rpc('shopify_dashboard', { _from: new Date(dFrom).toISOString(), _to: end.toISOString() });
    setDash(error ? { error: error.message } : data);
  }, [dFrom, dTo]);
  useEffect(() => { loadHistory(); }, [loadHistory]);
  useEffect(() => { loadDash(); }, [loadDash]);

  const sync = async () => {
    setBusy(true);
    let body: any = { label: PERIODS[period] };
    if (period === 'custom') body = { ...body, from: new Date(from).toISOString(), to: new Date(to + 'T23:59:59').toISOString() };
    else if (period !== 'all') body.from = ago(Number(period)).toISOString();
    try {
      for (let i = 0; i < 200; i++) {
        const { data, error } = await supabase.functions.invoke('shopify-sync', { body });
        const res = error ? await readFnError(error) : data;
        if (res?.run) setRun(res.run); else setRun({ status: 'error', message: res?.message, errors: [] });
        if (res?.status !== 'partial') break;
        body = { run_id: res.run.id };
      }
    } finally {
      setBusy(false); loadHistory(); loadDash();
    }
  };

  const cur = dash?.currency ?? 'EUR';
  const money = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(Number(n) || 0);
  const aov = dash?.orders ? dash.net_revenue / dash.orders : 0;
  const progress = run ? (run.status === 'running' ? (run.phase === 'products' ? 15 : 60) : 100) : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Synchronisation Shopify</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-48">
              <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(PERIODS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {period === 'custom' && <>
              <Input type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
              <Input type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} />
            </>}
            <Button onClick={sync} disabled={busy || !canWrite}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Synchroniser
            </Button>
            <ShopifyTest />
          </div>
          {!canWrite && <p className="text-xs text-muted-foreground">Lecture seule : la synchronisation demande le droit d'écriture.</p>}
          <p className="text-xs text-muted-foreground">Synchronisation automatique chaque nuit (commandes créées ou modifiées depuis la veille).</p>
          {run && (
            <div className="space-y-1 text-sm">
              <Progress value={progress} />
              <p>{run.status === 'running' ? `En cours — ${run.phase === 'products' ? 'produits' : 'commandes'}…` : run.message}
                {' '}— {run.orders_imported ?? 0} importée(s), {run.orders_updated ?? 0} mise(s) à jour, {run.products_synced ?? 0} produit(s), {run.pages ?? 0} page(s)</p>
              {(run.errors ?? []).map((e: any, i: number) => <p key={i} className="text-destructive">{e.message}</p>)}
            </div>
          )}
          {history.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground">Historique des synchronisations</summary>
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Période</TableHead><TableHead>Statut</TableHead><TableHead>Importées</TableHead><TableHead>Mises à jour</TableHead><TableHead>Message</TableHead></TableRow></TableHeader>
                <TableBody>{history.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell>{new Date(h.started_at).toLocaleString('fr-FR')}</TableCell>
                    <TableCell>{h.period_label ?? (h.mode === 'cron' ? 'Quotidien' : '—')}</TableCell>
                    <TableCell><Badge variant={h.status === 'error' ? 'destructive' : 'secondary'}>{h.status}</Badge></TableCell>
                    <TableCell>{h.orders_imported}</TableCell><TableCell>{h.orders_updated}</TableCell>
                    <TableCell className="max-w-xs truncate">{h.message ?? (h.errors?.[0]?.message || '')}</TableCell>
                  </TableRow>))}</TableBody>
              </Table>
            </details>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>Ventes Shopify</CardTitle>
          <div className="flex gap-2">
            <Input type="date" className="w-40" value={dFrom} onChange={(e) => setDFrom(e.target.value)} />
            <Input type="date" className="w-40" value={dTo} onChange={(e) => setDTo(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {dash?.error ? <p className="text-sm text-destructive">{dash.error}</p> : (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <Kpi label="CA net HT" value={money(dash?.net_revenue)} hint="Après remises et remboursements, hors taxes" />
                <Kpi label="Commandes" value={String(dash?.orders ?? 0)} hint="Hors annulées et commandes test" />
                <Kpi label="Panier moyen" value={money(aov)} hint="CA net ÷ commandes" />
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                <Breakdown title="Par pays" rows={(dash?.by_country ?? []).map((r: any) => [r.country, r.orders, money(r.net_revenue)])} cols={['Pays', 'Commandes', 'CA net']} />
                <Breakdown title="Par produit" rows={(dash?.by_product ?? []).map((r: any) => [r.title, r.quantity, money(r.net_amount)])} cols={['Produit', 'Quantité', 'CA lignes']} />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function Breakdown({ title, rows, cols }: { title: string; rows: any[][]; cols: string[] }) {
  return (
    <div>
      <h3 className="font-semibold mb-2 text-sm">{title}</h3>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">Aucune donnée sur la période.</p> : (
        <div className="max-h-80 overflow-auto">
          <Table>
            <TableHeader><TableRow>{cols.map((c, i) => <TableHead key={c} className={i ? 'text-right' : ''}>{c}</TableHead>)}</TableRow></TableHeader>
            <TableBody>{rows.map((r, i) => <TableRow key={i}>{r.map((v, j) => <TableCell key={j} className={j ? 'text-right' : ''}>{v}</TableCell>)}</TableRow>)}</TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

const CONNECTORS = [
  { name: 'Google Ads', data: 'Campagnes, coûts, clics, conversions et valeur', needs: "Compte Google Ads et autorisation d'accès en lecture" },
  { name: 'GA4', data: "Sessions, acquisition, événements et tunnel d'achat", needs: 'Propriété GA4 et accès lecteur' },
  { name: 'Meta Ads (Crush AI)', data: 'Dépenses et performances des campagnes', needs: 'Compte publicitaire Meta et autorisation de lecture' },
];

function ConnectionsSection() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-base">Shopify</CardTitle><Badge>Connecté</Badge></CardHeader>
        <CardContent className="text-sm text-muted-foreground">Référence des ventes réelles : commandes, produits, pays, remboursements.</CardContent>
      </Card>
      {CONNECTORS.map((c) => (
        <Card key={c.name}>
          <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-base">{c.name}</CardTitle><Badge variant="outline">Non connecté</Badge></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">Données : </span>{c.data}</p>
            <p><span className="text-muted-foreground">À fournir : </span>{c.needs}</p>
            <Button size="sm" variant="outline" disabled>Connexion à venir</Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function GlobalSection() {
  const metrics = useMemo(() => [
    ['CA Shopify', 'Disponible', 'Ventes réelles (référence)'],
    ['Dépenses Ads', 'En attente de connexion', 'Google Ads + Meta Ads'],
    ['ROAS par canal', 'En attente de connexion', 'Valeur attribuée par la plateforme ÷ dépenses du canal'],
    ['MER', 'En attente de connexion', 'CA Shopify ÷ dépenses Ads totales'],
    ['CPA', 'En attente de connexion', 'Dépenses ÷ commandes Shopify'],
    ['Taux de conversion', 'En attente de GA4', 'Commandes ÷ sessions'],
    ['Marge', 'En attente des coûts', 'CA net − coût produits − dépenses Ads'],
  ], []);
  return (
    <Card>
      <CardHeader><CardTitle>Dashboard marketing global</CardTitle></CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-muted-foreground">Comparaison par période, canal, pays et produit. Shopify reste la référence des ventes : les conversions attribuées par Google et Meta sont affichées à part et ne sont jamais additionnées comme des ventes.</p>
        <Table>
          <TableHeader><TableRow><TableHead>Indicateur</TableHead><TableHead>État</TableHead><TableHead>Calcul</TableHead></TableRow></TableHeader>
          <TableBody>{metrics.map(([m, s, c]) => (
            <TableRow key={m}><TableCell className="font-medium">{m}</TableCell>
              <TableCell><Badge variant={s === 'Disponible' ? 'default' : 'outline'}>{s}</Badge></TableCell>
              <TableCell className="text-muted-foreground">{c}</TableCell></TableRow>))}</TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function MarketingIntelligencePage() {
  const [access, setAccess] = useState<string>('read');
  useEffect(() => { sb.rpc('current_user_marketing_access').then(({ data }: any) => data && setAccess(data)); }, []);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Marketing Intelligence</h1>
      <Tabs defaultValue="shopify">
        <TabsList>
          <TabsTrigger value="shopify" data-readonly-allow>Shopify</TabsTrigger>
          <TabsTrigger value="connections" data-readonly-allow>Connexions</TabsTrigger>
          <TabsTrigger value="global" data-readonly-allow>Dashboard global</TabsTrigger>
          <TabsTrigger value="ai" data-readonly-allow>Assistant IA</TabsTrigger>
        </TabsList>
        <TabsContent value="shopify" className="space-y-6"><ShopifySection canWrite={access === 'write'} /><ShopifyReconciliation /></TabsContent>
        <TabsContent value="connections"><ConnectionsSection /></TabsContent>
        <TabsContent value="global"><GlobalSection /></TabsContent>
        <TabsContent value="ai">
          <Card><CardContent className="pt-6 text-sm text-muted-foreground">L'assistant marketing IA sera configuré dès que tu auras précisé ce qu'il doit faire.</CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
