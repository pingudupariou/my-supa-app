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
import { matchesRule, type ChannelRule } from '@/components/pipe/pipeRules';
import type { PipeOrder } from '@/components/pipe/pipeModel';
import { CHANNEL_LABELS, crmChannel, effectiveChannel, notifyClassification, type ClientChannel } from './classificationModel';
import { useCustomerClassification } from './useCustomerClassification';

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
  const [selectedRule, setSelectedRule] = useState('');
  const chosen = rules.find(r => r.id === selectedRule);
  const candidates = chosen ? customers.filter(c => samples.some(o => o.customer_id === c.customer_id && matchesRule(o, chosen))) : [];
  const apply = async () => {
    if (!chosen || !candidates.length || !window.confirm(`Affecter ${candidates.length} client(s) au canal ${chosen.channel.toUpperCase()} dans tous les onglets ?`)) return;
    setBusy(true);
    try {
      for (let i = 0; i < candidates.length; i += 500) {
        const { error } = await supabase.rpc('assign_customer_channels', { _ids: candidates.slice(i, i + 500).map(c => c.customer_id), _channel: chosen.channel.toUpperCase() });
        if (error) throw error;
      }
      toast.success('Clients affectés dans tous les onglets');
    } catch (e) { toast.error(`Affectation interrompue : ${(e as Error).message}`); }
    finally { setBusy(false); notifyClassification(); await reload(); }
  };
  return <div className="space-y-3">
    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">{Object.keys(CHANNEL_LABELS).map(k => <span key={k}>{CHANNEL_LABELS[k]} : {customers.filter(c => c.channel === k).length}</span>)}<span>{canWrite ? 'Modification autorisée' : 'Consultation uniquement'}</span></div>
    {error && <p role="alert" className="text-sm text-destructive">Chargement impossible : {error}</p>}
    <Tabs defaultValue="clients"><TabsList className="h-auto flex-wrap"><TabsTrigger value="clients">Clients Erplain</TabsTrigger><TabsTrigger value="crm">Clients CRM & liens</TabsTrigger><TabsTrigger value="rules">Règles & affectation groupée</TabsTrigger></TabsList>
      <TabsContent value="clients" className="space-y-3"><div className="flex flex-wrap gap-2"><Input aria-label="Rechercher un client" placeholder="Client ou identifiant Erplain…" value={search} onChange={e => setSearch(e.target.value)} className="flex-1" /><Select value={filter} onValueChange={setFilter}><SelectTrigger className="w-52"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tous les clients</SelectItem>{Object.entries(CHANNEL_LABELS).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select><Button variant="outline" size="icon" aria-label="Actualiser les clients" onClick={reload} disabled={loading}><RefreshCw className="h-4 w-4" /></Button></div>
        <div className="max-h-96 overflow-auto"><table className="w-full text-sm"><thead className="sticky top-0 bg-background"><tr className="border-b"><th className="p-2 text-left">Client / ID Erplain</th><th className="p-2 text-left">Canal commun</th><th className="p-2 text-left">Pays commercial</th></tr></thead><tbody>{list.slice(0,200).map(c => <tr key={c.customer_id} className="border-b"><td className="p-2">{c.customer_name || 'Client sans nom'}<span className="block text-xs text-muted-foreground">{c.customer_id}</span></td><td className="p-2"><Select value={c.channel} disabled={!canWrite || busy} onValueChange={v => save(c.customer_id, { channel: v as ClientChannel })}><SelectTrigger className="w-52"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(CHANNEL_LABELS).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></td><td className="p-2"><Input key={`${c.customer_id}:${c.commercial_country}`} aria-label={`Pays de ${c.customer_name}`} defaultValue={c.commercial_country ?? ''} placeholder="auto" maxLength={3} disabled={!canWrite || busy} className="w-20" onBlur={e => { const v = e.target.value.trim().toUpperCase(); if (v !== (c.commercial_country ?? '')) void save(c.customer_id, { commercial_country: v || null }); }} /></td></tr>)}</tbody></table></div><p className="text-xs text-muted-foreground">{Math.min(list.length,200)} / {list.length} clients · À classer = B2C par défaut</p>
      </TabsContent>
      <TabsContent value="crm" className="space-y-3">
        <Input aria-label="Rechercher un client CRM" placeholder="Client CRM…" value={search} onChange={e => setSearch(e.target.value)} />
        <div className="max-h-96 overflow-auto"><table className="w-full text-sm"><thead><tr className="border-b"><th className="p-2 text-left">Client CRM</th><th className="p-2 text-left">Client Erplain lié</th><th className="p-2 text-left">Canal commun</th></tr></thead><tbody>{crmClients.filter(c => c.company_name.toLowerCase().includes(search.toLowerCase())).map(c => <tr key={c.id} className="border-b"><td className="p-2">{c.company_name}</td><td className="p-2"><Select value={c.erplain_customer_id ?? 'none'} disabled={!canWrite || busy} onValueChange={v => saveCrm(c.id, { erplain_customer_id: v === 'none' ? null : v })}><SelectTrigger className="w-64"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Non lié à Erplain</SelectItem>{customers.map(e => <SelectItem key={e.customer_id} value={e.customer_id}>{e.customer_name || 'Sans nom'} · {e.customer_id}</SelectItem>)}</SelectContent></Select></td><td className="p-2">{c.erplain_customer_id ? <span>{crmChannel(c,customers)} · affectation Erplain</span> : <Select value={c.sales_channel} disabled={!canWrite || busy} onValueChange={v => saveCrm(c.id, { sales_channel: v })}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent>{['B2C','B2B','OEM'].map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent></Select>}</td></tr>)}</tbody></table></div>
      </TabsContent>
      <TabsContent value="rules" className="space-y-3"><PipeRulesPanel rules={rules} orders={samples} canWrite={canWrite} onReload={reloadRules} error={ruleError} />
        <div className="flex flex-wrap gap-2"><Select value={selectedRule} onValueChange={setSelectedRule}><SelectTrigger className="w-64"><SelectValue placeholder="Règle à appliquer aux clients" /></SelectTrigger><SelectContent>{rules.filter(r => r.enabled).map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent></Select><Button onClick={apply} disabled={!canWrite || busy || !candidates.length}>Affecter {candidates.length} client(s)</Button></div>
        {chosen && <div className="text-xs text-muted-foreground">{candidates.slice(0,10).map(c => <p key={c.customer_id}>{c.customer_name} → {chosen.channel.toUpperCase()}</p>)}</div>}
        <p className="text-xs text-muted-foreground">Les règles préparent une affectation client à confirmer ; elles ne reclassent plus les commandes isolément. Les références BC et produits utilisent les commandes chargées dans le Pipe.</p>
      </TabsContent>
    </Tabs>
  </div>;
}