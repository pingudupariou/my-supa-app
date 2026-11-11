import { useCallback, useEffect, useMemo, useState } from 'react';
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
  const [activeTab, setActiveTab] = useState('clients');
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
  const saveCrm = async (id: string, patch: { erplain_customer_id?: string | null; sales_channel?: string }) => {
    setBusy(true);
    const { error } = await supabase.from('b2b_clients').update(patch).eq('id', id);
    setBusy(false);
    if (error) return toast.error(error.message);
    await reloadCrm(); notifyClassification(); toast.success('Classement CRM enregistré');
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
  const samples = useMemo(() => {
    const known = new Set(orders.map(o => o.customer_id));
    return [...orders, ...customers.filter(c => !known.has(c.customer_id)).map(c => ({ id: `client:${c.customer_id}`, customer_id: c.customer_id, customer: c.customer_name, label: null, lines: [], channel: effectiveChannel(c.channel).toLowerCase() } as PipeOrder))];
  }, [orders, customers]);
  const [ruleOrders, setRuleOrders] = useState<PipeOrder[]>([]);
  const [ordersReady, setOrdersReady] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [ordersFrom, setOrdersFrom] = useState('2000-01-01');
  const [ordersTo, setOrdersTo] = useState(() => new Date().toISOString().slice(0,10));
  const assignments = useMemo(() => customerRuleAssignments(customers, ordersReady ? ruleOrders : orders, rules), [customers, ordersReady, ruleOrders, orders, rules]);
  const changed = assignments.filter(a => a.customer.channel !== a.channel);
  const needsOrders = rules.some(r => r.enabled && ['label','sku','product'].includes(r.field));
  const loadRuleOrders = async () => {
    setBusy(true); setOrdersError(null); setOrdersReady(false);
    const collected = new Map<string, PipeOrder>();
    let cursor: { page: number; size: number } | undefined;
    try {
      for (let batch = 0; batch < 1000; batch++) {
        const { data, error } = await supabase.functions.invoke('erplain-sync', { body: { action: 'pipe_orders', from: ordersFrom, to: ordersTo, cursor } });
        if (error || !['success','partial'].includes(data?.status)) throw new Error(error?.message ?? data?.message ?? 'Lecture Erplain impossible');
        for (const order of data.orders ?? []) collected.set(String(order.id), order);
        if (data.message) throw new Error(data.message);
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
      for (const channel of ['B2C','B2B','OEM']) {
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
    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">{Object.keys(CHANNEL_LABELS).map(k => <span key={k}>{CHANNEL_LABELS[k]} : {customers.filter(c => c.channel === k).length}</span>)}<span>{canWrite ? 'Modification autorisée' : 'Consultation uniquement'}</span></div>
    {error && <p role="alert" className="text-sm text-destructive">Chargement impossible : {error}</p>}
    <Tabs value={activeTab} onValueChange={setActiveTab}><TabsList className="h-auto flex-wrap"><TabsTrigger value="clients">Clients Erplain</TabsTrigger><TabsTrigger value="crm">Clients CRM & liens</TabsTrigger><TabsTrigger value="rules">Règles & affectation groupée</TabsTrigger></TabsList>
      <TabsContent value="clients" className="space-y-3"><div className="flex flex-wrap gap-2"><Input aria-label="Rechercher un client" placeholder="Client ou identifiant Erplain…" value={search} onChange={e => setSearch(e.target.value)} className="flex-1" /><Select value={filter} onValueChange={setFilter}><SelectTrigger className="w-52"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tous les clients</SelectItem>{Object.entries(CHANNEL_LABELS).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select><Button variant="outline" size="icon" aria-label="Actualiser les clients" onClick={reload} disabled={loading}><RefreshCw className="h-4 w-4" /></Button></div>
        <div className="max-h-96 overflow-auto"><table className="w-full text-sm"><thead className="sticky top-0 bg-background"><tr className="border-b"><th className="p-2 text-left">Client / ID Erplain</th><th className="p-2 text-left">Canal commun</th><th className="p-2 text-left">Pays commercial</th></tr></thead><tbody>{list.slice(0,200).map(c => <tr key={c.customer_id} className="border-b"><td className="p-2">{c.customer_name || 'Client sans nom'}<span className="block text-xs text-muted-foreground">{c.customer_id}</span></td><td className="p-2"><Select value={c.channel} disabled={!canWrite || busy} onValueChange={v => save(c.customer_id, { channel: v as ClientChannel })}><SelectTrigger className="w-52"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(CHANNEL_LABELS).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></td><td className="p-2"><Input key={`${c.customer_id}:${c.commercial_country}`} aria-label={`Pays de ${c.customer_name}`} defaultValue={c.commercial_country ?? ''} placeholder="auto" maxLength={3} disabled={!canWrite || busy} className="w-20" onBlur={e => { const v = e.target.value.trim().toUpperCase(); if (v !== (c.commercial_country ?? '')) void save(c.customer_id, { commercial_country: v || null }); }} /></td></tr>)}</tbody></table></div><p className="text-xs text-muted-foreground">{Math.min(list.length,200)} / {list.length} clients · À classer = B2C par défaut</p>
      </TabsContent>
      <TabsContent value="crm" className="space-y-3">{activeTab === 'crm' && <>
        <Input aria-label="Rechercher un client CRM" placeholder="Client CRM…" value={search} onChange={e => { setSearch(e.target.value); setCrmLimit(50); }} />
        <div className="max-h-96 overflow-auto"><table className="w-full text-sm"><thead><tr className="border-b"><th className="p-2 text-left">Client CRM</th><th className="p-2 text-left">Client Erplain lié</th><th className="p-2 text-left">Canal commun</th></tr></thead><tbody>{crmClients.filter(c => (c.company_name ?? '').toLowerCase().includes(search.toLowerCase())).slice(0, crmLimit).map(c => <tr key={c.id} className="border-b"><td className="p-2">{c.company_name}</td><td className="p-2"><ErplainCustomerPicker customers={customers} value={c.erplain_customer_id} disabled={!canWrite || busy} onChange={id => saveCrm(c.id, { erplain_customer_id: id })} /></td><td className="p-2">{c.erplain_customer_id ? <span>{crmChannel(c,customers)} · affectation Erplain</span> : <Select value={c.sales_channel} disabled={!canWrite || busy} onValueChange={v => saveCrm(c.id, { sales_channel: v })}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent>{['B2C','B2B','OEM'].map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent></Select>}</td></tr>)}</tbody></table></div>{crmClients.filter(c => (c.company_name ?? '').toLowerCase().includes(search.toLowerCase())).length > crmLimit && <Button variant="outline" onClick={() => setCrmLimit(v => v + 50)}>Afficher plus de clients</Button>}</>}
      </TabsContent>
      <TabsContent value="rules" className="space-y-3"><PipeRulesPanel rules={rules} orders={samples} canWrite={canWrite} onReload={reloadRules} error={ruleError} />
        {needsOrders && <div className="flex flex-wrap items-center gap-2"><Input className="w-40" type="date" aria-label="Début des commandes pour le classement" value={ordersFrom} onChange={e => { setOrdersFrom(e.target.value); setOrdersReady(false); }} /><Input className="w-40" type="date" aria-label="Fin des commandes pour le classement" value={ordersTo} onChange={e => { setOrdersTo(e.target.value); setOrdersReady(false); }} /><Button variant="outline" disabled={busy || !ordersFrom || !ordersTo || ordersFrom > ordersTo} onClick={loadRuleOrders}>{busy ? 'Chargement…' : 'Charger les commandes Erplain'}</Button><span className="text-xs text-muted-foreground">{ordersReady ? `${ruleOrders.length} commandes chargées` : 'Commandes à charger pour les règles BC / produits'}</span></div>}
        {ordersError && <p role="alert" className="text-sm text-destructive">{ordersError}</p>}
        <div className="flex flex-wrap items-center gap-3"><Button onClick={apply} disabled={!canWrite || busy || !changed.length || (needsOrders && !ordersReady)}>Classer les clients avec mes règles</Button><span className="text-sm text-muted-foreground">{assignments.length} clients reconnus · {changed.length} changements</span></div>
        <div className="max-h-64 overflow-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">Client</th><th className="p-2 text-left">Actuel</th><th className="p-2 text-left">Selon les règles</th><th className="p-2 text-left">Règle retenue</th></tr></thead><tbody>{changed.slice(0,50).map(a => <tr className="border-b" key={a.customer.customer_id}><td className="p-2">{a.customer.customer_name || a.customer.customer_id}</td><td className="p-2">{CHANNEL_LABELS[a.customer.channel]}</td><td className="p-2">{a.channel}</td><td className="p-2">{a.rule}</td></tr>)}</tbody></table></div>
        <p className="text-xs text-muted-foreground">Priorité la plus basse en premier · Un seul canal par client · Clients non reconnus conservés · Corrections manuelles dans Clients Erplain</p>
      </TabsContent>
    </Tabs>
  </div>;
}