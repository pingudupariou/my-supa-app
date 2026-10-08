import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WorkshopDisclosure } from './WorkshopDisclosure';
import { Loader2, RefreshCw, ChevronDown, ChevronRight, Send, Columns3, Calculator, SlidersHorizontal } from 'lucide-react';

const fmt = (v: any) => (v === null || v === undefined ? '—' : typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(2)) : String(v));
const STATUS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  ready: { label: 'À fabriquer', variant: 'default' },
  shortage: { label: 'Pièces manquantes', variant: 'destructive' },
  covered_shortage: { label: 'Pièces manquantes — OF créé', variant: 'outline' },
  covered: { label: 'Déjà couvert', variant: 'secondary' },
  incomplete: { label: 'Données incomplètes', variant: 'outline' },
};

const ORDER_COLUMNS = [
  ['order', 'Commande', 'Commande'], ['client', 'Nom du client', 'Commande'], ['created', 'Date de création', 'Commande'],
  ['product', 'Produit', 'Commande'], ['location', 'Emplacement', 'Commande'], ['quantity', 'Commandé', 'Commande'],
  ['shipped', 'Expédié', 'Commande'], ['remaining', 'Reste', 'Commande'],
  ['reserved', 'Réservé pour cette ligne', 'Données Erplain'], ['stock', 'Stock réel Erplain — total emplacement', 'Données Erplain'],
  ['stockReserved', 'Réservé Erplain — toutes commandes', 'Données Erplain'], ['mo', 'OF lié', 'Données Erplain'],
  ['allocated', 'Stock affecté à la sélection', "Calculé par l'appli"], ['covered', 'Couvert par OF', "Calculé par l'appli"], ['build', 'À fabriquer', "Calculé par l'appli"],
].map(([key, label, group]) => ({ key, label, group }));
const COLUMN_STORAGE = 'plan-atelier-order-columns-v1';
const dateLabel = (value: string | null | undefined) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('fr-FR');
};

export function PlanAtelierBoard({ isAdmin, canRead = isAdmin }: { isAdmin: boolean; canRead?: boolean }) {
  const [selectionOpen, setSelectionOpen] = useState(false);
  const [selectionCustomized, setSelectionCustomized] = useState(false);
  const [detailedPlan, setDetailedPlan] = useState(false);
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncInfo, setSyncInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [includePending, setIncludePending] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [mo, setMo] = useState<Record<string, any>>({});
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [applied, setApplied] = useState<number[] | null>(null);
  const [computed, setComputed] = useState(false);
  const [realMode, setRealMode] = useState(false);
  const [sortAsc, setSortAsc] = useState(false);
  const [sortBy, setSortBy] = useState<'shipping' | 'created'>('created');
  const [openLines, setOpenLines] = useState<any[]>([]);
  const [stockLevels, setStockLevels] = useState<any[]>([]);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>(() => {
    try { const saved = JSON.parse(localStorage.getItem(COLUMN_STORAGE) ?? '[]'); return Array.isArray(saved) ? saved.filter((key) => ORDER_COLUMNS.some((c) => c.key === key)) : []; } catch { return []; }
  });
  useEffect(() => { try { localStorage.setItem(COLUMN_STORAGE, JSON.stringify(hiddenColumns)); } catch { /* Storage unavailable */ } }, [hiddenColumns]);
  const visibleColumns = ORDER_COLUMNS.filter((c) => !hiddenColumns.includes(c.key));


  const call = async (body: any) => {
    const { data, error } = await supabase.functions.invoke('erplain-sync', { body });
    if (error) {
      const status = (error as any)?.context?.status;
      throw new Error(status === 403 ? 'Accès refusé : droit d’écriture sur Plan atelier requis (recharge la page si l’administrateur vient de le donner).' : `Appel serveur impossible${status ? ` (HTTP ${status})` : ''} : ${error.message}`);
    }
    return data as any;
  };

  const loadPlan = useCallback(async () => {
    if (!canRead) return;
    setLoading(true); setError(null);
    // compute=false : la grille des besoins reste vide tant que l'utilisateur n'a pas cliqué sur « Calculer les OF pour la sélection ».
    try { const d = await call({ action: 'plan', includePending, selectedLineIds: applied, compute: computed }); setPlan(d); if (d.stocks) setStockLevels(d.stocks); setOpenLines(d.openLines ?? []); } catch (e) { setError((e as Error).message); }
    setLoading(false);
  }, [canRead, includePending, applied, computed]);

  useEffect(() => { loadPlan(); }, [loadPlan]);

  const [syncMode, setSyncMode] = useState<string>('quick');
  const sync = async (restart: boolean, reload = true, quick = false, mode: string = 'all') => {
    setSyncing(true); setError(null);
    try {
      for (let i = 0, first = true; i < 60; i++, first = false) {
        const d = await call({ action: 'sync', restart: restart && first, quick, mode: mode === 'all' ? undefined : mode });
        if (d.status !== 'success') { setError(`Synchronisation interrompue : ${d.failure ?? d.message}`); break; }
        const c = d.counts ?? {};
        setSyncInfo(`${d.done ? 'Terminé' : `En cours : ${d.current} page ${d.page}`} — commandes ${c.orders ?? 0} (${c.order_lines ?? 0} lignes), stocks ${c.stocks ?? 0}, OF ${c.mos ?? 0}, nomenclatures ${c.boms ?? 0}, gammes ${c.routings ?? 0}`);
        if (d.done) break;
      }
    } catch (e) { setError((e as Error).message); }
    setSyncing(false);
    if (reload) loadPlan();
  };

  const createFor = async (p: any, confirm: boolean, allowShortage = false) => {
    setMo((m) => ({ ...m, [p.key]: { loading: true } }));
    try {
      const d = await call({ action: 'create_mo', selectedLineIds: applied, key: p.idempotency_key, groupKey: p.key, quantity: p.to_build, includePending, confirm, allowShortage });
      setMo((m) => ({ ...m, [p.key]: d }));
    } catch (e) { setMo((m) => ({ ...m, [p.key]: { status: 'api_error', message: (e as Error).message } })); }
  };

  const [sending, setSending] = useState(false);
  const sendAll = async () => {
    const ready = proposals.filter((p: any) => p.status === 'ready');
    const short = proposals.filter((p: any) => p.status === 'shortage');
    if ((!ready.length && !short.length) || sending) return;
    // Ask, product by product, whether to create the MO despite missing components.
    const approved = short.filter((p: any) => {
      const miss = (p.components ?? []).filter((c: any) => c.missing > 0).map((c: any) => `- ${c.sku ?? c.component_id} : manque ${c.missing}`).join('\n');
      return window.confirm(`Composants manquants pour ${p.sku ?? p.variant_label} (qté ${p.to_build}) :\n${miss}\n\nCréer l'OF quand même ? (les composants pourront passer en négatif dans Erplain)`);
    });
    const list = [...ready, ...approved];
    if (!list.length) return;
    const real = realMode && !!plan?.writeEnabled;
    if (real && !window.confirm(`Actualiser puis créer réellement ${list.length} OF dans Erplain${approved.length ? ` (dont ${approved.length} avec composants manquants)` : ''} ?`)) return;
    setSending(true);
    if (real) {
      try { await sync(false, false, true); } catch (e) { setError((e as Error).message); setSending(false); return; }
    }
    for (const p of ready) await createFor(p, real);
    for (const p of approved) await createFor(p, real, true);
    setSending(false);
    loadPlan();
  };

  const proposals = useMemo(() => (plan?.proposals ?? []).filter((p: any) =>
    !filter || `${p.sku} ${p.variant_label} ${p.location_label}`.toLowerCase().includes(filter.toLowerCase())), [plan, filter]);
  const run = plan?.lastRun;
  const orders = useMemo(() => {
    const m = new Map<string, any>();
    openLines.forEach((l) => { const k = String(l.order_id); if (!m.has(k)) m.set(k, { id: k, label: l.order_label, status: l.order_status, date: l.shipping_at, created: l.order_created_at, lines: [] }); m.get(k).lines.push(l); });
    return [...m.values()].sort((a, b) => {
      const x = String((sortBy === 'created' ? a.created : a.date) ?? '9999'), y = String((sortBy === 'created' ? b.created : b.date) ?? '9999');
      return sortAsc ? x.localeCompare(y) : y.localeCompare(x);
    });
  }, [openLines, sortAsc, sortBy]);
  const toggle = (ids: number[], on: boolean) => { setSelectionCustomized(true); setSelected((s) => { const n = new Set(s); ids.forEach((i) => (on ? n.add(i) : n.delete(i))); return n; }); };
  const allIds = openLines.map((l) => Number(l.line_id));
  const coverageBy = useMemo(() => {
    const m = new Map<number, any>();
    (plan?.proposals ?? []).forEach((p: any) => (p.coverage ?? []).forEach((c: any) => m.set(Number(c.line_id), c)));
    return m;
  }, [plan]);
  const stockBy = useMemo(() => {
    const m = new Map<string, any>();
    stockLevels.forEach((s) => m.set(`${s.variant_id}|${s.location_id ?? 'none'}`, s));
    return m;
  }, [stockLevels]);
  const stockUpdatedAt = useMemo(() => stockLevels.map((s) => s.synced_at).filter(Boolean).sort().pop() ?? null, [stockLevels]);

  const calculate = () => {
    const ids = selectionCustomized ? [...selected] : allIds;
    setSelected(new Set(ids)); setMo({}); setApplied(ids); setComputed(true);
  };
  const effectiveSelected = selectionCustomized ? selected : new Set(allIds);
  const canCalculate = isAdmin && !loading && !syncing && !sending && effectiveSelected.size > 0;

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div><h2 className="text-lg font-semibold">Commandes à fabriquer</h2><p className="text-sm text-muted-foreground">{orders.length} commandes · {effectiveSelected.size} lignes retenues{run ? ` · Mis à jour le ${dateLabel(run.finished_at ?? run.started_at)}` : ''}</p></div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => sync(false, true, false, syncMode)} disabled={syncing || sending || !isAdmin} data-readonly-allow="true">{syncing ? <Loader2 className="animate-spin" /> : <RefreshCw />}Actualiser depuis Erplain</Button>
          <Button onClick={calculate} disabled={!canCalculate} data-readonly-allow="true">{loading ? <Loader2 className="animate-spin" /> : <Calculator />}Calculer les OF</Button>
        </div>
      </section>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {syncInfo && <p role="status" className="text-sm text-muted-foreground">{syncInfo}</p>}
      <WorkshopDisclosure title="Options d’actualisation">
      <Card>
        <CardHeader><CardTitle className="text-base">Données Erplain</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <select className="h-10 rounded-md border bg-background px-2 text-sm" value={syncMode} onChange={(e) => setSyncMode(e.target.value)} disabled={syncing} data-readonly-allow="true">
              <option value="all">Tout (commandes, stocks, OF, nomenclatures, gammes)</option>
              <option value="orders_mos">Commandes + OF liés</option>
              <option value="quick">Commandes + stocks + OF</option>
              <option value="mos">OF seulement</option>
              <option value="stocks">Stocks seulement</option>
              <option value="bom">Nomenclatures + gammes</option>
            </select>
            <Button onClick={() => sync(false, true, false, syncMode)} disabled={syncing || !isAdmin} data-readonly-allow="true">
              {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}Actualiser depuis Erplain
            </Button>
            <Button variant="outline" onClick={() => sync(true, true, false, syncMode)} disabled={syncing || !isAdmin} data-readonly-allow="true">Recommencer à zéro</Button>
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
      </WorkshopDisclosure>
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h3 className="font-semibold">Commandes restant à expédier</h3>
          <Button variant="outline" size="sm" aria-expanded={selectionOpen} onClick={() => { if (!selectionCustomized) setSelected(new Set(allIds)); setSelectionOpen(!selectionOpen); }} data-readonly-allow="true"><SlidersHorizontal />{selectionOpen ? 'Réduire la sélection' : 'Sélection précise'}</Button>
        </div>
        {!selectionOpen && <div className="overflow-auto max-h-[340px]">
          <table className="w-full text-sm workshop-table">
            <thead><tr>{['', 'Commande', 'Client', 'Créée le', 'Reste à expédier', 'Statut'].map((h, i) => <th key={i} className="p-3 text-left whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody>{orders.map((o) => {
              const ids = o.lines.map((l: any) => Number(l.line_id));
              const count = ids.filter((id: number) => effectiveSelected.has(id)).length;
              return <tr key={o.id} className="border-b">
                <td className="p-3" data-readonly-allow="true"><Checkbox aria-label={`Sélectionner ${o.label ?? o.id}`} checked={count === ids.length ? true : count ? 'indeterminate' : false} onCheckedChange={(v) => { if (!selectionCustomized) setSelected(new Set(allIds)); toggle(ids, !!v); }} /></td>
                <td className="p-3 font-semibold text-primary">{o.label ?? o.id}</td><td className="p-3">{o.lines[0]?.customer_name ?? '—'}</td><td className="p-3 whitespace-nowrap">{dateLabel(o.created)}</td><td className="p-3 font-mono-numbers">{fmt(o.lines.reduce((n: number, l: any) => n + Number(l.remaining ?? 0), 0))}</td><td className="p-3"><Badge className="workshop-status workshop-status-active">À traiter</Badge></td>
              </tr>;
            })}{!orders.length && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">{loading ? 'Chargement des commandes…' : 'Aucune commande restant à expédier.'}</td></tr>}</tbody>
          </table>
        </div>}
      </section>
      {selectionOpen && <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">Sélection des commandes à fabriquer</CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" size="sm" data-readonly-allow="true"><Columns3 className="h-4 w-4 mr-2" />Colonnes affichées ({visibleColumns.length}/{ORDER_COLUMNS.length})<ChevronDown className="h-4 w-4 ml-2" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-2rem)] max-h-[70vh] overflow-y-auto" data-readonly-allow="true">
              {['Commande', 'Données Erplain', "Calculé par l'appli"].map((group) => <Fragment key={group}>
                <DropdownMenuLabel>{group}</DropdownMenuLabel>
                {ORDER_COLUMNS.filter((c) => c.group === group).map((c) => <DropdownMenuCheckboxItem key={c.key} checked={!hiddenColumns.includes(c.key)} onSelect={(e) => e.preventDefault()} onCheckedChange={(checked) => setHiddenColumns((prev) => checked ? prev.filter((key) => key !== c.key) : [...prev, c.key])}>{c.label}</DropdownMenuCheckboxItem>)}
                <DropdownMenuSeparator />
              </Fragment>)}
              <DropdownMenuItem onSelect={() => setHiddenColumns([])}>Tout afficher</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-3 items-center">
            <label className="flex items-center gap-2 text-sm" data-readonly-allow="true">
              <Checkbox checked={allIds.length > 0 && selected.size === allIds.length} onCheckedChange={(v) => { setSelectionCustomized(true); setSelected(v ? new Set(allIds) : new Set()); }} />Tout sélectionner
            </label>
            <Button variant="outline" size="sm" onClick={() => setSortAsc((v) => !v)} data-readonly-allow="true">{sortBy === 'created' ? 'Date de création' : "Date d'expédition"} {sortAsc ? '↑ croissante' : '↓ décroissante'}</Button>
            <Button variant="ghost" size="sm" onClick={() => { setSortBy((v) => (v === 'shipping' ? 'created' : 'shipping')); setSortAsc(true); }} data-readonly-allow="true">Trier par {sortBy === 'created' ? "date d'expédition" : 'date de création'}</Button>
            <span className="text-sm text-muted-foreground">{selected.size} ligne(s) sur {allIds.length} · {orders.length} commande(s) restant à expédier{stockUpdatedAt ? ` · stocks Erplain mis à jour le ${new Date(stockUpdatedAt).toLocaleString('fr-FR')}` : ''}</span>
            <Button onClick={calculate} disabled={!canCalculate} data-readonly-allow="true">Calculer les OF pour la sélection</Button>
            {applied && <Button variant="ghost" onClick={() => { setMo({}); setApplied(null); setComputed(false); setSelectionCustomized(false); }} data-readonly-allow="true">Revenir à toutes les commandes</Button>}
          </div>
          <p className="text-xs text-muted-foreground">Le stock Erplain est un total par produit et emplacement, répété sur chaque ligne pour information : le calcul le répartit une seule fois entre les lignes sélectionnées (expédition la plus proche d'abord), jamais par commande.</p>
          {applied && <p className="text-xs text-muted-foreground">Calcul limité à {applied.length} ligne(s) sélectionnée(s). Les réservations et OF liés aux autres commandes leur restent affectés.</p>}
          <div className="overflow-auto max-h-[420px] border rounded-md">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left sticky top-0">
                <tr className="text-xs">
                  <th aria-label="Sélection" rowSpan={2} className="p-2" />
                  {['Commande', 'Données Erplain', "Calculé par l'appli"].map((group) => {
                    const count = visibleColumns.filter((c) => c.group === group).length;
                    return count ? <th key={group} colSpan={count} className={`p-2 font-semibold ${group === "Calculé par l'appli" ? 'border-l-2 border-primary bg-primary/10 text-primary' : group === 'Données Erplain' ? 'border-l-2 border-border' : 'text-muted-foreground'}`}>{group}</th> : null;
                  })}
                </tr>
                <tr>{visibleColumns.map((c, i) => <th key={c.key} className={`p-2 font-medium ${c.group === "Calculé par l'appli" ? 'bg-primary/10' : ''} ${i > 0 && visibleColumns[i - 1].group !== c.group ? 'border-l-2 border-border' : ''}`}>{c.label}</th>)}</tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const ids = o.lines.map((l: any) => Number(l.line_id));
                  const all = ids.every((i: number) => selected.has(i));
                  return (
                    <Fragment key={o.id}>
                      <tr className="border-t bg-muted/30">
                        <td className="p-2" data-readonly-allow="true"><Checkbox checked={ids.every((id: number) => effectiveSelected.has(id))} onCheckedChange={(v) => toggle(ids, !!v)} /></td>
                        {visibleColumns.length > 0 && <td className="p-2 font-medium" colSpan={visibleColumns.length}>{o.label ?? o.id} <span className="text-xs text-muted-foreground">({o.status}, {o.lines.length} ligne(s){o.created ? `, créée ${String(o.created).slice(0, 10)}` : ''})</span></td>}
                      </tr>
                      {o.lines.map((l: any) => (
                        <tr key={l.line_id} className="border-t">
                          <td className="p-2 pl-6" data-readonly-allow="true"><Checkbox checked={effectiveSelected.has(Number(l.line_id))} onCheckedChange={(v) => toggle([Number(l.line_id)], !!v)} /></td>
                          {visibleColumns.map((column, i) => {
                            const st = stockBy.get(`${l.variant_id}|${l.location_id ?? 'none'}`);
                            const c = coverageBy.get(Number(l.line_id));
                            const cells: Record<string, React.ReactNode> = {
                              order: l.order_label ?? l.order_id, client: l.customer_name ?? '—', created: dateLabel(l.order_created_at),
                              product: <><div>{l.sku}</div><div className="text-xs text-muted-foreground">{l.variant_label}</div></>,
                              location: l.location_label ?? '—', quantity: fmt(l.quantity), shipped: fmt(l.shipped_quantity), remaining: fmt(l.remaining),
                              reserved: fmt(l.reserved_quantity), stock: st ? fmt(st.on_hand) : '—', stockReserved: st ? fmt(st.reserved) : '—', mo: l.linked_mo ?? '—',
                              allocated: c ? fmt(c.stock_covered) : '—', covered: c ? fmt(c.mo_covered) : '—', build: c ? fmt(c.to_cover) : '—',
                            };
                            return <td key={column.key} className={`p-2 ${column.group === "Calculé par l'appli" ? 'bg-primary/5' : ''} ${['remaining', 'build'].includes(column.key) ? 'font-semibold' : ''} ${i > 0 && visibleColumns[i - 1].group !== column.group ? 'border-l-2 border-border' : ''}`}>{cells[column.key]}</td>;
                          })}
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
                {!orders.length && <tr><td colSpan={visibleColumns.length + 1} className="p-4 text-center text-muted-foreground">Aucune commande active restant à expédier.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">Ordres de fabrication</CardTitle>
          <div className="flex items-center gap-2">
            {sending && <span className="text-xs text-muted-foreground max-w-md truncate">{syncing ? `Actualisation : ${syncInfo ?? 'démarrage…'}` : 'Envoi des OF…'}</span>}
            <Button
              onClick={sendAll}
              disabled={!isAdmin || loading || syncing || sending || !proposals.some((p: any) => ['ready','shortage'].includes(p.status))}
              variant={realMode ? 'default' : 'outline'}
              data-readonly-allow="true"
            >
              {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : realMode ? <Send className="h-4 w-4 mr-2" /> : null}
              {realMode ? 'Actualiser puis créer les OF dans Erplain' : 'Préparer tous les OF groupés (simulation)'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {(() => {
            const vals = Object.values(mo) as any[];
            if (!vals.length) return null;
            const created = vals.filter((v: any) => v.status === 'created').length;
            const blocked = vals.filter((v: any) => ['blocked', 'api_error'].includes(v.status)).length;
            const sim = vals.length - created - blocked;
            return <p className="text-xs text-muted-foreground">Dernier envoi : {created} OF créé(s){sim ? `, ${sim} en simulation` : ''}{blocked ? `, ${blocked} bloqué(s)` : ''} — détail dans chaque produit déplié et dans « OF envoyés à Erplain ».</p>;
          })()}
          <WorkshopDisclosure title="Options et méthode de calcul">
          <details className="text-xs text-muted-foreground" data-readonly-allow="true">
            <summary className="cursor-pointer">Méthode de calcul</summary>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Commandes comptées : statut « active »{includePending ? ' et « pending_validation »' : ''}. Reste à expédier = commandé − expédié (le livré n'est pas re-déduit).</li>
              <li>Stock monté utilisable = disponible + réservé pour les lignes comptées (plafonné au réel). La réservation n'est ainsi comptée qu'une fois.</li>
              <li>OF en cours = reste à produire des OF non terminés et non annulés. Un OF lié à des lignes est d'abord affecté à ces lignes ; seul l'excédent ou un OF non lié est libre pour la sélection.</li><li>Lignes « shipped » exclues ; expéditions partielles : seul le reste est compté. Un OF proposé par variante et emplacement.</li>
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

          </div>
          {plan?.excluded && <p className="text-xs text-muted-foreground">Lignes exclues : {plan.excluded.closedOrders} commandes non ouvertes, {plan.excluded.fullyShipped} déjà expédiées, {plan.excluded.noVariant} sans variante.</p>}
          {plan?.warnings?.length ? (
            <details className="text-xs text-destructive"><summary className="cursor-pointer" data-readonly-allow="true">{plan.warnings.length} incohérence(s) de stock à vérifier</summary>
              <ul className="list-disc pl-5">{plan.warnings.slice(0, 50).map((w: string, i: number) => <li key={i}>{w}</li>)}</ul></details>
          ) : null}
          </WorkshopDisclosure>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">            <label className="flex items-center gap-2 text-sm font-medium" data-readonly-allow="true">
              <span className={realMode ? 'text-muted-foreground' : ''}>Simulation</span>
              <Switch checked={realMode} disabled={!plan?.writeEnabled} onCheckedChange={setRealMode} />
              <span className={realMode ? 'text-destructive' : 'text-muted-foreground'}>Envoi réel</span>
            </label>
            {realMode && <Badge variant="destructive">Les OF seront créés dans Erplain</Badge>}
            {plan && !plan.writeEnabled && <Badge variant="outline">Envoi réel désactivé sur le serveur</Badge>}</div>
            <Button variant="ghost" size="sm" aria-pressed={detailedPlan} onClick={() => setDetailedPlan(!detailedPlan)} data-readonly-allow="true"><Columns3 />{detailedPlan ? 'Vue simple' : 'Détail des quantités'}</Button>
          </div>
          <div className="overflow-auto border rounded-md">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left">
                <tr>{(detailedPlan ? ['', 'Produit', 'Emplacement', 'Commandes', 'Besoin', 'Stock monté', 'OF en cours', 'À fabriquer', 'Pièces manquantes', 'Statut'] : ['', 'Produit', 'Emplacement', 'Commandes', 'À fabriquer', 'Statut']).map((h) => <th key={h} className="p-2 font-medium whitespace-nowrap">{h}</th>)}</tr>
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
                        {detailedPlan && <><td className="p-2">{fmt(p.need)}</td>
                        <td className="p-2">{fmt(p.usable)}</td>
                        <td className="p-2">{fmt(p.mo_remaining)}</td></>}
                        <td className="p-2 font-semibold">{fmt(p.to_build)}</td>
                        {detailedPlan && <td className="p-2">{missing.length ? missing.map((c: any) => `${c.sku ?? c.component_id} (−${fmt(c.missing)})`).join(', ') : '—'}</td>}
                        <td className="p-2"><Badge variant={st.variant} className={`workshop-status workshop-status-${p.status}`}>{st.label}</Badge>
                          {isOpen && p.shortage_mos?.length ? <div className="text-xs text-muted-foreground mt-1">{p.shortage_mos.map((m: any) => `${m.label ?? m.id} : envoyé malgré ${(m.missing ?? []).map((c: any) => `${c.sku} (−${fmt(c.missing)})`).join(', ') || 'pièces manquantes'}`).join(' · ')}</div> : null}</td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-muted/30"><td colSpan={detailedPlan ? 10 : 6} className="p-3 space-y-3 text-xs">
                          <div className="grid md:grid-cols-2 gap-3">
                            <div>
                              <p className="font-medium mb-1">Détail du calcul</p>
                              <p>Besoin restant à expédier : {fmt(p.need)}</p>
                              <p>Stock Erplain : réel {fmt(p.stock?.on_hand)}, disponible {fmt(p.stock?.available)}, réservé {fmt(p.stock?.reserved)}</p>
                              <p>Stock monté utilisable = réel {fmt(p.stock?.on_hand)} − réservé pour les autres commandes {fmt(p.reserved_others)} = {fmt(p.usable)} (réservé total Erplain {fmt(p.stock?.reserved)}, dont {fmt(p.reserved_used)} pour les lignes cochées). Le stock réservé aux autres commandes leur reste affecté.</p>
                              <p>OF affectés aux lignes sélectionnées (reste à produire) : {fmt(p.mo_linked)} · non déduits : OF libres {fmt(p.mo_free)}{p.other_open_lines ? ` · ${p.other_open_lines} autre(s) ligne(s) non sélectionnée(s) gardent leurs affectations` : ''}</p>
                              <p>OF en cours : {p.mos.length ? p.mos.map((m: any) => `${m.label ?? m.id} [${m.status}] reste ${fmt(m.remaining_to_produce)}`).join(' ; ') : 'aucun'}</p>
                              <p className="font-medium">À fabriquer = max(0, {fmt(p.need)} à expédier − {fmt(p.usable)} montés − {fmt(p.mo_linked)} en OF) = {fmt(p.to_build)}{p.buildable != null && p.buildable < (p.to_build ?? 0) ? ` (réalisable avec les pièces : ${p.buildable})` : ''}</p>
                              <p>Nomenclature : {p.bom?.label ?? '—'} · Gamme : {p.routing ? `${p.routing.label} (${p.routing.steps} étapes)` : '—'}</p>
                              {p.issues.length ? <ul className="list-disc pl-4 text-destructive">{p.issues.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul> : null}
                            </div>
                            <div>
                              <p className="font-medium mb-1">Commandes concernées</p>
                              <table className="w-full"><thead><tr className="text-left text-muted-foreground"><th>Commande</th><th>Statut</th><th>Expédition</th><th>Cmdé</th><th>Expédié</th><th>Livré</th><th>Réservé pour cette ligne</th><th>Reste</th><th>OF lié</th><th>Stock affecté</th></tr></thead>
                                <tbody>{p.lines.map((l: any) => <tr key={l.line_id}><td>{l.order_label ?? l.order_id}</td><td>{l.order_status}/{l.shipping_status}</td><td>{l.line_shipping_at ?? l.order_shipping_at ?? '—'}</td><td>{fmt(l.quantity)}</td><td>{fmt(l.shipped_quantity)}</td><td>{fmt(l.delivered_quantity)}</td><td>{fmt(l.reserved_quantity)}</td><td>{fmt(l.remaining)}</td><td>{l.linked_mo ? `${l.linked_mo} (${fmt(l.mo_alloc)} couv.)` : '—'}{l.to_cover === 0 ? ' · Déjà couvert' : l.to_cover != null ? ` · à couvrir ${fmt(l.to_cover)}` : ''}</td><td>{fmt(l.stock_alloc)}</td></tr>)}</tbody></table>
                            </div>
                          </div>
                          {p.components.length > 0 && (
                            <div>
                              <p className="font-medium mb-1">Composants (répartition)</p>
                              <table className="w-full"><thead><tr className="text-left text-muted-foreground"><th>Composant</th><th>Par unité</th><th>Requis</th><th>Disponible restant</th><th>Affecté</th><th>Manquant</th></tr></thead>
                                <tbody>{p.components.map((c: any) => <tr key={c.component_id} className={c.missing > 0 ? 'text-destructive' : ''}><td>{c.sku ?? c.component_id} {c.label}</td><td>{fmt(c.per_unit)}</td><td>{fmt(c.required)}</td><td>{fmt(c.pool_before)}</td><td>{fmt(c.allocated)}</td><td>{fmt(c.missing)}</td></tr>)}</tbody></table>
                            </div>
                          )}
                          {res && !res.loading && (
                                <div className={res.status === 'blocked' || res.status === 'api_error' ? 'text-destructive' : ''}>
                                  <p>{res.message ?? (res.status === 'created' ? `OF créé : ${res.mo?.label ?? res.mo?.id}` : res.status)}</p>
                                  {res.variables && <pre className="mt-1 p-2 bg-muted rounded overflow-auto">{res.mutation}{'\n'}{JSON.stringify(res.variables, null, 2)}</pre>}
                                </div>
                          )}
                        </td></tr>
                      )}
                    </Fragment>
                  );
                })}
                {!proposals.length && <tr><td colSpan={detailedPlan ? 10 : 6} className="p-4 text-center text-muted-foreground">{!plan ? 'Chargement…' : !computed ? 'Aucun calcul effectué.' : 'Aucun besoin. Actualisez depuis Erplain si les données sont vides.'}</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <SubmissionsPanel realMode={realMode} isAdmin={isAdmin} prefix={plan?.referencePrefix ?? 'NOV-OF-'} subs={plan?.submissions ?? []} writeEnabled={!!plan?.writeEnabled} call={call} onDone={loadPlan} />

      <WorkshopDisclosure title="Vérifier les données Erplain"><ControlViews isAdmin={canRead} reloadKey={run?.id + (run?.status ?? '')} /></WorkshopDisclosure>
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
      const lines = (l.data ?? []).slice().sort((a, b) => String(b.order_created_at ?? '').localeCompare(String(a.order_created_at ?? '')));
      const mos = (m.data ?? []).slice().sort((a, b) => Number(b.id) - Number(a.id));
      setRows({ lines, stocks: s.data ?? [], mos });
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
          <TabsContent value="lines"><T data={f(rows.lines)} cols={[['order_label', 'Commande'], ['order_created_at', 'Créée le'], ['order_status', 'Statut'], ['shipping_status', 'Expédition'], ['sku', 'SKU'], ['variant_label', 'Variante'], ['location_label', 'Emplacement'], ['quantity', 'Commandé'], ['shipped_quantity', 'Expédié'], ['delivered_quantity', 'Livré'], ['reserved_quantity', 'Réservé'], ['line_shipping_at', 'Date exp.'], ['line_id', 'ID ligne']]} /></TabsContent>
          <TabsContent value="stocks"><T data={f(rows.stocks)} cols={[['sku', 'SKU'], ['variant_label', 'Variante'], ['location_label', 'Emplacement'], ['on_hand', 'Réel'], ['available', 'Disponible'], ['reserved', 'Réservé'], ['incoming', 'À venir'], ['id', 'ID']]} /></TabsContent>
          <TabsContent value="mos"><T data={f(rows.mos)} cols={[['label', 'OF'], ['status', 'Statut'], ['sku', 'SKU'], ['location_label', 'Emplacement'], ['quantity', 'Prévu'], ['actually_produced', 'Produit'], ['remaining_to_produce', 'Reste'], ['order_line_item_ids', 'Lignes cmd'], ['id', 'ID']]} /></TabsContent>
        </Tabs>
        <p className="text-xs text-muted-foreground">Affichage limité à 300 lignes filtrées. Les valeurs « — » sont absentes dans Erplain, jamais remplacées par zéro.</p>
      </CardContent>
    </Card>
  );
}

const CHECK_LABELS: Record<string, string> = { bom: 'Nomenclature reprise', components: 'Composants repris', routing: 'Gamme reprise', quantity: 'Quantité', order_lines: 'Lignes de commande liées' };

const MO_STATUS: Record<string, string> = { draft: 'Brouillon', unpublished: 'Non publié', released: 'Publié', in_progress: 'En cours', completed: 'Terminé', cancelled: 'Annulé dans Erplain', absent: 'Supprimé dans Erplain' };

function SubmissionsPanel({ realMode, isAdmin, prefix, subs, writeEnabled, call, onDone }: { realMode: boolean; isAdmin: boolean; prefix: string; subs: any[]; writeEnabled: boolean; call: (b: any) => Promise<any>; onDone: () => void }) {
  const [res, setRes] = useState<Record<string, any>>({});
  const [qty, setQty] = useState<Record<string, string>>({});
  const [pref, setPref] = useState(prefix);
  const [prefMsg, setPrefMsg] = useState('');
  useEffect(() => setPref(prefix), [prefix]);
  const savePrefix = async () => { const d = await call({ action: 'set_prefix', prefix: pref }); setPrefMsg(d.message ?? d.status); if (d.status === 'success') onDone(); };
  const list = subs.filter((s) => s.status !== 'prepared' || s.erplain_mo_id);
  const act = async (s: any, body: any) => {
    setRes((r) => ({ ...r, [s.id]: { loading: true } }));
    try { const d = await call({ ...body, submissionId: s.id }); setRes((r) => ({ ...r, [s.id]: d })); if (d.status === 'success') onDone(); }
    catch (e) { setRes((r) => ({ ...r, [s.id]: { status: 'api_error', message: (e as Error).message } })); }
  };
  const editable = (s: any) => ['unpublished', 'draft'].includes(s.erplain_status);
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">OF envoyés à Erplain</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <WorkshopDisclosure title="Réglage des références OF"><div className="flex flex-wrap items-center gap-2 text-xs">
          <span>Racine de la référence OF :</span>
          <Input className="w-32 h-8" value={pref} onChange={(e) => setPref(e.target.value)} data-readonly-allow="true" />
          <Button size="sm" variant="outline" disabled={!isAdmin || !pref || pref === prefix} onClick={savePrefix} data-readonly-allow="true">Enregistrer</Button>
          <span className="text-muted-foreground">Prochain OF : {prefix}NNNNN — le compteur continue même si la racine change.</span>
          {prefMsg && <span>{prefMsg}</span>}
        </div>
        </WorkshopDisclosure>
        {!list.length && <p className="text-muted-foreground">Aucun OF créé pour l'instant (simulations seulement).</p>}
        {list.map((s) => {
          const r = res[s.id];
          const confirm = (body: any) => { const real = realMode && writeEnabled; if (real && !window.confirm('Envoyer réellement cette action à Erplain ?')) return; act(s, { ...body, confirm: real }); };
          return (
            <div key={s.id} className="border rounded-md p-3 space-y-2">
              <div className="flex flex-wrap gap-2 items-center">
                <span className="font-medium">N° Erplain : {s.erplain_snapshot?.label ?? '—'}</span>
                <span className="text-xs">Libellé : {s.app_reference ?? s.payload?.label ?? '—'}</span>

                <Badge className={`workshop-status workshop-status-${s.erplain_status ?? s.status}`} variant={['cancelled', 'absent'].includes(s.erplain_status) ? 'destructive' : 'default'}>{MO_STATUS[s.erplain_status] ?? s.erplain_status ?? s.status}</Badge>
                {s.payload?._shortage && <Badge variant="outline" className="border-destructive text-destructive" title={(s.payload._shortage.missing ?? []).map((c: any) => `${c.sku} −${c.missing}`).join(', ')}>Créé avec pièces manquantes{s.payload._shortage.missing?.length ? ` : ${s.payload._shortage.missing.map((c: any) => `${c.sku} (−${fmt(c.missing)})`).join(', ')}` : ''}</Badge>}
                <span className="text-xs text-muted-foreground">Qté {fmt(s.quantity)} · {s.order_line_item_ids?.length ?? 0} ligne(s) · relu {s.erplain_synced_at ? new Date(s.erplain_synced_at).toLocaleString('fr-FR') : 'jamais'}</span>
              </div>
              <WorkshopDisclosure title="Détails et actions de cet OF">
              <p className="text-xs text-muted-foreground">ID Erplain : {s.erplain_mo_id ?? '—'}</p>
              {s.checks && <div className="flex flex-wrap gap-2 text-xs">{Object.entries(CHECK_LABELS).map(([k, l]) => s.checks[k] == null ? null : <Badge key={k} variant={s.checks[k] ? 'secondary' : 'destructive'}>{l} : {s.checks[k] ? 'oui' : 'non'}</Badge>)}<span className="text-muted-foreground">{s.checks.components_detail} · {s.checks.steps_detail}</span></div>}
              {s.erplain_mo_id && !['deleted', 'cancelled'].includes(s.status) && (
                <div className="flex flex-wrap gap-2 items-center">
                  <Button size="sm" variant="outline" disabled={!isAdmin || r?.loading} onClick={() => act(s, { action: 'mo_refresh' })} data-readonly-allow="true">Relire depuis Erplain</Button>
                  {editable(s) && <>
                    <Input className="w-24 h-8" type="number" placeholder="Qté" value={qty[s.id] ?? ''} onChange={(e) => setQty((q) => ({ ...q, [s.id]: e.target.value }))} data-readonly-allow="true" />
                    <Button size="sm" variant="outline" disabled={!isAdmin || r?.loading || !qty[s.id]} onClick={() => confirm({ action: 'mo_update', quantity: Number(qty[s.id]) })} data-readonly-allow="true">Modifier la quantité</Button>
                  </>}
                  {s.erplain_status === 'released' && <Button size="sm" variant="outline" disabled={!isAdmin || r?.loading} onClick={() => confirm({ action: 'mo_transition', target: 'in_progress' })} data-readonly-allow="true">Lancer</Button>}
                  {r?.loading && <Loader2 className="h-4 w-4 animate-spin" />}
                </div>
              )}
              {r && !r.loading && (
                <div className={['blocked', 'api_error'].includes(r.status) ? 'text-destructive text-xs' : 'text-xs'}>
                  <p>{r.message ?? r.status}{r.status === 'dry_run' ? ' — passez en « Envoi réel » pour envoyer.' : ''}</p>
                  {r.variables && <pre className="mt-1 p-2 bg-muted rounded overflow-auto">{r.mutation}{'\n'}{JSON.stringify(r.variables, null, 2)}</pre>}
                </div>
              )}
              </WorkshopDisclosure>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
