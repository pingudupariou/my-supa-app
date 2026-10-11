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
const STATUS: Record<string, string> = { success: 'Terminé', running: 'En cours', error: 'Erreur' };

/** Import + sync controls (Connexions tab). */
export function MetaAdsSyncCard({ canWrite }: { canWrite: boolean }) {
  const [period, setPeriod] = useState('7');
  const [from, setFrom] = useState(daysAgo(7));
  const [to, setTo] = useState(iso(new Date()));
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [runs, setRuns] = useState<any[]>([]);
  const loadRuns = useCallback(async () => {
    const { data } = await sb.from('meta_ads_sync_runs').select('*').order('id', { ascending: false }).limit(10);
    setRuns(data ?? []);
  }, []);
  useEffect(() => { loadRuns(); }, [loadRuns]);
  useEffect(() => { if (period !== 'custom') { setFrom(daysAgo(Number(period))); setTo(iso(new Date())); } }, [period]);

  const sync = async () => {
    setBusy(true); setProgress('Démarrage…');
    let cur = from; let runId: number | undefined;
    try {
      for (let i = 0; i < 60; i++) {
        const { data, error } = await supabase.functions.invoke('meta-ads-sync', { method: 'POST', body: { from: cur, to, run_id: runId } });
        if (error) { const ctx: any = (error as any).context; throw new Error(ctx?.text ? await ctx.text() : error.message); }
        if (data?.status === 'error') throw new Error(data.message);
        runId = data.run_id;
        setProgress(`${data.status === 'success' ? 'Terminé' : `En cours (jusqu'au ${data.next_from})`} · ${data.campaigns} campagnes · ${int(data.campaign_rows)} lignes jour/campagne · ${int(data.country_rows)} lignes pays`);
        if (data.status === 'success') break;
        cur = data.next_from;
        loadRuns();
      }
    } catch (e: any) { setProgress(`Erreur : ${e.message}`); }
    setBusy(false); loadRuns();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Meta Ads (Crush AI) — synchronisation</CardTitle><Badge>Connecté (lecture seule)</Badge>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">Dépenses, impressions, clics, achats et valeur attribués par Meta, par jour, campagne et pays. Synchronisation automatique chaque nuit des 14 derniers jours. Relancer une période remplace ses chiffres, sans doublon. Aucune campagne n'est modifiée.</p>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 jours</SelectItem><SelectItem value="30">30 jours</SelectItem>
              <SelectItem value="90">3 mois</SelectItem><SelectItem value="182">6 mois</SelectItem>
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
                <TableCell><Badge variant={r.status === 'success' ? 'default' : r.status === 'error' ? 'destructive' : 'outline'}>{STATUS[r.status] ?? r.status}</Badge>{r.message && <span className="block text-xs text-muted-foreground">{r.message.slice(0, 200)}</span>}</TableCell>
                <TableCell>{int(r.campaign_rows)} / {int(r.country_rows)} pays</TableCell>
              </TableRow>))}</TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/** Meta dashboard + global MER (Dashboard global tab). */
export function MetaAdsDashboard() {
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(iso(new Date()));
  const [view, setView] = useState<'campaign' | 'country'>('campaign');
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState('');
  const load = useCallback(async () => {
    setErr('');
    const { data, error } = await sb.rpc('meta_ads_dashboard', { _from: from, _to: to });
    if (error) setErr(error.message); else setD(data);
  }, [from, to]);
  useEffect(() => { load(); }, [load]);
  const t = d?.totals ?? {};
  const shop = Number(d?.shopify_revenue ?? 0);
  const g = Number(d?.google_cost ?? 0);
  const meta = Number(t.spend ?? 0);
  const total = g + meta;
  const rows = view === 'campaign' ? (d?.by_campaign ?? []).filter((r: any) => Number(r.spend) || Number(r.impressions)) : (d?.by_country ?? []);
  return (
    <Card>
      <CardHeader><CardTitle>MER global (Google Ads + Meta Ads) et performances Meta</CardTitle></CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex flex-wrap gap-2 items-center">
          <Input type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        {err && <p className="text-destructive">{err}</p>}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <K l="CA Shopify (réel, net HT)" v={eur(shop)} h={`${int(d?.shopify_orders)} commandes · référence`} />
          <K l="Dépenses Ads totales" v={eur(total)} h={`Google ${eur(g)} · Meta ${eur(meta)}`} />
          <K l="MER global" v={ratio(shop, total)} h="CA Shopify ÷ (Google + Meta)" />
          <K l="CPA global" v={d?.shopify_orders ? eur(total / d.shopify_orders) : '—'} h="Dépenses totales ÷ commandes Shopify" />
          <K l="Dépenses Meta" v={eur(meta)} h={`${int(t.clicks)} clics · ${int(t.impressions)} impr.`} />
          <K l="ROAS Meta (attribué)" v={ratio(t.purchase_value, meta)} h={`${eur(t.purchase_value)} attribués · ${Number(t.purchases ?? 0).toFixed(0)} achats`} />
          <K l="CPA Meta" v={t.purchases ? eur(meta / t.purchases) : '—'} h="Dépenses ÷ achats attribués Meta" />
          <K l="CPC Meta" v={t.clicks ? eur(meta / t.clicks) : '—'} h="Dépenses ÷ clics" />
        </div>
        <p className="text-xs text-muted-foreground">Les achats et la valeur attribués par Meta ne sont pas du CA : ils recoupent souvent les ventes comptées par Google. Seul le CA Shopify sert au MER, sur la même période que les dépenses. Les totaux viennent des données par campagne ; la vue par pays est une ventilation à part, jamais ajoutée aux totaux.</p>
        <Select value={view} onValueChange={(v) => setView(v as any)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="campaign">Par campagne</SelectItem><SelectItem value="country">Par pays</SelectItem></SelectContent>
        </Select>
        <Table>
          <TableHeader><TableRow><TableHead>{view === 'campaign' ? 'Campagne' : 'Pays'}</TableHead><TableHead className="text-right">Dépenses</TableHead><TableHead className="text-right">Clics</TableHead><TableHead className="text-right">Impr.</TableHead><TableHead className="text-right">Achats</TableHead><TableHead className="text-right">Valeur attribuée</TableHead><TableHead className="text-right">ROAS Meta</TableHead></TableRow></TableHeader>
          <TableBody>{rows.map((r: any, i: number) => (
            <TableRow key={i}><TableCell className="font-medium">{view === 'campaign' ? (r.name ?? r.campaign_id) : r.country}</TableCell>
              <TableCell className="text-right">{eur(r.spend)}</TableCell><TableCell className="text-right">{int(r.clicks)}</TableCell>
              <TableCell className="text-right">{int(r.impressions)}</TableCell><TableCell className="text-right">{Number(r.purchases).toFixed(0)}</TableCell>
              <TableCell className="text-right">{eur(r.purchase_value)}</TableCell><TableCell className="text-right">{ratio(r.purchase_value, r.spend)}</TableCell></TableRow>))}</TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function K({ l, v, h }: { l: string; v: string; h?: string }) {
  return <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">{l}</div><div className="text-xl font-semibold">{v}</div>{h && <div className="text-xs text-muted-foreground">{h}</div>}</div>;
}
