import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { PipeRulesPanel } from '@/components/pipe/PipeRulesPanel';
import { type ChannelRule } from '@/components/pipe/pipeRules';
import type { PipeOrder } from '@/components/pipe/pipeModel';
import { CHANNEL_LABELS, crmChannel, effectiveChannel, notifyClassification, type ClientChannel } from './classificationModel';
import { useCustomerClassification } from './useCustomerClassification';
import { ErplainCustomerPicker } from './ErplainCustomerPicker';
import { customerRuleAssignments } from './customerRules';
import { buildCrmLinkRows, linkConflict, type LinkStatus } from './crmLinking';

export function CustomerClassificationButton({ orders = [] }: { orders?: PipeOrder[] }) {
  const [open, setOpen] = useState(false);
  return <><Button variant="outline" size="sm" data-readonly-allow="true" onClick={() => setOpen(true)}><Users className="mr-2 h-4 w-4" />Classement clients</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto"><DialogHeader><DialogTitle>Classement clients commun</DialogTitle><DialogDescription>Un canal par client · Pipe, Statistiques commerciales, Plan produit, CRM et marge B2C</DialogDescription></DialogHeader>{open && <CustomerClassification orders={orders} />}</DialogContent></Dialog></>;
}
function CustomerClassification({ orders }: { orders: PipeOrder[] }) {
  const { getTabPermission } = useAuth();
  const canWrite = getTabPermission('customer-classification') === 'write';
  const { customers, error, loading, reload } = useCustomerClassification();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('rules');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [crmLimit, setCrmLimit] = useState(50);
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState(false);
  const [crmClients, setCrmClients] = useState<{ id: string; company_name: string; erplain_customer_id: string | null; sales_channel: string }[]>([]);
  const reloadCrm = useCallback(async () => {
    const all: typeof crmClients = [];
    for (let p = 0; ; p++) {
      const { data, error } = await supabase.from('b2b_clients').select('id,company_name,erplain_customer_id,sales_channel').is('deleted_at', null).order('id').range(p * 1000, p * 1000 + 999);
      if (error) { toast.error(`Clients CRM : ${error.message}`); return; }
      all.push(...(data ?? [])); if ((data ?? []).length < 1000) break;
    }
    setCrmClients(all);
  }, []);
  useEffect(() => { void reloadCrm(); }, [reloadCrm]);
  const [crmStatus, setCrmStatus] = useState<'all' | LinkStatus>('all');
  const crmRows = useMemo(() => buildCrmLinkRows(crmClients, customers), [crmClients, customers]);
  const custName = useCallback((id: string) => customers.find(c => c.customer_id === id)?.customer_name ?? id, [customers]);
  const saveCrm = async (id: string, patch: { erplain_customer_id?: string | null; sales_channel?: string }) => {
    const conflict = patch.erplain_customer_id ? linkConflict(crmClients, id, patch.erplain_customer_id) : undefined;
    if (conflict) return toast.error(`Déjà rattaché à la fiche CRM « ${conflict.company_name} »`);
    setBusy(true);
    const { error } = await supabase.from('b2b_clients').update(patch).eq('id', id);
    setBusy(false);
    if (error) return toast.error(error.message);
    await reloadCrm(); notifyClassification(); toast.success('Classement CRM enregistré');
  };
  const confirmSuggestions = async () => {
    const list = crmRows.filter(r => r.status === 'suggested' && r.suggestion && (crmStatus === 'all' || crmStatus === 'suggested') && (r.company_name ?? '').toLowerCase().includes(search.toLowerCase()));
    if (!list.length || !window.confirm(`Rattacher ${list.length} fiche(s) CRM à leur client Erplain proposé ?`)) return;
    setBusy(true);
    for (const r of list) { const { error } = await supabase.from('b2b_clients').update({ erplain_customer_id: r.suggestion!.customer_id }).eq('id', r.id); if (error) { toast.error(`${r.company_name} : ${error.message}`); break; } }
    setBusy(false); await reloadCrm(); notifyClassification(); toast.success('Rattachements enregistrés');
  };
  const [rules, setRules] = useState<ChannelRule[]>([]);
  const [ruleError, setRuleError] = useState<string | null>(null);
  const reloadRules = useCallback(async () => {
    try {
      const all: ChannelRule[] = [];
      for (let p = 0; ; p++) {
        const { data, error } = await supabase.from('pipe_channel_rules').select('*').order('priority').order('id').range(p * 1000, p * 1000 + 999);
        if (error) throw error; all.push(...(data ?? []) as ChannelRule[]); if ((data ?? []).length < 1000) break;
      }
      setRules(all); setRuleError(null);
    } catch (e) { setRuleError((e as Error).message); }
  }, []);
  useEffect(() => { void reloadRules(); }, [reloadRules]);
  const list = customers.filter(c => (filter === 'all' || c.channel === filter) && `${c.customer_name ?? ''} ${c.customer_id}`.toLocaleLowerCase('fr').includes(search.trim().toLocaleLowerCase('fr')));
  const save = async (id: string, patch: { channel?: ClientChannel; commercial_country?: string | null }) => {
    setBusy(true);
    const { error } = await supabase.from('erplain_sales_customers').update(patch).eq('customer_id', id);
    setBusy(false);
    if (error) return toast.error(error.message);
    notifyClassification(); await reload(); toast.success('Affectation commune enregistrée');
  };
  const bulkAssign = async (channel: ClientChannel) => {
    const ids = [...picked];
    if (!ids.length || !window.confirm(`Classer ${ids.length} client(s) en ${channel} dans tous les onglets ?`)) return;
    setBusy(true);
    try {
      for (let i = 0; i < ids.length; i += 500) { const { error } = await supabase.rpc('assign_customer_channels', { _ids: ids.slice(i,i+500), _channel: channel }); if (error) throw error; }
      setPicked(new Set()); toast.success(`${ids.length} client(s) classés en ${channel}`);
    } catch (e) { toast.error(`Classement interrompu : ${(e as Error).message}`); }
    finally { setBusy(false); notifyClassification(); await reload(); }
  };
  const samples = useMemo(() => {
    const known = new Set(orders.map(o => o.customer_id));
    return [...orders, ...customers.filter(c => !known.has(c.customer_id)).map(c => ({ id: `client:${c.customer_id}`, customer_id: c.customer_id, customer: c.customer_name, label: null, lines: [], channel: effectiveChannel(c.channel).toLowerCase() } as PipeOrder))];
  }, [orders, customers]);
  const [ruleOrders, setRuleOrders] = useState<PipeOrder[]>([]);
  const [ordersReady, setOrdersReady] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [ordersFrom, setOrdersFrom] = useState('2000-01-01');
  const [ordersTo, setOrdersTo] = useState(() => new Date().toISOString().slice(0,10));
  const [resetUnmatched, setResetUnmatched] = useState(false);
  const assignments = useMemo(() => customerRuleAssignments(customers, ordersReady ? ruleOrders : orders, rules, { resetUnmatched }), [customers, ordersReady, ruleOrders, orders, rules, resetUnmatched]);
  const changed = assignments.filter(a => a.customer.channel !== a.channel);
  const recognized = assignments.filter(a => a.channel !== 'A_CLASSER').length;
  const conflicts = assignments.filter(a => a.conflict.length > 0);
  const kept = customers.filter(c => c.channel !== 'A_CLASSER' && !assignments.some(a => a.customer.customer_id === c.customer_id)).length;
  const needsOrders = rules.some(r => r.enabled && ['label','sku','product'].includes(r.field));
  const [progress, setProgress] = useState<{ read: number; total: number | null } | null>(null);
  const stopRef = useRef(false);
  const loadRuleOrders = async () => {
    setBusy(true); setOrdersError(null); setOrdersReady(false); stopRef.current = false; setProgress({ read: 0, total: null });
    const collected = new Map<string, PipeOrder>();
    const withLines = rules.some(r => r.enabled && ['sku','product'].includes(r.field));
    let cursor: { page: number; size: number } | undefined;
    let retries = 0;
    try {
      for (let batch = 0; batch < 2000; batch++) {
        if (stopRef.current) throw new Error('Chargement arrêté : les règles ne peuvent pas être appliquées sur une lecture partielle.');
        const { data, error } = await supabase.functions.invoke('erplain-sync', { body: { action: 'pipe_orders', from: ordersFrom, to: ordersTo, cursor, light: true, with_lines: withLines } });
        const failed = error || !['success','partial'].includes(data?.status);
        if (failed || data.message) {
          for (const order of data?.orders ?? []) collected.set(String(order.id), order);
          if (data?.next) cursor = data.next;
          if (++retries > 3) throw new Error(error?.message ?? data?.message ?? 'Lecture Erplain impossible');
          await new Promise(r => setTimeout(r, 1500 * retries)); continue;
        }
        retries = 0;
        for (const order of data.orders ?? []) collected.set(String(order.id), order);
        setProgress({ read: collected.size, total: data.total ?? null });
        if (data.status === 'success') { setRuleOrders([...collected.values()]); setOrdersReady(true); return; }
        if (!data.next || (cursor && data.next.page <= cursor.page)) throw new Error('Lecture incomplète, réessayez.');
        cursor = data.next;
      }
      throw new Error('Lecture trop volumineuse : réduisez la période.');
    } catch (e) { setOrdersError((e as Error).message); }
    finally { setBusy(false); }
  };
  const apply = async () => {
    if (!changed.length || (needsOrders && !ordersReady) || !window.confirm(`Reclasser ${changed.length} client(s) avec toutes les règles actives dans tous les onglets ?`)) return;
    setBusy(true);
    try {
      for (const channel of ['B2C','B2B','OEM','A_CLASSER']) {
        const ids = changed.filter(a => a.channel === channel).map(a => a.customer.customer_id);
        for (let i = 0; i < ids.length; i += 500) {
          const { error } = await supabase.rpc('assign_customer_channels', { _ids: ids.slice(i,i+500), _channel: channel });
          if (error) throw error;
        }
      }
      toast.success('Classement commun mis à jour');
    } catch (e) { toast.error(`Classement interrompu : ${(e as Error).message}`); }
    finally { setBusy(false); notifyClassification(); await reload(); }
  };
  return <div className="space-y-3">
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">{(['B2C','B2B','OEM','A_CLASSER'] as const).map(k => <button key={k} type="button" data-readonly-allow="true" onClick={() => { setFilter(filter === k ? 'all' : k); setActiveTab('clients'); }} className={`rounded-md border p-3 text-left transition-colors ${filter === k ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}><div className="text-xs text-muted-foreground">{k === 'A_CLASSER' ? 'À classer (compté B2C)' : `Catégorie ${k}`}</div><div className="text-2xl font-semibold">{customers.filter(c => c.channel === k).length}</div><div className="text-xs text-muted-foreground">clients Erplain</div></button>)}</div>
    <p className="text-xs text-muted-foreground">1. Définissez des règles → 2. Appliquez-les → 3. Corrigez à la main. Le classement s'applique partout : Statistiques commerciales, Pipe commercial, Plan produit, CRM, marge B2C. {canWrite ? '' : 'Consultation uniquement.'}</p>
    {error && <p role="alert" className="text-sm text-destructive">Chargement impossible : {error}</p>}
    <Tabs value={activeTab} onValueChange={setActiveTab}><TabsList className="h-auto flex-wrap"><TabsTrigger value="rules">1-2. Règles automatiques</TabsTrigger><TabsTrigger value="clients">3. Classement manuel</TabsTrigger><TabsTrigger value="crm">4. Rapprochement CRM ↔ Erplain</TabsTrigger></TabsList>
      <TabsContent value="clients" className="space-y-3"><div className="flex flex-wrap gap-2"><Input aria-label="Rechercher un client" placeholder="Client ou identifiant Erplain…" value={search} onChange={e => setSearch(e.target.value)} className="flex-1" /><Select value={filter} onValueChange={setFilter}><SelectTrigger className="w-52"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tous les clients</SelectItem>{Object.entries(CHANNEL_LABELS).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select><Button variant="outline" size="icon" aria-label="Actualiser les clients" onClick={reload} disabled={loading}><RefreshCw className="h-4 w-4" /></Button></div>
        {canWrite && <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/50 p-2 text-sm"><span>{picked.size} sélectionné(s)</span>{(['B2C','B2B','OEM'] as const).map(ch => <Button key={ch} size="sm" variant="outline" disabled={!picked.size || busy} onClick={() => bulkAssign(ch)}>Mettre en {ch}</Button>)}<Button size="sm" variant="ghost" disabled={!picked.size} onClick={() => setPicked(new Set())}>Vider</Button></div>}
        <div className="max-h-96 overflow-auto"><table className="w-full text-sm"><thead className="sticky top-0 bg-background"><tr className="border-b"><th className="w-8 p-2"><input type="checkbox" aria-label="Tout sélectionner" disabled={!canWrite} checked={list.length > 0 && list.slice(0,200).every(c => picked.has(c.customer_id))} onChange={e => setPicked(prev => { const n = new Set(prev); list.slice(0,200).forEach(c => e.target.checked ? n.add(c.customer_id) : n.delete(c.customer_id)); return n; })} /></th><th className="p-2 text-left">Client / ID Erplain</th><th className="p-2 text-left">Canal commun</th><th className="p-2 text-left">Pays commercial</th></tr></thead><tbody>{list.slice(0,200).map(c => <tr key={c.customer_id} className="border-b"><td className="p-2"><input type="checkbox" aria-label={`Sélectionner ${c.customer_name || c.customer_id}`} disabled={!canWrite} checked={picked.has(c.customer_id)} onChange={e => setPicked(prev => { const n = new Set(prev); e.target.checked ? n.add(c.customer_id) : n.delete(c.customer_id); return n; })} /></td><td className="p-2">{c.customer_name || 'Client sans nom'}<span className="block text-xs text-muted-foreground">{c.customer_id}</span></td><td className="p-2"><Select value={c.channel} disabled={!canWrite || busy} onValueChange={v => save(c.customer_id, { channel: v as ClientChannel })}><SelectTrigger className="w-52"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(CHANNEL_LABELS).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></td><td className="p-2"><Input key={`${c.customer_id}:${c.commercial_country}`} aria-label={`Pays de ${c.customer_name}`} defaultValue={c.commercial_country ?? ''} placeholder="auto" maxLength={3} disabled={!canWrite || busy} className="w-20" onBlur={e => { const v = e.target.value.trim().toUpperCase(); if (v !== (c.commercial_country ?? '')) void save(c.customer_id, { commercial_country: v || null }); }} /></td></tr>)}</tbody></table></div><p className="text-xs text-muted-foreground">{Math.min(list.length,200)} / {list.length} clients · À classer = B2C par défaut</p>
      </TabsContent>
      <TabsContent value="crm" className="space-y-3">{activeTab === 'crm' && (() => {
        const counts = { linked: 0, suggested: 0, new: 0 } as Record<LinkStatus, number>; crmRows.forEach(r => counts[r.status]++);
        const shown = crmRows.filter(r => (crmStatus === 'all' || r.status === crmStatus) && (r.company_name ?? '').toLowerCase().includes(search.toLowerCase()));
        const label: Record<LinkStatus, string> = { linked: 'Rattachée', suggested: 'Suggestion', new: 'Nouveau (hors Erplain)' };
        return <>
        <p className="text-sm text-muted-foreground">La base de référence est Erplain. Rattachez chaque fiche CRM à son client Erplain ; les fiches sans équivalent restent des nouveaux clients avec leur propre canal. Un client Erplain ne peut être rattaché qu'à une seule fiche.</p>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">{(['all','linked','suggested','new'] as const).map(k => <button key={k} type="button" data-readonly-allow="true" onClick={() => { setCrmStatus(k); setCrmLimit(50); }} className={`rounded-md border p-2 text-left ${crmStatus === k ? 'border-primary bg-primary/10' : ''}`}><div className="text-xs text-muted-foreground">{k === 'all' ? 'Toutes les fiches' : label[k]}</div><div className="text-lg font-semibold">{k === 'all' ? crmRows.length : counts[k]}</div></button>)}</div>
        <div className="flex flex-wrap gap-2"><Input aria-label="Rechercher un client CRM" placeholder="Client CRM…" value={search} onChange={e => { setSearch(e.target.value); setCrmLimit(50); }} className="flex-1" />{counts.suggested > 0 && <Button disabled={!canWrite || busy} onClick={confirmSuggestions}>Confirmer les suggestions affichées</Button>}</div>
        <div className="max-h-96 overflow-auto"><table className="w-full text-sm"><thead><tr className="border-b"><th className="p-2 text-left">Fiche CRM</th><th className="p-2 text-left">Statut</th><th className="p-2 text-left">Client Erplain</th><th className="p-2 text-left">Canal commun</th></tr></thead><tbody>{shown.slice(0, crmLimit).map(c => <tr key={c.id} className="border-b align-top"><td className="p-2">{c.company_name}{c.duplicateOf.length > 0 && <div className="text-xs text-destructive">Doublon possible : {c.duplicateOf.map(id => crmClients.find(x => x.id === id)?.company_name).join(', ')}</div>}</td>
          <td className="p-2"><span className={`rounded px-2 py-0.5 text-xs ${c.status === 'linked' ? 'bg-primary/15 text-primary' : c.status === 'suggested' ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>{label[c.status]}</span></td>
          <td className="p-2 space-y-1">{c.status === 'suggested' && c.suggestion && <div className="flex items-center gap-2 text-xs"><span>Proposé : <b>{c.suggestion.customer_name}</b></span><Button size="sm" variant="outline" disabled={!canWrite || busy} onClick={() => saveCrm(c.id, { erplain_customer_id: c.suggestion!.customer_id })}>Confirmer</Button></div>}
            <div className="flex items-center gap-2"><ErplainCustomerPicker customers={customers} value={c.erplain_customer_id} disabled={!canWrite || busy} onChange={id => saveCrm(c.id, { erplain_customer_id: id })} />{c.erplain_customer_id && <Button size="sm" variant="ghost" disabled={!canWrite || busy} onClick={() => saveCrm(c.id, { erplain_customer_id: null })}>Détacher</Button>}</div>{c.erplain_customer_id && <div className="text-xs text-muted-foreground">{custName(c.erplain_customer_id)}</div>}</td>
          <td className="p-2">{c.erplain_customer_id ? <span>{crmChannel(c,customers)} · suit le classement Erplain</span> : <Select value={c.sales_channel} disabled={!canWrite || busy} onValueChange={v => saveCrm(c.id, { sales_channel: v })}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent>{['B2C','B2B','OEM'].map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent></Select>}</td></tr>)}</tbody></table></div>{shown.length > crmLimit && <Button variant="outline" onClick={() => setCrmLimit(v => v + 50)}>Afficher plus de fiches</Button>}</>;
      })()}
      </TabsContent>
      <TabsContent value="rules" className="space-y-3"><PipeRulesPanel rules={rules} orders={ordersReady ? ruleOrders : samples} canWrite={canWrite} onReload={reloadRules} error={ruleError} />
        {needsOrders && <div className="flex flex-wrap items-center gap-2"><Input className="w-40" type="date" aria-label="Début des commandes pour le classement" value={ordersFrom} onChange={e => { setOrdersFrom(e.target.value); setOrdersReady(false); }} /><Input className="w-40" type="date" aria-label="Fin des commandes pour le classement" value={ordersTo} onChange={e => { setOrdersTo(e.target.value); setOrdersReady(false); }} /><Button variant="outline" disabled={busy || !ordersFrom || !ordersTo || ordersFrom > ordersTo} onClick={loadRuleOrders}>{busy && progress ? 'Chargement…' : 'Charger les commandes Erplain'}</Button>{busy && progress && <Button variant="ghost" size="sm" onClick={() => { stopRef.current = true; }}>Arrêter</Button>}<span className="text-xs text-muted-foreground">{busy && progress ? `${progress.read}${progress.total != null ? ` / ${progress.total}` : ''} commandes lues…` : ordersReady ? `${ruleOrders.length} commandes chargées` : 'Commandes à charger pour les règles BC / produits'}</span></div>}
        {ordersError && <p role="alert" className="text-sm text-destructive">{ordersError}</p>}
        <div className="flex flex-wrap items-center gap-3"><Button onClick={apply} disabled={!canWrite || busy || !changed.length || (needsOrders && !ordersReady)}>Classer les clients avec mes règles</Button><span className="text-sm text-muted-foreground">{recognized} clients reconnus · {changed.length} changements</span></div>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={resetUnmatched} disabled={!canWrite} onChange={e => setResetUnmatched(e.target.checked)} /><span>Repartir de zéro : remettre « À classer » les clients qu'aucune règle ne reconnaît{!resetUnmatched && kept > 0 ? ` (${kept} client(s) gardent aujourd'hui une ancienne catégorie)` : ''}. Vos corrections manuelles sont à refaire ensuite à l'étape 3.</span></label>
        {conflicts.length > 0 && <p className="text-sm text-destructive">{conflicts.length} client(s) correspondent à plusieurs règles de canaux différents : la règle de priorité la plus basse l'emporte. Ex. : {conflicts.slice(0,3).map(a => `${a.customer.customer_name || a.customer.customer_id} (${a.channel} vs ${a.conflict.join('/')})`).join(', ')}. Utilisez « Commence par » plutôt que « Contient » pour les références (ex. SO, SI).</p>}
        <div className="max-h-64 overflow-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">Client</th><th className="p-2 text-left">Actuel</th><th className="p-2 text-left">Selon les règles</th><th className="p-2 text-left">Règle retenue</th></tr></thead><tbody>{changed.slice(0,50).map(a => <tr className="border-b" key={a.customer.customer_id}><td className="p-2">{a.customer.customer_name || a.customer.customer_id}</td><td className="p-2">{CHANNEL_LABELS[a.customer.channel]}</td><td className="p-2">{a.channel === 'A_CLASSER' ? 'À classer' : a.channel}</td><td className="p-2">{a.rule}</td></tr>)}</tbody></table></div>
        <p className="text-xs text-muted-foreground">Priorité la plus basse en premier · Un seul canal par client · {resetUnmatched ? 'Clients non reconnus remis à classer' : 'Clients non reconnus conservés'} · Corrections manuelles dans Clients Erplain</p>
      </TabsContent>
    </Tabs>
  </div>;
}