import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, AlertTriangle } from 'lucide-react';

const eur = (n: number | null | undefined) => n == null ? '—' : n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)} %` : '—');
const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return iso(d); };

type Row = { k: string; prod_ht: number; cov_ht: number; cogs: number; est_ht: number; ship_ht: number; inv: number; google: number; meta: number; g_value?: number; m_value?: number };

export function B2CAdMargin() {
  const [from, setFrom] = useState(daysAgo(90));
  const [to, setTo] = useState(daysAgo(1));
  const [ship, setShip] = useState(false);
  const [shipCost, setShipCost] = useState<string>(() => localStorage.getItem('sales-ship-cost') ?? '');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { localStorage.setItem('sales-ship-cost', shipCost); }, [shipCost]);
  const shipCostNum = shipCost.trim() === '' ? null : Number(shipCost.replace(',', '.'));

  const load = async () => {
    setLoading(true); setErr(null);
    const { data: d, error } = await supabase.rpc('b2c_ad_margin' as any, { _from: from, _to: to, _include_shipping: ship, _ship_cost_per_doc: shipCostNum });
    if (error) setErr(error.message.includes('forbidden') ? 'Accès requis à Marketing Intelligence et à Statistiques commerciales.' : error.message);
    setData(d); setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [from, to, ship]);

  const margin = (r: Row) => {
    let m = (r.cov_ht ?? 0) - (r.cogs ?? 0);
    if (ship) { m += r.ship_ht ?? 0; if (shipCostNum != null) m -= (r.inv ?? 0) * shipCostNum; }
    return m;
  };
  const flags = (r: Row) => (
    <span className="inline-flex gap-1">
      {r.prod_ht > 0 && r.cov_ht < r.prod_ht - 0.5 && <Badge variant="destructive">incomplet {pct(r.cov_ht, r.prod_ht)}</Badge>}
      {r.est_ht > 0 && <Badge variant="secondary">estimée</Badge>}
    </span>
  );

  const months: Row[] = data?.by_month ?? [];
  const countries: Row[] = data?.by_country ?? [];
  const products: any[] = data?.by_product ?? [];
  const t = data?.totals;
  const sum = (rs: Row[], f: (r: Row) => number) => rs.reduce((a, r) => a + f(r), 0);
  const totAds = (t?.google ?? 0) + (t?.meta ?? 0);
  const totBefore = sum(months, margin);
  const totProd = sum(months, (r) => r.prod_ht), totCov = sum(months, (r) => r.cov_ht);

  const countryInfo = useMemo(() => {
    const withSales = countries.filter((c) => c.prod_ht !== 0);
    const noSales = countries.filter((c) => c.prod_ht === 0).reduce((a, c) => a + c.google + c.meta, 0);
    const gNoCountry = (t?.google ?? 0) - (data?.country_gaps?.google_country_total ?? 0);
    const mNoCountry = (t?.meta ?? 0) - (data?.country_gaps?.meta_country_total ?? 0);
    return { withSales, noSales, gNoCountry, mNoCountry };
  }, [countries, t, data]);

  const shipLabel = ship ? (shipCostNum != null ? `livraison facturée − ${eur(shipCostNum)} estimé par facture` : 'livraison facturée incluse, coût réel inconnu') : 'hors transport';
  const snap = data?.snapshot;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Marge B2C après publicité</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap items-end gap-3">
            <label className="space-y-1"><span className="text-xs text-muted-foreground">Du</span><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
            <label className="space-y-1"><span className="text-xs text-muted-foreground">Au</span><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
            {snap && <Button variant="outline" size="sm" onClick={() => { setFrom(snap.from); setTo(snap.to); }}>Aligner sur la fenêtre Shopping ({snap.from} → {snap.to})</Button>}
            <label className="flex items-center gap-2"><Switch checked={ship} onCheckedChange={setShip} />Inclure la livraison facturée</label>
            {ship && <label className="space-y-1"><span className="text-xs text-muted-foreground">Coût d'expédition estimé / facture</span><Input className="w-32" value={shipCost} onChange={(e) => setShipCost(e.target.value)} onBlur={load} placeholder="vide = inconnu" /></label>}
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>
          {err && <p className="text-destructive">{err}</p>}
          <p className="text-muted-foreground">Ventes : factures et avoirs Erplain classés B2C (Shopify), sans relire les commandes Shopify. Coûts : méthodes validées dans Production et BE. Publicité : dépenses Google + Meta. Les valeurs attribuées par Google et Meta sont affichées séparément et jamais additionnées. Transport : {shipLabel}.</p>
        </CardContent>
      </Card>

      {t && (
        <div className="grid gap-3 md:grid-cols-5">
          <Kpi l="CA produits HT B2C" v={eur(totProd)} s={`couverture coûts ${pct(totCov, totProd)}`} />
          <Kpi l="Marge avant Ads" v={eur(totBefore)} s={`${pct(totBefore, totCov)} du CA couvert`} />
          <Kpi l="Dépenses Ads" v={eur(totAds)} s={`Google ${eur(t.google)} · Meta ${eur(t.meta)}`} />
          <Kpi l="Marge après Ads" v={eur(totBefore - totAds)} s={totCov < totProd - 0.5 ? 'incomplète : coûts manquants' : ''} />
          <Kpi l="Attribué (non additionné)" v={`G ${eur(sum(months, (r) => r.g_value ?? 0))}`} s={`Meta ${eur(sum(months, (r) => r.m_value ?? 0))}`} />
        </div>
      )}

      {t && (
        <Tabs defaultValue="period">
          <TabsList><TabsTrigger value="period">Périodes</TabsTrigger><TabsTrigger value="country">Pays</TabsTrigger><TabsTrigger value="product">Produits</TabsTrigger><TabsTrigger value="rules">Méthode et données manquantes</TabsTrigger></TabsList>

          <TabsContent value="period">
            <Table><TableHeader><TableRow><TableHead>Mois</TableHead><TableHead className="text-right">CA produits HT</TableHead><TableHead className="text-right">Marge avant Ads</TableHead><TableHead className="text-right">Google</TableHead><TableHead className="text-right">Meta</TableHead><TableHead className="text-right">Marge après Ads</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>{months.map((r) => { const b = margin(r); return (
                <TableRow key={r.k}><TableCell>{r.k}</TableCell><TableCell className="text-right">{eur(r.prod_ht)}</TableCell><TableCell className="text-right">{eur(b)}</TableCell><TableCell className="text-right">{eur(r.google)}</TableCell><TableCell className="text-right">{eur(r.meta)}</TableCell><TableCell className="text-right font-medium">{eur(b - r.google - r.meta)}</TableCell><TableCell>{flags(r)}</TableCell></TableRow>); })}
              </TableBody></Table>
          </TabsContent>

          <TabsContent value="country" className="space-y-2">
            <p className="text-xs text-muted-foreground">Pays publicitaire = lieu de présence des internautes (Google) / pays Meta. Pays des ventes = pays de livraison Erplain. Ils sont rapprochés par code pays, ce qui reste une approximation : une personne vue en France peut se faire livrer ailleurs.</p>
            <Table><TableHeader><TableRow><TableHead>Pays</TableHead><TableHead className="text-right">CA livré HT</TableHead><TableHead className="text-right">Marge avant Ads</TableHead><TableHead className="text-right">Ads du pays</TableHead><TableHead className="text-right">Marge après Ads</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>{countryInfo.withSales.map((r) => { const b = margin(r), a = r.google + r.meta; return (
                <TableRow key={r.k}><TableCell>{r.k}</TableCell><TableCell className="text-right">{eur(r.prod_ht)}</TableCell><TableCell className="text-right">{eur(b)}</TableCell><TableCell className="text-right">{eur(a)}</TableCell><TableCell className="text-right font-medium">{eur(b - a)}</TableCell><TableCell>{flags(r)}</TableCell></TableRow>); })}
              </TableBody></Table>
            <Unalloc items={[
              ['Ads dans des pays sans vente B2C livrée', countryInfo.noSales],
              ['Google sans pays connu (total campagnes − ventilation pays)', countryInfo.gNoCountry],
              ['Meta sans pays connu', countryInfo.mNoCountry],
              ['Ventes sans pays de livraison (CA)', data?.country_gaps?.sales_no_country_ht ?? 0],
            ]} />
          </TabsContent>

          <TabsContent value="product" className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Direct = dépense Google Shopping du produit annoncé (identifiant d'offre Merchant → SKU unique → SKU de la ligne vendue), {snap?.aligned ? 'disponible pour cette période.' : 'disponible seulement sur la fenêtre Shopping (bouton « Aligner »). Sur cette période, tout est en allocation estimée.'}
              {' '}Allocation estimée = reste des dépenses Google + Meta réparti au prorata du CA produits HT B2C de la période. Un produit annoncé mais non acheté garde sa dépense directe avec un CA nul.
            </p>
            <Table><TableHeader><TableRow><TableHead>Produit</TableHead><TableHead className="text-right">CA HT</TableHead><TableHead className="text-right">Qté</TableHead><TableHead className="text-right">Marge avant Ads</TableHead><TableHead className="text-right">Direct</TableHead><TableHead className="text-right">Alloc. estimée</TableHead><TableHead className="text-right">Marge après Ads</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>{products.slice(0, 200).map((p) => { const b = p.cov_ht - p.cogs; return (
                <TableRow key={p.k}><TableCell className="max-w-[280px] truncate">{p.label}</TableCell><TableCell className="text-right">{eur(p.ca)}</TableCell><TableCell className="text-right">{p.q}</TableCell><TableCell className="text-right">{eur(b)}</TableCell><TableCell className="text-right">{eur(p.direct)}</TableCell><TableCell className="text-right">{eur(p.alloc)}</TableCell><TableCell className="text-right font-medium">{eur(b - p.direct - p.alloc)}</TableCell>
                  <TableCell>{flags({ ...p, prod_ht: p.ca } as Row)}</TableCell></TableRow>); })}
              </TableBody></Table>
            <p className="text-xs text-muted-foreground">Contrôle : direct {eur(t.direct)} + alloué {eur(t.pool - t.unallocated_products)} + non réparti {eur(t.unallocated_products)} = {eur(t.direct + t.pool)} (total Ads {eur(totAds)}). Transport exclu de la vue produit.</p>
            <Unalloc items={[['Non réparti (aucune vente B2C sur la période)', t.unallocated_products], ['Dépense Shopping sur offres sans SKU unique (incluse dans l\'allocation)', t.unmatched_item_cost], ['Dont direct sur produits annoncés non vendus', t.direct_unsold]]} />
          </TabsContent>

          <TabsContent value="rules" className="space-y-2 text-sm">
            <ul className="list-disc pl-5 space-y-1">
              <li>Marge avant Ads = CA produits HT des lignes avec coût validé − coût des produits vendus (avoirs avec quantité déduits). Un coût manquant n'est jamais compté 0 : la marge est « incomplète ».</li>
              <li>Marge estimée : coût lu après la date de vente.</li>
              <li>Chaque euro de publicité est compté une seule fois : par mois (total campagnes), par pays (ventilation pays, le reste est « non réparti »), par produit (direct ou alloué, le reste « non réparti »).</li>
              <li>Dernière synchro ventes Erplain : {data.last_sync?.erplain_sales ?? 'aucune'} · dernier jour Google : {data.last_sync?.last_day_google ?? '—'} · Meta : {data.last_sync?.last_day_meta ?? '—'}.</li>
              <li>Fenêtre Shopping (audit Google Ads) : {snap ? `${snap.from} → ${snap.to}` : 'aucun audit disponible'}.</li>
            </ul>
            {totProd === 0 && <p className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-4 w-4" />Aucune vente B2C Erplain sur la période : lancez l'import dans Statistiques commerciales.</p>}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function Kpi({ l, v, s }: { l: string; v: string; s?: string }) {
  return <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">{l}</div><div className="text-xl font-semibold">{v}</div>{s && <div className="text-xs text-muted-foreground">{s}</div>}</CardContent></Card>;
}
function Unalloc({ items }: { items: [string, number][] }) {
  return <div className="rounded-md border p-3 text-xs space-y-1"><div className="font-medium">Montants non répartis / données manquantes</div>{items.map(([l, v]) => <div key={l} className="flex justify-between"><span>{l}</span><span>{eur(v)}</span></div>)}</div>;
}
