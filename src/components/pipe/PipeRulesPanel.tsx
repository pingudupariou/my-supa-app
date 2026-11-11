import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Pencil, Plus, Trash2, ListFilter } from 'lucide-react';
import { toast } from 'sonner';
import { matchesRule, ruleFields, ruleOperators, type ChannelRule } from './pipeRules';
import type { PipeOrder } from './pipeModel';

const blank: ChannelRule = { id: '', name: '', field: 'label', operator: 'contains', value: '', channel: 'b2b', priority: 100, enabled: true };
export function PipeRulesPanel({ rules, orders, canWrite, onReload, error }: { rules: ChannelRule[]; orders: PipeOrder[]; canWrite: boolean; onReload: () => Promise<void>; error: string | null }) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState<ChannelRule | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const matched = draft ? orders.filter(o => matchesRule(o, { ...draft, enabled: true })) : [];
  const change = async (action: () => PromiseLike<{ error: { message: string } | null }>) => {
    setBusy(true);
    try { const { error } = await action(); if (error) throw error; await onReload(); return true; }
    catch (e) { const message = (e as Error).message; setFormError(message); toast.error(message); return false; }
    finally { setBusy(false); }
  };
  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim() || !draft.value.trim() || !Number.isInteger(draft.priority) || draft.priority < 1 || draft.priority > 9999) { setFormError('Renseignez le nom, le texte recherché et une priorité de 1 à 9999.'); return; }
    const { id, created_at, ...values } = draft;
    const payload = { ...values, name: values.name.trim(), value: values.value.trim() };
    const ok = await change(() => id ? supabase.from('pipe_channel_rules').update(payload).eq('id', id) : supabase.from('pipe_channel_rules').insert(payload));
    if (ok) { setDraft(null); toast.success('Règle enregistrée'); }
  };
  return <section className="border-y border-border py-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Button variant="ghost" onClick={() => setExpanded(!expanded)}><ListFilter className="mr-2 h-4 w-4" />Règles de classement · {rules.filter(r => r.enabled).length} actives</Button>
      {canWrite && <Button variant="outline" size="sm" onClick={() => { setFormError(''); setDraft({ ...blank }); }}><Plus className="mr-2 h-4 w-4" />Nouvelle règle</Button>}
    </div>
    {error && <p role="alert" className="text-sm text-destructive">Classement par règles indisponible : {error}<Button variant="ghost" size="sm" onClick={onReload}>Réessayer</Button></p>}
    {expanded && <div className="mt-3 space-y-2">
      <p className="text-xs text-muted-foreground">Règles d’aide à l’affectation des clients · Application commune après confirmation</p>
      {!rules.length && <p className="text-sm text-muted-foreground">Aucune règle enregistrée.</p>}
      {rules.map(r => <div key={r.id} className="flex flex-wrap items-center gap-3 border-b border-border py-2 text-sm">
        <Switch aria-label={`Activer ${r.name}`} checked={r.enabled} disabled={!canWrite || busy} onCheckedChange={enabled => change(() => supabase.from('pipe_channel_rules').update({ enabled }).eq('id', r.id))} />
        <span className="text-muted-foreground">#{r.priority}</span><div className="min-w-0 flex-1"><strong>{r.name}</strong><p className="break-words text-xs text-muted-foreground">{ruleFields[r.field]} · {ruleOperators[r.operator]} « {r.value} » → {r.channel.toUpperCase()} · {orders.filter(o => matchesRule(o, r)).length} correspondances sur la période</p></div>
        {canWrite && <><Button variant="ghost" size="icon" aria-label={`Modifier ${r.name}`} disabled={busy} onClick={() => { setFormError(''); setDraft({ ...r }); }}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" aria-label={`Supprimer ${r.name}`} disabled={busy} onClick={() => { if (window.confirm(`Supprimer la règle « ${r.name} » ?`)) change(() => supabase.from('pipe_channel_rules').delete().eq('id', r.id)); }}><Trash2 className="h-4 w-4" /></Button></>}
      </div>)}
    </div>}
    <Dialog open={!!draft} onOpenChange={v => { if (!v && !busy) setDraft(null); }}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{draft?.id ? 'Modifier la règle' : 'Nouvelle règle'}</DialogTitle><DialogDescription>Aide au classement commun des clients</DialogDescription></DialogHeader>
      {draft && <div className="space-y-3">
        <div><Label htmlFor="rule-name">Nom de la règle</Label><Input id="rule-name" maxLength={100} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></div>
        <div><Label>Champ Erplain</Label><Select value={draft.field} onValueChange={field => setDraft({ ...draft, field: field as ChannelRule['field'] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(ruleFields).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Condition</Label><Select value={draft.operator} onValueChange={operator => setDraft({ ...draft, operator: operator as ChannelRule['operator'] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(ruleOperators).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
        <div><Label htmlFor="rule-value">Texte recherché</Label><Input id="rule-value" maxLength={200} value={draft.value} onChange={e => setDraft({ ...draft, value: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3"><div><Label>Canal attribué</Label><Select value={draft.channel} onValueChange={channel => setDraft({ ...draft, channel: channel as ChannelRule['channel'] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['b2c', 'b2b', 'oem'].map(k => <SelectItem key={k} value={k}>{k.toUpperCase()}</SelectItem>)}</SelectContent></Select></div><div><Label htmlFor="rule-priority">Priorité</Label><Input id="rule-priority" type="number" min={1} max={9999} value={draft.priority} onChange={e => setDraft({ ...draft, priority: Number(e.target.value) })} /></div></div>
        <div className="border-t border-border pt-3"><strong className="text-sm">Aperçu · {matched.length} commande(s) correspondante(s)</strong>{matched.slice(0, 5).map(o => <p key={o.id} className="text-xs text-muted-foreground">{o.label} · {o.customer} → {draft.channel.toUpperCase()}</p>)}</div>
        {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
        <Button onClick={save} disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer la règle'}</Button>
      </div>}
    </DialogContent></Dialog>
  </section>;
}