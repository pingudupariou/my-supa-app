import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, RefreshCw, ChevronDown, ChevronRight, Send } from 'lucide-react';

const fmt = (v: any) => (v === null || v === undefined ? '—' : typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(2)) : String(v));
const STATUS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  ready: { label: 'À fabriquer', variant: 'default' },
  shortage: { label: 'Pièces manquantes', variant: 'destructive' },
  covered: { label: 'Couvert', variant: 'secondary' },
  incomplete: { label: 'Données incomplètes', variant: 'outline' },
};

export function PlanAtelierBoard({ isAdmin }: { isAdmin: boolean }) {
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncInfo, setSyncInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [includePending, setIncludePending] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [mo, setMo] = useState<Record<string, any>>({});

  const call = async (body: any) => {
    const { data, error } = await supabase.functions.invoke('erplain-sync', { body });
    if (error) {
      const status = (error as any)?.context?.status;
      throw new Error(status === 403 ? 'Accès réservé aux administrateurs.' : `Appel serveur impossible${status ? ` (HTTP ${status})` : ''} : ${error.message}`);
    }
    return data as any;
  };

  const loadPlan = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true); setError(null);
    try { setPlan(await call({ action: 'plan', includePending })); } catch (e) { setError((e as Error).message); }
    setLoading(false);
  }, [isAdmin, includePending]);

  useEffect(() => { loadPlan(); }, [loadPlan]);

  const sync = async (restart: boolean) => {
    setSyncing(true); setError(null);
    try {
      for (let i = 0, first = true; i < 60; i++, first = false) {
        const d = await call({ action: 'sync', restart: restart && first });
        if (d.status !== 'success') { setError(`Synchronisation interrompue : ${d.failure ?? d.message}`); break; }
        const c = d.counts ?? {};
        setSyncInfo(`${d.done ? 'Terminé' : `En cours : ${d.current} page ${d.page}`} — commandes ${c.orders ?? 0} (${c.order_lines ?? 0} lignes), stocks ${c.stocks ?? 0}, OF ${c.mos ?? 0}, nomenclatures ${c.boms ?? 0}, gammes ${c.routings ?? 0}`);
        if (d.done) break;
      }
    } catch (e) { setError((e as Error).message); }
    setSyncing(false);
    loadPlan();
  };

  const sendMo = async (p: any, confirm: boolean) => {
    setMo((m) => ({ ...m, [p.key]: { loading: true } }));
    try {
      const d = await call({ action: 'create_mo', key: p.idempotency_key, groupKey: p.key, quantity: p.to_build, includePending, confirm });
      setMo((m) => ({ ...m, [p.key]: d }));
    } catch (e) { setMo((m) => ({ ...m, [p.key]: { status: 'api_error', message: (e as Error).message } })); }
  };

  const proposals = useMemo(() => (plan?.proposals ?? []).filter((p: any) =>
    !filter || `${p.sku} ${p.variant_label} ${p.location_label}`.toLowerCase().includes(filter.toLowerCase())), [plan, filter]);
  const run = plan?.lastRun;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Données Erplain</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <Button onClick={() => sync(false)} disabled={syncing || !isAdmin} data-readonly-allow="true">
              {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}Actualiser depuis Erplain
            </Button>
            <Button variant="outline" onClick={() => sync(true)} disabled={syncing || !isAdmin} data-readonly-allow="true">Recommencer à zéro</Button>
          </div>
          {run && (
            <p className="text-sm text-muted-foreground">
              Dernière synchronisation : {new Date(run.finished_at ?? run.started_at).toLocaleString('fr-FR')} ({run.status === 'completed' ? 'complète' : run.status === 'running' ? 'en cours — relancer pour reprendre' : run.status})
              {' '}— {run.counts?.orders ?? 0} commandes ({run.counts?.order_lines ?? 0} lignes), {run.counts?.stocks ?? 0} stocks, {run.counts?.mos ?? 0} OF, {run.counts?.boms ?? 0} nomenclatures, {run.counts?.routings ?? 0} gammes
            </p>
          )}
          {run?.error && <p className="text-sm text-destructive">{run.error}</p>}
          {run?.notes?.length ? <ul className="text-xs text-muted-foreground list-disc pl-5">{run.notes.map((n: string, i: number) => <li key={i}>{n}</li>)}</ul> : null}
          {syncInfo && <p className="text-sm">{syncInfo}</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Plan atelier — besoins par variante et emplacement</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <details className="text-xs text-muted-foreground" data-readonly-allow="true">
            <summary className="cursor-pointer">Méthode de calcul</summary>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Commandes comptées : statut « active »{includePending ? ' et « pending_validation »' : ''}. Reste à expédier = commandé − expédié (le livré n'est pas re-déduit).</li>
              <li>Stock monté utilisable = disponible + réservé pour les lignes comptées (plafonné au réel). La réservation n'est ainsi comptée qu'une fois.</li>
              <li>OF en cours = reste à produire des OF non terminés et non annulés (tous statuts, y compris brouillons).</li>
              <li>À fabriquer = besoin − stock utilisable − OF en cours (jamais négatif).</li>
              <li>Composants : disponible − besoins non réservés des OF existants ; répartis par date d'expédition la plus proche, sans réutiliser les mêmes pièces.</li>
            </ul>
          </details>
          <div className="flex flex-wrap gap-3 items-center">
            <Input placeholder="Filtrer (SKU, libellé, emplacement)" value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-xs" data-readonly-allow="true" />
            <label className="flex items-center gap-2 text-sm" data-readonly-allow="true">
              <Checkbox checked={includePending} onCheckedChange={(v) => setIncludePending(!!v)} />Inclure les commandes en attente de validation
            </label>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {plan && !plan.writeEnabled && <Badge variant="outline">Envoi réel désactivé (simulation)</Badge>}
          </div>
          {plan?.excluded && <p className="text-xs text-muted-foreground">Lignes exclues : {plan.excluded.closedOrders} commandes non ouvertes, {plan.excluded.fullyShipped} déjà expédiées, {plan.excluded.noVariant} sans variante.</p>}
          {plan?.warnings?.length ? (
            <details className="text-xs text-destructive"><summary className="cursor-pointer" data-readonly-allow="true">{plan.warnings.length} incohérence(s) de stock à vérifier</summary>
              <ul className="list-disc pl-5">{plan.warnings.slice(0, 50).map((w: string, i: number) => <li key={i}>{w}</li>)}</ul></details>
          ) : null}
          <div className="overflow-auto border rounded-md">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left">
                <tr>{['', 'Produit', 'Emplacement', 'Commandes', 'Besoin', 'Stock monté', 'OF en cours', 'À fabriquer', 'Pièces manquantes', 'Statut'].map((h) => <th key={h} className="p-2 font-medium whitespace-nowrap">{h}</th>)}</tr>
              </thead>
              <tbody>
                {proposals.map((p: any) => {
                  const missing = p.components.filter((c: any) => c.missing > 0);
                  const isOpen = open === p.key;
                  const st = STATUS[p.status] ?? { label: p.status, variant: 'outline' as const };
                  const res = mo[p.key];
                  return (
                    <Fragment key={p.key}>
                      <tr className="border-t cursor-pointer hover:bg-muted/50" onClick={() => setOpen(isOpen ? null : p.key)} data-readonly-allow="true">
                        <td className="p-2">{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</td>
                        <td className="p-2"><div className="font-medium">{p.sku ?? p.variant_id}</div><div className="text-xs text-muted-foreground">{p.variant_label}</div></td>
                        <td className="p-2">{p.location_label ?? '—'}</td>
                        <td className="p-2">{new Set(p.lines.map((l: any) => l.order_id)).size}</td>
                        <td className="p-2">{fmt(p.need)}</td>
                        <td className="p-2">{fmt(p.usable)}</td>
                        <td className="p-2">{fmt(p.mo_remaining)}</td>
                        <td className="p-2 font-semibold">{fmt(p.to_build)}</td>
                        <td className="p-2">{missing.length ? missing.map((c: any) => `${c.sku ?? c.component_id} (−${fmt(c.missing)})`).join(', ') : '—'}</td>
                        <td className="p-2"><Badge variant={st.variant}>{st.label}</Badge></td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-muted/30"><td colSpan={10} className="p-3 space-y-3 text-xs">
                          <div className="grid md:grid-cols-2 gap-3">
                            <div>
                              <p className="font-medium mb-1">Détail du calcul</p>
                              <p>Besoin restant à expédier : {fmt(p.need)}</p>
                              <p>Stock Erplain : réel {fmt(p.stock?.on_hand)}, disponible {fmt(p.stock?.available)}, réservé {fmt(p.stock?.reserved)}</p>
                              <p>Réservé pour ces lignes : {fmt(p.reserved_in_scope)} → stock utilisable = min(réel, disponible + réservé lignes) = {fmt(p.usable)}</p>
                              <p>OF en cours : {p.mos.length ? p.mos.map((m: any) => `${m.label ?? m.id} [${m.status}] reste ${fmt(m.remaining_to_produce)}`).join(' ; ') : 'aucun'} → {fmt(p.mo_remaining)}</p>
                              <p className="font-medium">À fabriquer = {fmt(p.need)} − {fmt(p.usable)} − {fmt(p.mo_remaining)} = {fmt(p.to_build)}{p.buildable != null && p.buildable < (p.to_build ?? 0) ? ` (réalisable avec les pièces : ${p.buildable})` : ''}</p>
                              <p>Nomenclature : {p.bom?.label ?? '—'} · Gamme : {p.routing ? `${p.routing.label} (${p.routing.steps} étapes)` : '—'}</p>
                              {p.issues.length ? <ul className="list-disc pl-4 text-destructive">{p.issues.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul> : null}
                            </div>
                            <div>
                              <p className="font-medium mb-1">Commandes concernées</p>
                              <table className="w-full"><thead><tr className="text-left text-muted-foreground"><th>Commande</th><th>Statut</th><th>Expédition</th><th>Cmdé</th><th>Expédié</th><th>Livré</th><th>Réservé</th><th>Reste</th><th>OF lié</th></tr></thead>
                                <tbody>{p.lines.map((l: any) => <tr key={l.line_id}><td>{l.order_label ?? l.order_id}</td><td>{l.order_status}/{l.shipping_status}</td><td>{l.line_shipping_at ?? l.order_shipping_at ?? '—'}</td><td>{fmt(l.quantity)}</td><td>{fmt(l.shipped_quantity)}</td><td>{fmt(l.delivered_quantity)}</td><td>{fmt(l.reserved_quantity)}</td><td>{fmt(l.remaining)}</td><td>{l.linked_mo ?? '—'}</td></tr>)}</tbody></table>
                            </div>
                          </div>
                          {p.components.length > 0 && (
                            <div>
                              <p className="font-medium mb-1">Composants (répartition)</p>
                              <table className="w-full"><thead><tr className="text-left text-muted-foreground"><th>Composant</th><th>Par unité</th><th>Requis</th><th>Disponible restant</th><th>Affecté</th><th>Manquant</th></tr></thead>
                                <tbody>{p.components.map((c: any) => <tr key={c.component_id} className={c.missing > 0 ? 'text-destructive' : ''}><td>{c.sku ?? c.component_id} {c.label}</td><td>{fmt(c.per_unit)}</td><td>{fmt(c.required)}</td><td>{fmt(c.pool_before)}</td><td>{fmt(c.allocated)}</td><td>{fmt(c.missing)}</td></tr>)}</tbody></table>
                            </div>
                          )}
                          {p.status === 'ready' && (
                            <div className="space-y-2">
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => sendMo(p, false)} disabled={!isAdmin || res?.loading} data-readonly-allow="true">
                                  {res?.loading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}Préparer l'OF groupé (simulation)
                                </Button>
                                {plan?.writeEnabled && res?.status === 'dry_run' && (
                                  <Button size="sm" onClick={() => sendMo(p, true)} disabled={!isAdmin || res?.loading} data-readonly-allow="true"><Send className="h-3 w-3 mr-1" />Confirmer la création dans Erplain</Button>
                                )}
                              </div>
                              {res && !res.loading && (
                                <div className={res.status === 'blocked' || res.status === 'api_error' ? 'text-destructive' : ''}>
                                  <p>{res.message ?? (res.status === 'created' ? `OF créé : ${res.mo?.label ?? res.mo?.id}` : res.status)}</p>
                                  {res.variables && <pre className="mt-1 p-2 bg-muted rounded overflow-auto">{res.mutation}{'\n'}{JSON.stringify(res.variables, null, 2)}</pre>}
                                </div>
                              )}
                            </div>
                          )}
                        </td></tr>
                      )}
                    </Fragment>
                  );
                })}
                {!proposals.length && <tr><td colSpan={10} className="p-4 text-center text-muted-foreground">{plan ? 'Aucun besoin. Actualisez depuis Erplain si les données sont vides.' : 'Chargement…'}</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <ControlViews isAdmin={isAdmin} reloadKey={run?.id + (run?.status ?? '')} />
    </div>
  );
}

function ControlViews({ isAdmin, reloadKey }: { isAdmin: boolean; reloadKey: string }) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Record<string, any[]>>({});
  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const t = (n: string, order: string) => (supabase.from(n as any) as any).select('*').order(order).limit(1000);
      const [l, s, m] = await Promise.all([t('erplain_order_lines', 'order_id'), t('erplain_stock_levels', 'sku'), t('erplain_manufacturing_orders', 'id')]);
      setRows({ lines: l.data ?? [], stocks: s.data ?? [], mos: m.data ?? [] });
    })();
  }, [isAdmin, reloadKey]);
  const f = (list: any[] = []) => list.filter((r) => !q || JSON.stringify(r).toLowerCase().includes(q.toLowerCase())).slice(0, 300);
  const T = ({ cols, data }: { cols: [string, string][]; data: any[] }) => (
    <div className="overflow-auto max-h-[500px] border rounded-md">
      <table className="w-full text-xs"><thead className="bg-muted sticky top-0"><tr>{cols.map(([, h]) => <th key={h} className="p-1.5 text-left whitespace-nowrap">{h}</th>)}</tr></thead>
        <tbody>{data.map((r, i) => <tr key={i} className="border-t">{cols.map(([k]) => <td key={k} className="p-1.5 whitespace-nowrap">{fmt(Array.isArray(r[k]) ? r[k].join(', ') : r[k])}</td>)}</tr>)}</tbody></table>
    </div>
  );
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Vues de contrôle (données Erplain brutes)</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <Input placeholder="Rechercher" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" data-readonly-allow="true" />
        <Tabs defaultValue="lines">
          <TabsList><TabsTrigger value="lines">Lignes de commande ({rows.lines?.length ?? 0})</TabsTrigger><TabsTrigger value="stocks">Stocks ({rows.stocks?.length ?? 0})</TabsTrigger><TabsTrigger value="mos">OF ({rows.mos?.length ?? 0})</TabsTrigger></TabsList>
          <TabsContent value="lines"><T data={f(rows.lines)} cols={[['order_label', 'Commande'], ['order_status', 'Statut'], ['shipping_status', 'Expédition'], ['sku', 'SKU'], ['variant_label', 'Variante'], ['location_label', 'Emplacement'], ['quantity', 'Commandé'], ['shipped_quantity', 'Expédié'], ['delivered_quantity', 'Livré'], ['reserved_quantity', 'Réservé'], ['line_shipping_at', 'Date exp.'], ['line_id', 'ID ligne']]} /></TabsContent>
          <TabsContent value="stocks"><T data={f(rows.stocks)} cols={[['sku', 'SKU'], ['variant_label', 'Variante'], ['location_label', 'Emplacement'], ['on_hand', 'Réel'], ['available', 'Disponible'], ['reserved', 'Réservé'], ['incoming', 'À venir'], ['id', 'ID']]} /></TabsContent>
          <TabsContent value="mos"><T data={f(rows.mos)} cols={[['label', 'OF'], ['status', 'Statut'], ['sku', 'SKU'], ['location_label', 'Emplacement'], ['quantity', 'Prévu'], ['actually_produced', 'Produit'], ['remaining_to_produce', 'Reste'], ['order_line_item_ids', 'Lignes cmd'], ['id', 'ID']]} /></TabsContent>
        </Tabs>
        <p className="text-xs text-muted-foreground">Affichage limité à 300 lignes filtrées. Les valeurs « — » sont absentes dans Erplain, jamais remplacées par zéro.</p>
      </CardContent>
    </Card>
  );
}
