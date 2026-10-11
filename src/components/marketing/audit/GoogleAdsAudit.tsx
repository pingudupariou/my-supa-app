import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, ChevronDown, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const sb = supabase as any;
const eur = (n: number | null | undefined) => n == null ? '—' : `${Math.round(n).toLocaleString('fr-FR')} €`;
const BIDDING: Record<string, string> = {
  TARGET_ROAS: 'ROAS cible', TARGET_SPEND: 'Maximiser les clics', MAXIMIZE_CONVERSION_VALUE: 'Maximiser la valeur',
  MAXIMIZE_CONVERSIONS: 'Maximiser les conversions', MANUAL_CPC: 'CPC manuel', TARGET_CPA: 'CPA cible',
};
const MONTHLY_REF = 12000;

async function fetchOffers() {
  const out: any[] = [];
  for (let p = 0; ; p++) {
    const { data, error } = await sb.from('merchant_offers').select('offer_id,title,product_type,feed_label').order('name').range(p * 1000, p * 1000 + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

function scopeOf(groups: any[]) {
  const defined = groups.filter((g) => g.dim && g.value != null);
  const excluded = groups.filter((g) => g.negative || g.type === 'UNIT_EXCLUDED');
  if (!defined.length) return 'Tous les produits';
  const parts = [...new Set(defined.map((g) => `${g.dim === 'item_id' ? 'ID' : g.dim.replace('custom_label_', 'label ')} = ${g.value}`))];
  return `${parts.slice(0, 4).join(', ')}${parts.length > 4 ? ` +${parts.length - 4}` : ''}${excluded.length ? ` · ${excluded.length} exclusion(s)` : ''}`;
}

export function GoogleAdsAudit({ canWrite }: { canWrite: boolean }) {
  const [snap, setSnap] = useState<any>(null);
  const [offers, setOffers] = useState<any[]>([]);
  const [countries, setCountries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, o, c] = await Promise.all([
      sb.from('google_ads_structure_snapshots').select('*').in('status', ['success', 'partial']).order('taken_at', { ascending: false }).limit(1).maybeSingle(),
      fetchOffers().catch(() => []),
      sb.rpc('google_ads_country_vs_shopify', { _days: 90 }),
    ]);
    setSnap(s.data); setOffers(o); setCountries(c.data ?? []); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const refresh = async () => {
    setRunning(true);
    const { data, error } = await supabase.functions.invoke('google-ads-structure', { method: 'POST', body: {} });
    setRunning(false);
    if (error || data?.status === 'error') toast.error('Lecture Google Ads échouée'); else { toast.success('Structure relue'); load(); }
  };

  const a = useMemo(() => {
    if (!snap) return null;
    const d = snap.data ?? {};
    const camps: any[] = d.campaigns ?? [];
    const offerById = new Map(offers.map((o) => [String(o.offer_id).toLowerCase(), o]));
    const prods: any[] = d.products_90d ?? [];
    const byCamp = new Map<string, any>();
    for (const c of camps) byCamp.set(c.id, { ...c, locations: [], excludedLocations: [], groups: [], listing: [], lost: null, cost: 0, value: 0, conv: 0, items: 0 });
    for (const x of d.criteria ?? []) {
      const c = byCamp.get(x.campaign_id); if (!c || x.type !== 'LOCATION') continue;
      (x.negative ? c.excludedLocations : c.locations).push(x.value);
    }
    for (const g of [...(d.ad_groups ?? []), ...(d.asset_groups ?? [])]) byCamp.get(g.campaign_id)?.groups.push(g);
    for (const l of [...(d.listing_groups_pmax ?? []), ...(d.listing_groups_shopping ?? [])]) byCamp.get(l.campaign_id)?.listing.push(l);
    for (const b of d.budget_lost ?? []) { const c = byCamp.get(b.campaign_id); if (c) c.lost = b.lost_budget; }
    const itemCamps = new Map<string, Set<string>>();
    for (const p of prods) {
      const c = byCamp.get(p.campaign_id); if (!c) continue;
      c.cost += p.cost; c.value += p.value; c.conv += p.conversions; if (p.impressions > 0) c.items++;
      if (p.impressions > 0) { const k = String(p.item_id).toLowerCase(); const s = itemCamps.get(k) ?? new Set(); s.add(p.campaign_id); itemCamps.set(k, s); }
    }
    const list = [...byCamp.values()].sort((x, y) => (x.status === 'ENABLED' ? 0 : 1) - (y.status === 'ENABLED' ? 0 : 1) || y.cost - x.cost);
    const enabled = list.filter((c) => c.status === 'ENABLED');
    const dailyBudget = enabled.reduce((s, c) => s + (c.budget ?? 0), 0);

    // Overlap: products shown by 2+ enabled campaigns sharing a targeted location.
    const overlap = new Map<string, { pair: string; items: number }>();
    for (const [item, cs] of itemCamps) {
      const arr = [...cs].map((id) => byCamp.get(id)).filter((c) => c?.status === 'ENABLED');
      for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
        const shared = arr[i].locations.filter((l: string) => arr[j].locations.includes(l));
        if (!shared.length && arr[i].locations.length && arr[j].locations.length) continue;
        const k = [arr[i].name, arr[j].name].sort().join(' ↔ ');
        const cur = overlap.get(k) ?? { pair: k, items: 0 }; cur.items++; overlap.set(k, cur);
      }
      void item;
    }
    // Merchant offers never shown in 90 days, by family.
    const shown = new Set(itemCamps.keys());
    const unseen = new Map<string, number>();
    for (const o of offers) if (!shown.has(String(o.offer_id).toLowerCase())) unseen.set(o.product_type || 'Sans famille', (unseen.get(o.product_type || 'Sans famille') ?? 0) + 1);
    const unknownItems = [...shown].filter((k) => !offerById.has(k)).length;

    const alerts: { level: 'warn' | 'info'; text: string }[] = [];
    for (const c of enabled) {
      if (c.lost != null && c.lost > 0.2) alerts.push({ level: 'warn', text: `${c.name} : ${Math.round(c.lost * 100)} % d'impressions perdues faute de budget (30 j).` });
      if (c.cost > 50 && c.conv === 0) alerts.push({ level: 'warn', text: `${c.name} : ${eur(c.cost)} dépensés en 90 j sur les produits sans conversion attribuée.` });
      if (!c.locations.length) alerts.push({ level: 'info', text: `${c.name} : aucun pays ciblé explicitement (diffusion possible partout).` });
    }
    for (const o of [...overlap.values()].sort((x, y) => y.items - x.items).slice(0, 8))
      alerts.push({ level: 'info', text: `Chevauchement possible : ${o.pair} — ${o.items} produits diffusés par les deux dans un même pays (90 j). À vérifier, pas forcément une cannibalisation.` });
    for (const c of countries) if (c.google_cost > 100 && c.shopify_orders === 0)
      alerts.push({ level: 'warn', text: `${c.country ?? '?'} : ${eur(c.google_cost)} dépensés en Google Ads sans commande Shopify sur 90 j.` });
    return { list, enabled, dailyBudget, alerts, unseen: [...unseen.entries()].sort((x, y) => y[1] - x[1]), unseenTotal: [...unseen.values()].reduce((s, n) => s + n, 0), unknownItems, changes: d.changes ?? [], d };
  }, [snap, offers, countries]);

  if (loading) return <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Chargement de l'audit…</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Lecture seule du compte Novatoride.com — aucune campagne n'est modifiée. Dernière lecture : {snap ? new Date(snap.taken_at).toLocaleString('fr-FR') : 'jamais'} · relue chaque nuit.</p>
        {canWrite && <Button size="sm" variant="outline" onClick={refresh} disabled={running}>{running ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />}Relire la structure</Button>}
      </div>
      {!a ? <Card><CardContent className="pt-6 text-sm text-muted-foreground">Aucune lecture disponible.</CardContent></Card> : <>
        {snap.errors?.length > 0 && <p className="text-xs text-destructive">Sections non lues : {snap.errors.map((e: any) => e.section).join(', ')}</p>}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            ['Campagnes actives', String(a.enabled.length)],
            ['Shopping / PMax / autres', `${a.enabled.filter((c) => c.type === 'SHOPPING').length} / ${a.enabled.filter((c) => c.type === 'PERFORMANCE_MAX').length} / ${a.enabled.filter((c) => !['SHOPPING', 'PERFORMANCE_MAX'].includes(c.type)).length}`],
            ['Budget quotidien Google', eur(a.dailyBudget)],
            ['≈ Budget mensuel Google', eur(a.dailyBudget * 30.4)],
            ['Référence Google + Meta', `${eur(MONTHLY_REF)} / mois`],
          ].map(([l, v]) => <Card key={l}><CardContent className="p-3"><div className="text-xs text-muted-foreground">{l}</div><div className="text-lg font-semibold">{v}</div></CardContent></Card>)}
        </div>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Constats factuels</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {a.alerts.length === 0 && <p className="text-muted-foreground">Aucun constat.</p>}
            {a.alerts.map((x, i) => <div key={i} className="flex gap-2"><AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${x.level === 'warn' ? 'text-destructive' : 'text-muted-foreground'}`} />{x.text}</div>)}
            <p className="pt-2 text-xs text-muted-foreground">Valeurs « attribuées » = déclarées par Google, pas des ventes réelles. Les ventes réelles restent celles de Shopify.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Campagnes (produits sur 90 jours)</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead /><TableHead>Campagne</TableHead><TableHead>Type</TableHead><TableHead>Enchères</TableHead><TableHead className="text-right">Budget/j</TableHead>
                <TableHead>Pays</TableHead><TableHead>Produits ciblés</TableHead><TableHead className="text-right">Produits diffusés</TableHead>
                <TableHead className="text-right">Coût 90 j</TableHead><TableHead className="text-right">Valeur attribuée</TableHead><TableHead className="text-right">ROAS attr.</TableHead>
              </TableRow></TableHeader>
              <TableBody>{a.list.map((c) => (<>
                <TableRow key={c.id} className={c.status !== 'ENABLED' ? 'opacity-60' : ''}>
                  <TableCell className="p-1"><button onClick={() => setOpen(open === c.id ? null : c.id)}>{open === c.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button></TableCell>
                  <TableCell className="font-medium">{c.name}{c.status !== 'ENABLED' && <Badge variant="outline" className="ml-1">{c.status === 'PAUSED' ? 'En pause' : c.status}</Badge>}</TableCell>
                  <TableCell>{c.type === 'PERFORMANCE_MAX' ? 'PMax' : c.type === 'SHOPPING' ? 'Shopping' : c.type}</TableCell>
                  <TableCell className="text-xs">{BIDDING[c.bidding] ?? c.bidding}{c.target_roas ? ` ${Math.round(c.target_roas * 100)} %` : ''}{c.target_cpa ? ` ${eur(c.target_cpa)}` : ''}</TableCell>
                  <TableCell className="text-right">{eur(c.budget)}{c.budget_shared && <span className="text-xs text-muted-foreground"> partagé</span>}</TableCell>
                  <TableCell className="text-xs">{c.locations.join(', ') || 'Tous'}{c.excludedLocations.length ? ` (−${c.excludedLocations.length})` : ''}</TableCell>
                  <TableCell className="text-xs">{scopeOf(c.listing)}</TableCell>
                  <TableCell className="text-right">{c.items}</TableCell>
                  <TableCell className="text-right">{eur(c.cost)}</TableCell>
                  <TableCell className="text-right">{eur(c.value)}</TableCell>
                  <TableCell className="text-right">{c.cost ? (c.value / c.cost).toFixed(1) : '—'}</TableCell>
                </TableRow>
                {open === c.id && <TableRow key={c.id + 'd'}><TableCell colSpan={11} className="bg-muted/30 text-xs">
                  <div><b>Groupes :</b> {c.groups.map((g: any) => `${g.name}${g.strength ? ` (force ${g.strength})` : ''}${g.status !== 'ENABLED' ? ` [${g.status}]` : ''}`).join(' · ') || '—'}</div>
                  {c.type === 'PERFORMANCE_MAX' && <div><b>Thèmes de recherche :</b> {(a.d.signals ?? []).filter((s: any) => c.groups.some((g: any) => g.id === s.asset_group_id) && s.search_theme).map((s: any) => s.search_theme).slice(0, 30).join(', ') || '—'}</div>}
                  {c.lost != null && <div><b>Impressions perdues (budget, 30 j) :</b> {Math.round(c.lost * 100)} %</div>}
                  {c.feed_label && <div><b>Flux Merchant :</b> {c.feed_label}</div>}
                </TableCell></TableRow>}
              </>))}</TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Offres Merchant jamais diffusées (90 j)</CardTitle></CardHeader>
            <CardContent className="text-sm">
              <p className="mb-2"><b>{a.unseenTotal}</b> offres sur {offers.length} sans aucune impression Shopping/PMax.{a.unknownItems > 0 && ` ${a.unknownItems} produits diffusés n'existent plus dans le flux actuel.`}</p>
              <Table><TableBody>{a.unseen.slice(0, 15).map(([f, n]) => <TableRow key={f}><TableCell className="py-1">{f}</TableCell><TableCell className="py-1 text-right">{n}</TableCell></TableRow>)}</TableBody></Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Pays : Google Ads face à Shopify (90 j)</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Pays</TableHead><TableHead className="text-right">Coût Google</TableHead><TableHead className="text-right">Valeur attribuée</TableHead><TableHead className="text-right">Commandes Shopify</TableHead><TableHead className="text-right">CA Shopify HT</TableHead></TableRow></TableHeader>
                <TableBody>{[...countries].sort((x, y) => y.google_cost - x.google_cost).slice(0, 20).map((c) => (
                  <TableRow key={c.country ?? '?'}><TableCell>{c.country ?? '?'}</TableCell><TableCell className="text-right">{eur(c.google_cost)}</TableCell><TableCell className="text-right">{eur(c.google_value)}</TableCell>
                    <TableCell className="text-right">{c.shopify_orders}</TableCell><TableCell className="text-right">{eur(c.shopify_revenue)}</TableCell></TableRow>))}</TableBody>
              </Table>
              <p className="p-3 text-xs text-muted-foreground">CA Shopify = toutes sources confondues, pas uniquement Google.</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Modifications récentes (30 j, {a.changes.length})</CardTitle></CardHeader>
          <CardContent className="max-h-72 overflow-auto p-0">
            <Table><TableBody>{a.changes.slice(0, 100).map((ch: any, i: number) => (
              <TableRow key={i}><TableCell className="py-1 text-xs">{new Date(ch.at).toLocaleString('fr-FR')}</TableCell>
                <TableCell className="py-1 text-xs">{a.list.find((c) => c.id === ch.campaign_id)?.name ?? '—'}</TableCell>
                <TableCell className="py-1 text-xs">{ch.op} · {ch.resource}</TableCell>
                <TableCell className="py-1 text-xs text-muted-foreground">{ch.by ?? ch.client}</TableCell></TableRow>))}</TableBody></Table>
          </CardContent>
        </Card>
      </>}
    </div>
  );
}
