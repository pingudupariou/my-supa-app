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
const ratio = (a: number, b: number) => (b ? (a / b).toFixed(2) : '—');
const TYPE_LABEL: Record<string, string> = { SEARCH: 'Recherche', PERFORMANCE_MAX: 'Performance Max', DISPLAY: 'Display', SHOPPING: 'Shopping', VIDEO: 'Vidéo', DEMAND_GEN: 'Demand Gen' };

/** Import + sync controls (Connexions tab). */
export function GoogleAdsSyncCard({ canWrite }: { canWrite: boolean }) {
  const [period, setPeriod] = useState('365');
  const [from, setFrom] = useState(daysAgo(365));
  const [to, setTo] = useState(iso(new Date()));
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [runs, setRuns] = useState<any[]>([]);
  const loadRuns = useCallback(async () => {
    const { data } = await sb.from('google_ads_sync_runs').select('*').order('id', { ascending: false }).limit(5);
    setRuns(data ?? []);
  }, []);
  useEffect(() => { loadRuns(); }, [loadRuns]);
  useEffect(() => { if (period !== 'custom') { setFrom(period === 'all' ? '2015-01-01' : daysAgo(Number(period))); setTo(iso(new Date())); } }, [period]);

  const sync = async () => {
    setBusy(true); setProgress('Démarrage…');
    let cur = from; let runId: number | undefined;
    try {
      for (let i = 0; i < 40; i++) {
        const { data, error } = await supabase.functions.invoke('google-ads-sync', { method: 'POST', body: { from: cur, to, run_id: runId } });
        if (error) { const ctx: any = (error as any).context; throw new Error(ctx?.text ? await ctx.text() : error.message); }
        if (data?.status === 'error') throw new Error(data.message);
        runId = data.run_id;
        setProgress(`${data.campaigns} campagnes · ${int(data.campaign_rows)} lignes jour/campagne · ${int(data.country_rows)} lignes pays`);
        if (data.status === 'success') break;
        cur = data.next_from;
      }
    } catch (e: any) { setProgress(`Erreur : ${e.message}`); }
    setBusy(false); loadRuns();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Google Ads — Novatoride.com</CardTitle><Badge>Connecté (lecture seule)</Badge>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">Dépenses, clics, impressions, conversions et valeur attribuée, par jour, campagne, type et pays. Synchronisation automatique chaque nuit des 14 derniers jours (données récentes corrigées, sans doublon). Aucune campagne n'est modifiée.</p>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30 jours</SelectItem><SelectItem value="90">90 jours</SelectItem>
              <SelectItem value="365">12 mois</SelectItem><SelectItem value="all">Tout l'historique</SelectItem>
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
                <TableCell>{int(r.campaign_rows)} / {int(r.country_rows)} pays</TableCell>
              </TableRow>))}</TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function MetricTable({ rows, first, label }: { rows: any[]; first: string; label: (r: any) => string }) {
  return (
    <Table>
      <TableHeader><TableRow><TableHead>{first}</TableHead><TableHead className="text-right">Dépenses</TableHead><TableHead className="text-right">Clics</TableHead><TableHead className="text-right">Impr.</TableHead><TableHead className="text-right">Conv.</TableHead><TableHead className="text-right">Valeur attribuée</TableHead><TableHead className="text-right">ROAS Google</TableHead></TableRow></TableHeader>
      <TableBody>{rows.map((r, i) => (
        <TableRow key={i}><TableCell className="font-medium">{label(r)}</TableCell>
          <TableCell className="text-right">{eur(r.cost)}</TableCell><TableCell className="text-right">{int(r.clicks)}</TableCell>
          <TableCell className="text-right">{int(r.impressions)}</TableCell><TableCell className="text-right">{Number(r.conversions).toFixed(1)}</TableCell>
          <TableCell className="text-right">{eur(r.conversions_value)}</TableCell><TableCell className="text-right">{ratio(r.conversions_value, r.cost)}</TableCell></TableRow>))}</TableBody>
    </Table>
  );
}

/** ROAS / MER dashboard (Dashboard global tab). */
export function GoogleAdsDashboard() {
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(iso(new Date()));
  const [view, setView] = useState<'campaign' | 'type' | 'country'>('campaign');
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState('');
  const load = useCallback(async () => {
    setErr('');
    const { data, error } = await sb.rpc('google_ads_dashboard', { _from: from, _to: to });
    if (error) setErr(error.message); else setD(data);
  }, [from, to]);
  useEffect(() => { load(); }, [load]);
  const t = d?.totals ?? {};
  const shop = Number(d?.shopify_revenue ?? 0);
  return (
    <Card>
      <CardHeader><CardTitle>Google Ads — ROAS et MER</CardTitle></CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex flex-wrap gap-2 items-center">
          <Input type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        {err && <p className="text-destructive">{err}</p>}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <K l="CA Shopify (réel, net HT)" v={eur(shop)} h={`${int(d?.shopify_orders)} commandes · référence`} />
          <K l="Dépenses Google Ads" v={eur(t.cost)} h={`${int(t.clicks)} clics · ${int(t.impressions)} impr.`} />
          <K l="MER" v={ratio(shop, t.cost)} h="CA Shopify ÷ dépenses Ads" />
          <K l="ROAS Google (attribué)" v={ratio(t.conversions_value, t.cost)} h={`${eur(t.conversions_value)} attribués · ${Number(t.conversions ?? 0).toFixed(0)} conv.`} />
          <K l="CPA Shopify" v={d?.shopify_orders ? eur(t.cost / d.shopify_orders) : '—'} h="Dépenses ÷ commandes Shopify" />
          <K l="CPA Google" v={t.conversions ? eur(t.cost / t.conversions) : '—'} h="Dépenses ÷ conversions Google" />
        </div>
        <p className="text-xs text-muted-foreground">La valeur attribuée par Google n'est pas du CA : elle peut recouper des ventes déjà comptées par d'autres canaux. Seul le CA Shopify sert au MER. Les totaux viennent des données par campagne ; la vue par pays est une ventilation à part (lieu physique de l'internaute) et n'est jamais ajoutée aux totaux — une petite part du trafic n'a pas de pays connu.</p>
        <Select value={view} onValueChange={(v) => setView(v as any)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="campaign">Par campagne</SelectItem><SelectItem value="type">Par type de campagne</SelectItem><SelectItem value="country">Par pays</SelectItem></SelectContent>
        </Select>
        {view === 'campaign' && <MetricTable rows={(d?.by_campaign ?? []).filter((r: any) => Number(r.cost) || Number(r.impressions))} first="Campagne" label={(r) => r.name ?? r.campaign_id} />}
        {view === 'type' && <MetricTable rows={d?.by_type ?? []} first="Type" label={(r) => TYPE_LABEL[r.channel_type] ?? r.channel_type} />}
        {view === 'country' && <MetricTable rows={d?.by_country ?? []} first="Pays" label={(r) => r.country} />}
      </CardContent>
    </Card>
  );
}

function K({ l, v, h }: { l: string; v: string; h?: string }) {
  return <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">{l}</div><div className="text-xl font-semibold">{v}</div>{h && <div className="text-xs text-muted-foreground">{h}</div>}</div>;
}
