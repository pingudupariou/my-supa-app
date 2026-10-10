import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, RefreshCw } from 'lucide-react';

const sb = supabase as any;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
const eur = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n) || 0);
const int = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(n) || 0);
const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)} %` : '—');
const ALL = '__all';

/** Import + sync controls (Connexions tab). */
export function GA4SyncCard({ canWrite }: { canWrite: boolean }) {
  const [period, setPeriod] = useState('365');
  const [from, setFrom] = useState(daysAgo(365));
  const [to, setTo] = useState(iso(new Date()));
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [runs, setRuns] = useState<any[]>([]);
  const loadRuns = useCallback(async () => {
    const { data } = await sb.from('ga4_sync_runs').select('*').order('id', { ascending: false }).limit(5);
    setRuns(data ?? []);
  }, []);
  useEffect(() => { loadRuns(); }, [loadRuns]);
  useEffect(() => { if (period !== 'custom') { setFrom(daysAgo(Number(period))); setTo(iso(new Date())); } }, [period]);

  const sync = async () => {
    setBusy(true); setProgress('Démarrage…');
    let cur = from; let runId: number | undefined;
    try {
      for (let i = 0; i < 40; i++) {
        const { data, error } = await supabase.functions.invoke('ga4-sync', { method: 'POST', body: { from: cur, to, run_id: runId } });
        if (error) { const ctx: any = (error as any).context; throw new Error(ctx?.text ? await ctx.text() : error.message); }
        if (data?.status === 'error') throw new Error(data.message);
        runId = data.run_id;
        setProgress(`${int(data.day_rows)} jours · ${int(data.cube_rows)} lignes canal/pays/appareil · ${int(data.source_rows)} lignes source`);
        if (data.status === 'success') break;
        cur = data.next_from;
      }
    } catch (e: any) { setProgress(`Erreur : ${e.message}`); }
    setBusy(false); loadRuns();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">GA4 — synchronisation</CardTitle><Badge>Connecté (lecture seule)</Badge>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">Sessions, utilisateurs, canaux, sources/supports, pays, appareils et tunnel e-commerce. Synchronisation automatique chaque nuit des 7 derniers jours (données récentes corrigées, sans doublon).</p>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 jours</SelectItem><SelectItem value="30">30 jours</SelectItem><SelectItem value="90">90 jours</SelectItem>
              <SelectItem value="365">12 mois</SelectItem><SelectItem value="730">24 mois</SelectItem>
              <SelectItem value="custom">Dates personnalisées</SelectItem>
            </SelectContent>
          </Select>
          {period === 'custom' && <><Input type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} /><Input type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} /></>}
          <Button size="sm" onClick={sync} disabled={!canWrite || busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}Importer / synchroniser</Button>
        </div>
        {progress && <p className="text-xs">{progress}</p>}
        {runs.length > 0 && (
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Période</TableHead><TableHead>Statut</TableHead><TableHead>Lignes</TableHead></TableRow></TableHeader>
            <TableBody>{runs.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{new Date(r.started_at).toLocaleString('fr-FR')}</TableCell>
                <TableCell>{r.mode === 'cron' ? 'Quotidienne' : 'Manuelle'}</TableCell>
                <TableCell>{r.period_from} → {r.period_to}</TableCell>
                <TableCell><Badge variant={r.status === 'success' ? 'default' : r.status === 'error' ? 'destructive' : 'outline'}>{r.status}</Badge>{r.message && <span className="block text-xs text-muted-foreground">{r.message.slice(0, 160)}</span>}</TableCell>
                <TableCell>{int(r.day_rows)} j · {int(r.cube_rows)} / {int(r.source_rows)}</TableCell>
              </TableRow>))}</TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function K({ l, v, h }: { l: string; v: string; h?: string }) {
  return <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">{l}</div><div className="text-xl font-semibold">{v}</div>{h && <div className="text-xs text-muted-foreground">{h}</div>}</div>;
}

function DimTable({ rows, first }: { rows: any[]; first: string }) {
  return (
    <Table>
      <TableHeader><TableRow><TableHead>{first}</TableHead><TableHead className="text-right">Sessions</TableHead><TableHead className="text-right">Engagement</TableHead><TableHead className="text-right">Vues produit</TableHead><TableHead className="text-right">Panier</TableHead><TableHead className="text-right">Paiement</TableHead><TableHead className="text-right">Achats GA4</TableHead><TableHead className="text-right">Conv.</TableHead></TableRow></TableHeader>
      <TableBody>{rows.slice(0, 25).map((r, i) => (
        <TableRow key={i}><TableCell className="font-medium">{r.label ? `${r.label} (${r.k})` : r.k}</TableCell>
          <TableCell className="text-right">{int(r.sessions)}</TableCell><TableCell className="text-right">{pct(r.engaged_sessions, r.sessions)}</TableCell>
          <TableCell className="text-right">{int(r.view_item)}</TableCell><TableCell className="text-right">{int(r.add_to_cart)}</TableCell>
          <TableCell className="text-right">{int(r.begin_checkout)}</TableCell><TableCell className="text-right">{int(r.purchases)}</TableCell>
          <TableCell className="text-right">{pct(r.purchases, r.sessions)}</TableCell></TableRow>))}</TableBody>
    </Table>
  );
}

/** Traffic + funnel dashboard (Dashboard global tab). */
export function GA4Dashboard() {
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(iso(new Date()));
  const [country, setCountry] = useState(ALL);
  const [channel, setChannel] = useState(ALL);
  const [device, setDevice] = useState(ALL);
  const [view, setView] = useState<'channel' | 'country' | 'device' | 'source'>('channel');
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState('');
  const load = useCallback(async () => {
    setErr('');
    const n = (v: string) => (v === ALL ? null : v);
    const { data, error } = await sb.rpc('ga4_dashboard', { _from: from, _to: to, _country: n(country), _channel: n(channel), _device: n(device) });
    if (error) setErr(error.message); else setD(data);
  }, [from, to, country, channel, device]);
  useEffect(() => { load(); }, [load]);
  const t = d?.totals ?? {};
  const shop = d?.shopify ?? {};
  const ads = d?.google_ads ?? {};
  const filtered = country !== ALL || channel !== ALL || device !== ALL;
  const funnel = [
    ['Sessions', t.sessions], ['Vues produit', t.view_item], ['Ajouts au panier', t.add_to_cart],
    ['Passages au paiement', t.begin_checkout], ['Achats GA4', t.purchases],
  ] as [string, number][];
  const max = Math.max(1, Number(t.sessions) || 0);

  return (
    <Card>
      <CardHeader><CardTitle>GA4 — trafic et tunnel de conversion</CardTitle></CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex flex-wrap gap-2 items-center">
          <Input type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} />
          <Select value={country} onValueChange={setCountry}><SelectTrigger className="w-44"><SelectValue placeholder="Pays" /></SelectTrigger>
            <SelectContent><SelectItem value={ALL}>Tous les pays</SelectItem>{(d?.options?.countries ?? []).map((c: any) => <SelectItem key={c.k} value={c.k}>{c.label ?? c.k}</SelectItem>)}</SelectContent></Select>
          <Select value={channel} onValueChange={setChannel}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value={ALL}>Tous les canaux</SelectItem>{(d?.options?.channels ?? []).map((c: string) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
          <Select value={device} onValueChange={setDevice}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value={ALL}>Tous appareils</SelectItem>{(d?.options?.devices ?? []).map((c: string) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
        </div>
        {err && <p className="text-destructive">{err}</p>}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <K l="Sessions" v={int(t.sessions)} h={`${pct(t.engaged_sessions, t.sessions)} engagées`} />
          <K l="Utilisateurs" v={d?.users ? int(d.users.daily_users_sum) : '—'} h={d?.users ? 'Somme des utilisateurs par jour (un visiteur revenant plusieurs jours compte plusieurs fois)' : 'Non disponible avec filtres (non additionnable)'} />
          <K l="Nouveaux utilisateurs" v={int(t.new_users)} />
          <K l="Taux de conversion GA4" v={pct(t.purchases, t.sessions)} h="Achats GA4 ÷ sessions" />
          <K l="CA Shopify (réel, net HT)" v={eur(shop.revenue)} h={`${int(shop.orders)} commandes · référence${channel !== ALL || device !== ALL ? ' (non filtrable par canal/appareil)' : ''}`} />
          <K l="Taux de conversion Shopify" v={pct(shop.orders, t.sessions)} h="Commandes Shopify ÷ sessions GA4" />
          <K l="Dépenses Google Ads" v={eur(ads.cost)} h={`${int(ads.clicks)} clics${channel !== ALL || device !== ALL ? ' · non filtré canal/appareil' : ''}`} />
          <K l="Coût par session (Ads)" v={t.sessions ? `${(Number(ads.cost) / t.sessions).toFixed(2)} €` : '—'} h="Dépenses Ads ÷ toutes sessions" />
        </div>

        <div className="space-y-1">
          <div className="font-medium">Tunnel de conversion</div>
          {funnel.map(([l, v], i) => (
            <div key={l} className="flex items-center gap-2">
              <div className="w-40 text-xs">{l}</div>
              <div className="flex-1 h-5 rounded bg-muted overflow-hidden"><div className="h-full bg-primary" style={{ width: `${Math.max(1, (Number(v) / max) * 100)}%` }} /></div>
              <div className="w-20 text-right">{int(v)}</div>
              <div className="w-20 text-right text-xs text-muted-foreground">{i > 0 ? pct(v, funnel[i - 1][1]) : ''}</div>
            </div>))}
          <p className="text-xs text-muted-foreground">Comptages d'événements GA4 (un visiteur peut voir plusieurs produits). Achats GA4 : {int(t.purchases)} pour {eur(t.purchase_revenue)} attribués — indicatif uniquement, jamais ajouté au CA Shopify ({int(shop.orders)} commandes réelles). Écart attendu : refus de cookies, bloqueurs, commandes hors site.</p>
        </div>

        <div className="flex gap-2">
          {(['channel', 'country', 'device', 'source'] as const).map((v) => (
            <Button key={v} size="sm" variant={view === v ? 'default' : 'outline'} onClick={() => setView(v)}>
              {{ channel: 'Canal', country: 'Pays', device: 'Appareil', source: 'Source / support' }[v]}</Button>))}
        </div>
        {view === 'channel' && <DimTable rows={d?.by_channel ?? []} first="Canal" />}
        {view === 'country' && <DimTable rows={d?.by_country ?? []} first="Pays" />}
        {view === 'device' && <DimTable rows={d?.by_device ?? []} first="Appareil" />}
        {view === 'source' && (filtered ? <p className="text-muted-foreground">La vue source/support est disponible sans filtre pays/canal/appareil (table séparée, jamais additionnée aux autres vues).</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>Source / support</TableHead><TableHead className="text-right">Sessions</TableHead><TableHead className="text-right">Achats GA4</TableHead><TableHead className="text-right">Revenu attribué GA4</TableHead><TableHead className="text-right">Conv.</TableHead></TableRow></TableHeader>
            <TableBody>{(d?.by_source ?? []).map((r: any, i: number) => (
              <TableRow key={i}><TableCell className="font-medium">{r.k}</TableCell><TableCell className="text-right">{int(r.sessions)}</TableCell>
                <TableCell className="text-right">{int(r.purchases)}</TableCell><TableCell className="text-right">{eur(r.purchase_revenue)}</TableCell>
                <TableCell className="text-right">{pct(r.purchases, r.sessions)}</TableCell></TableRow>))}</TableBody>
          </Table>))}
        <p className="text-xs text-muted-foreground">Chaque vue est une ventilation du même total de sessions : ne jamais additionner canal + pays + appareil. Dernière synchro : {d?.last_sync ? new Date(d.last_sync).toLocaleString('fr-FR') : '—'}.</p>
      </CardContent>
    </Card>
  );
}
