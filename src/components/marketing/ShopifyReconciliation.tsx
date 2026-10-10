import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2 } from 'lucide-react';

const sb = supabase as any;
const TZ = 'Europe/Paris';
const parisDay = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(iso));
const utcDay = (iso: string) => new Date(iso).toISOString().slice(0, 10);
const r2 = (n: number) => Math.round(n * 100) / 100;
const eur = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n || 0);
const pct = (d: number, ref: number) => (ref ? `${((d / ref) * 100).toFixed(2)} %` : '—');
const day = (d: Date) => d.toISOString().slice(0, 10);

async function fetchAll(build: (q: any) => any, table: string, cols: string) {
  const out: any[] = [];
  for (let p = 0; ; p++) {
    const { data, error } = await build(sb.from(table).select(cols)).range(p * 1000, p * 1000 + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

type Order = { id: number; name: string; created_at_shop: string; cancelled_at: string | null; test: boolean; currency: string | null;
  financial_status: string | null; subtotal: number; total_discounts: number; total_tax: number; total_shipping: number;
  total_price: number; total_refunded: number; net_revenue: number };

export function ShopifyReconciliation() {
  const [from, setFrom] = useState(day(new Date(Date.now() - 30 * 86400e3)));
  const [to, setTo] = useState(day(new Date()));
  const [refNet, setRefNet] = useState('');
  const [refTotal, setRefTotal] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<any>(null);

  const run = async () => {
    setBusy(true); setRes(null);
    try {
      const lo = new Date(from); lo.setUTCDate(lo.getUTCDate() - 1);
      const hi = new Date(to); hi.setUTCDate(hi.getUTCDate() + 2);
      const orders: Order[] = (await fetchAll((q) => q.gte('created_at_shop', lo.toISOString()).lt('created_at_shop', hi.toISOString()).order('id'),
        'shopify_orders', 'id,name,created_at_shop,cancelled_at,test,currency,financial_status,subtotal,total_discounts,total_tax,total_shipping,total_price,total_refunded,net_revenue'))
        .map((o: any) => ({ ...o, ...Object.fromEntries(['subtotal', 'total_discounts', 'total_tax', 'total_shipping', 'total_price', 'total_refunded', 'net_revenue'].map((k) => [k, Number(o[k]) || 0])) }));
      const refunds = await fetchAll((q) => q.order('id'), 'shopify_refunds', 'id,order_id,created_at_shop,amount');
      const inP = (d: string) => d >= from && d <= to;

      // A — dashboard actuel : jour UTC, hors annulées/test, net = TTC actuel − taxes
      const dash = orders.filter((o) => inP(utcDay(o.created_at_shop)) && !o.cancelled_at && !o.test);
      const sum = (a: Order[], k: keyof Order) => r2(a.reduce((s, o) => s + (o[k] as number), 0));
      const dashNet = sum(dash, 'net_revenue');

      // B — logique « rapport Shopify » : jour Paris, annulées incluses, retours à la date du remboursement
      const pOrders = orders.filter((o) => inP(parisDay(o.created_at_shop)) && !o.test);
      const pIds = new Set(pOrders.map((o) => o.id));
      const allById = new Map(orders.map((o) => [o.id, o]));
      const refIn = refunds.filter((r: any) => r.created_at_shop && inP(parisDay(r.created_at_shop)));
      const salesAtOrder = r2(pOrders.reduce((s, o) => s + o.total_price + o.total_refunded, 0)); // TTC avant retours
      const returnsDated = r2(refIn.reduce((s: number, r: any) => s + Number(r.amount), 0));
      const shopTotal = r2(salesAtOrder - returnsDated);
      const taxP = sum(pOrders, 'total_tax'), shipP = sum(pOrders, 'total_shipping'), discP = sum(pOrders, 'total_discounts');

      // Décomposition des écarts (dashboard → logique Shopify, en TTC puis HT)
      const shipDash = sum(dash, 'total_shipping');
      const dashIds = new Set(dash.map((o) => o.id));
      const tzOnly = orders.filter((o) => !o.test && !o.cancelled_at && dashIds.has(o.id) !== pIds.has(o.id));
      const tzDelta = r2(tzOnly.reduce((s, o) => s + (pIds.has(o.id) ? 1 : -1) * o.net_revenue, 0));
      const cancelled = pOrders.filter((o) => o.cancelled_at);
      const cancelDelta = r2(cancelled.reduce((s, o) => s + o.total_price - o.total_tax, 0));
      const refOrdersInP = refunds.filter((r: any) => pIds.has(r.order_id));
      const refOutDate = refOrdersInP.filter((r: any) => !r.created_at_shop || !inP(parisDay(r.created_at_shop)));
      const refOtherOrder = refIn.filter((r: any) => !pIds.has(r.order_id));
      const refDateDelta = r2(refOutDate.reduce((s: number, r: any) => s + Number(r.amount), 0) - refOtherOrder.reduce((s: number, r: any) => s + Number(r.amount), 0));
      const unpaid = pOrders.filter((o) => !['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(o.financial_status ?? ''));
      const nonEur = pOrders.filter((o) => o.currency && o.currency !== 'EUR');

      const explain: any[] = [];
      tzOnly.forEach((o) => explain.push({ o, why: `Fuseau horaire : jour UTC ${utcDay(o.created_at_shop)} / jour Paris ${parisDay(o.created_at_shop)}`, amt: (pIds.has(o.id) ? 1 : -1) * o.net_revenue }));
      cancelled.forEach((o) => explain.push({ o, why: `Annulée le ${parisDay(o.cancelled_at!)} : exclue du dashboard, comptée en vente puis retour par Shopify`, amt: o.total_price + o.total_refunded }));
      refOutDate.forEach((r: any) => { const o = allById.get(r.order_id)!; explain.push({ o, why: `Remboursement du ${r.created_at_shop ? parisDay(r.created_at_shop) : '?'} hors période : déduit par le dashboard à la date de commande`, amt: Number(r.amount) }); });
      refOtherOrder.forEach((r: any) => explain.push({ o: allById.get(r.order_id) ?? { id: r.order_id, name: `#${r.order_id}`, created_at_shop: null }, why: `Remboursement du ${parisDay(r.created_at_shop)} sur une commande hors période : déduit par Shopify, pas par le dashboard`, amt: -Number(r.amount) }));
      unpaid.forEach((o) => explain.push({ o, why: `Statut ${o.financial_status} : compté par le dashboard`, amt: o.net_revenue }));
      nonEur.forEach((o) => explain.push({ o, why: `Devise ${o.currency} : montants en devise boutique`, amt: o.net_revenue }));

      setRes({ dash, dashNet, shipDash, dashTax: sum(dash, 'total_tax'), dashTotal: sum(dash, 'total_price'), dashDisc: sum(dash, 'total_discounts'), dashRef: sum(dash, 'total_refunded'),
        salesAtOrder, returnsDated, shopTotal, taxP, shipP, discP, pCount: pOrders.length, tzDelta, cancelDelta, refDateDelta, unpaid, nonEur, cancelled, explain });
    } catch (e: any) { setRes({ error: e.message }); }
    setBusy(false);
  };

  const n = (s: string) => Number(s.replace(/\s/g, '').replace(',', '.'));
  const shopNetApprox = res ? r2(res.shopTotal - res.taxP - res.shipP) : 0;
  const dashNetExShip = res ? r2(res.dashNet - res.shipDash) : 0;

  return (
    <Card>
      <CardHeader><CardTitle>Audit de réconciliation Shopify (lecture seule)</CardTitle></CardHeader>
      <CardContent className="space-y-5 text-sm">
        <div className="rounded border p-3 space-y-1 text-muted-foreground">
          <p><b className="text-foreground">Calcul actuel du CA du dashboard :</b> CA net = <code>currentTotalPrice − currentTotalTax</code> par commande (montants « actuels » Shopify, déjà diminués des remboursements et modifications).</p>
          <p>• <b>HT</b> : oui (taxes retirées). • <b>Livraison</b> : <b>incluse</b> (currentTotalPrice la contient), alors que les « Ventes nettes » Shopify l'excluent.</p>
          <p>• <b>Retours</b> : déduits à la date de la commande, alors que Shopify les date au jour du remboursement. • <b>Annulées</b> : exclues entièrement (Shopify compte la vente puis un retour à la date d'annulation). • <b>Test</b> : exclues.</p>
          <p>• <b>Impayées</b> : aucun filtre sur le statut de paiement. • <b>Devise</b> : devise boutique (shopMoney). • <b>Jour</b> : découpé en UTC ; Shopify utilise le fuseau de la boutique (supposé {TZ}).</p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <Input type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} data-readonly-allow />
          <Input type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} data-readonly-allow />
          <Input placeholder="Ventes nettes Shopify (optionnel)" className="w-60" value={refNet} onChange={(e) => setRefNet(e.target.value)} data-readonly-allow />
          <Input placeholder="Ventes totales Shopify (optionnel)" className="w-60" value={refTotal} onChange={(e) => setRefTotal(e.target.value)} data-readonly-allow />
          <Button onClick={run} disabled={busy} data-readonly-allow>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Lancer l'audit</Button>
        </div>
        <p className="text-xs text-muted-foreground">Saisis les chiffres du rapport Shopify « Ventes » sur la même période pour obtenir l'écart exact.</p>

        {res?.error && <p className="text-destructive">{res.error}</p>}
        {res && !res.error && <>
          <Table>
            <TableHeader><TableRow><TableHead>Composante</TableHead><TableHead className="text-right">Dashboard actuel (jour UTC)</TableHead><TableHead className="text-right">Logique Shopify (jour Paris, retours datés)</TableHead></TableRow></TableHeader>
            <TableBody>
              <TableRow><TableCell>Commandes</TableCell><TableCell className="text-right">{res.dash.length}</TableCell><TableCell className="text-right">{res.pCount} (dont {res.cancelled.length} annulées)</TableCell></TableRow>
              <TableRow><TableCell>Ventes TTC avant retours</TableCell><TableCell className="text-right">{eur(res.dashTotal + res.dashRef)}</TableCell><TableCell className="text-right">{eur(res.salesAtOrder)}</TableCell></TableRow>
              <TableRow><TableCell>Remises (actuelles)</TableCell><TableCell className="text-right">{eur(res.dashDisc)}</TableCell><TableCell className="text-right">{eur(res.discP)}</TableCell></TableRow>
              <TableRow><TableCell>Retours / remboursements</TableCell><TableCell className="text-right">{eur(res.dashRef)} (date commande)</TableCell><TableCell className="text-right">{eur(res.returnsDated)} (date remboursement)</TableCell></TableRow>
              <TableRow><TableCell>Taxes</TableCell><TableCell className="text-right">{eur(res.dashTax)}</TableCell><TableCell className="text-right">{eur(res.taxP)}</TableCell></TableRow>
              <TableRow><TableCell>Livraison</TableCell><TableCell className="text-right">{eur(res.shipDash)}</TableCell><TableCell className="text-right">{eur(res.shipP)}</TableCell></TableRow>
              <TableRow><TableCell>Ventes totales TTC</TableCell><TableCell className="text-right">{eur(res.dashTotal)}</TableCell><TableCell className="text-right">{eur(res.shopTotal)}</TableCell></TableRow>
              <TableRow className="font-semibold"><TableCell>CA affiché (HT, livraison incluse)</TableCell><TableCell className="text-right">{eur(res.dashNet)}</TableCell><TableCell className="text-right">—</TableCell></TableRow>
              <TableRow className="font-semibold"><TableCell>Ventes nettes HT hors livraison</TableCell><TableCell className="text-right">{eur(dashNetExShip)}</TableCell><TableCell className="text-right">{eur(shopNetApprox)} (approx.)</TableCell></TableRow>
            </TableBody>
          </Table>

          <div>
            <h3 className="font-semibold mb-2">Écarts expliqués (CA dashboard vs Shopify)</h3>
            <Table>
              <TableHeader><TableRow><TableHead>Cause</TableHead><TableHead className="text-right">Écart €</TableHead><TableHead className="text-right">% du CA dashboard</TableHead></TableRow></TableHeader>
              <TableBody>
                {[
                  ['Livraison incluse dans le CA dashboard', res.shipDash],
                  ['Fuseau horaire (UTC vs Paris)', res.tzDelta],
                  ['Annulées exclues (HT actuel)', res.cancelDelta],
                  ['Retours datés à la commande vs au remboursement (TTC)', res.refDateDelta],
                  ['Commandes non payées comptées', r2(res.unpaid.reduce((s: number, o: Order) => s + o.net_revenue, 0))],
                  ['Commandes hors EUR', r2(res.nonEur.reduce((s: number, o: Order) => s + o.net_revenue, 0))],
                ].map(([l, v]: any) => <TableRow key={l}><TableCell>{l}</TableCell><TableCell className="text-right">{eur(v)}</TableCell><TableCell className="text-right">{pct(v, res.dashNet)}</TableCell></TableRow>)}
                {refNet && <TableRow className="font-semibold"><TableCell>Écart vs « Ventes nettes » Shopify saisies ({eur(n(refNet))})</TableCell><TableCell className="text-right">{eur(dashNetExShip - n(refNet))} <span className="text-muted-foreground font-normal">(hors livr.)</span> / {eur(res.dashNet - n(refNet))} <span className="text-muted-foreground font-normal">(affiché)</span></TableCell><TableCell className="text-right">{pct(res.dashNet - n(refNet), n(refNet))}</TableCell></TableRow>}
                {refTotal && <TableRow className="font-semibold"><TableCell>Écart vs « Ventes totales » Shopify saisies ({eur(n(refTotal))})</TableCell><TableCell className="text-right">{eur(res.shopTotal - n(refTotal))} <span className="text-muted-foreground font-normal">(logique Shopify)</span> / {eur(res.dashTotal - n(refTotal))} <span className="text-muted-foreground font-normal">(dashboard)</span></TableCell><TableCell className="text-right">{pct(res.dashTotal - n(refTotal), n(refTotal))}</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Commandes expliquant les écarts ({res.explain.length})</h3>
            {res.explain.length === 0 ? <p className="text-muted-foreground">Aucune commande particulière : l'écart restant vient de la livraison incluse.</p> : (
              <div className="max-h-96 overflow-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Commande</TableHead><TableHead>Créée (Paris)</TableHead><TableHead>Statut</TableHead><TableHead>Explication</TableHead><TableHead className="text-right">Montant</TableHead></TableRow></TableHeader>
                  <TableBody>{res.explain.slice(0, 300).map((e: any, i: number) => (
                    <TableRow key={i}><TableCell>{e.o.name}</TableCell><TableCell>{e.o.created_at_shop ? new Date(e.o.created_at_shop).toLocaleString('fr-FR', { timeZone: TZ }) : 'hors période'}</TableCell>
                      <TableCell>{e.o.financial_status && <Badge variant="outline">{e.o.financial_status}</Badge>}</TableCell>
                      <TableCell>{e.why}</TableCell><TableCell className="text-right">{eur(e.amt)}</TableCell></TableRow>))}</TableBody>
                </Table>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Limites : les remboursements ne sont pas ventilés (produits / taxes / livraison) dans les données stockées, ni les ventes brutes avant remise ; les « Ventes nettes » côté Shopify sont donc approchées. Aucune formule ni donnée n'a été modifiée.</p>
        </>}
      </CardContent>
    </Card>
  );
}
