import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, Loader2, Plus, Repeat, Sparkles as _unused } from 'lucide-react';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { toast } from 'sonner';
import { addEvent, CHANNELS, isLate, listEvents, listTasks, OPEN, PRIO_L, PRIORITIES, saveTask, STATUS_L, STATUSES, type Task, type TaskEvent } from './taskApi';

void _unused;
const ALL = '__all';
const FREE = '__free';
const NONE = '__none';
const prioVariant = (p: string) => (p === 'haute' ? 'destructive' : p === 'moyenne' ? 'default' : 'secondary') as any;
const fdate = (d: string | null) => (d ? new Date(d + 'T00:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '—');
const EV_L: Record<string, string> = { commentaire: 'Commentaire', decision: 'Décision', action: 'Action réalisée', resultat: 'Résultat observé', statut: 'Statut', creation: 'Création', recurrence: 'Récurrence' };

/** Shared loader so the summary and the board stay in sync after edits. */
export function useMarketingTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const reload = useCallback(() => listTasks().then((t) => { setTasks(t); setErr(''); }).catch((e) => setErr(e.message ?? String(e))).finally(() => setLoading(false)), []);
  useEffect(() => { reload(); const h = () => reload(); window.addEventListener('marketing-tasks-changed', h); return () => window.removeEventListener('marketing-tasks-changed', h); }, [reload]);
  return { tasks, loading, err, reload };
}
export const notifyTasksChanged = () => window.dispatchEvent(new Event('marketing-tasks-changed'));

function useAssigneeName() {
  const { members } = useTeamMembers();
  return { members, name: (t: Task) => (t.assignee_user_id ? (members.find((m) => m.id === t.assignee_user_id)?.display_name || members.find((m) => m.id === t.assignee_user_id)?.email || 'Utilisateur') : t.assignee_label || '—') };
}

export function TaskSummary({ onOpen }: { onOpen?: () => void }) {
  const { tasks } = useMarketingTasks();
  const open = tasks.filter((t) => OPEN.has(t.status));
  const late = open.filter(isLate);
  const high = open.filter((t) => t.priority === 'haute' && !isLate(t));
  if (!open.length) return null;
  return (
    <Card>
      <CardContent className="flex flex-wrap items-start gap-6 py-4 text-sm">
        <div><div className="text-2xl font-semibold">{open.length}</div><div className="text-muted-foreground">tâches ouvertes</div></div>
        <div><div className={`text-2xl font-semibold ${late.length ? 'text-destructive' : ''}`}>{late.length}</div><div className="text-muted-foreground">en retard</div></div>
        <div><div className="text-2xl font-semibold">{high.length}</div><div className="text-muted-foreground">priorité haute</div></div>
        <div className="min-w-64 flex-1 space-y-1">
          {[...late, ...high].slice(0, 4).map((t) => (
            <div key={t.id} className="flex items-center gap-2 truncate">
              {isLate(t) ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" /> : <Badge variant="destructive" className="h-4 px-1 text-[10px]">Haute</Badge>}
              <span className="truncate">{t.title}</span><span className="shrink-0 text-muted-foreground">· {fdate(t.due_date)}</span>
            </div>))}
        </div>
        {onOpen && <Button variant="outline" size="sm" onClick={onOpen} data-readonly-allow>Voir les tâches</Button>}
      </CardContent>
    </Card>
  );
}

const EMPTY: Partial<Task> = { title: '', description: '', priority: 'moyenne', status: 'a_faire', source: 'manuel' };

function TaskDialog({ task, open, onClose, canWrite, countries }: { task: Task | null; open: boolean; onClose: () => void; canWrite: boolean; countries: string[] }) {
  const { members } = useTeamMembers();
  const [v, setV] = useState<Partial<Task>>(EMPTY);
  const [events, setEvents] = useState<TaskEvent[]>([]);
  const [note, setNote] = useState(''); const [kind, setKind] = useState('commentaire');
  const [busy, setBusy] = useState(false);
  const [free, setFree] = useState(false);
  useEffect(() => {
    if (!open) return;
    setV(task ?? EMPTY); setFree(!!task?.assignee_label && !task?.assignee_user_id); setNote('');
    if (task) listEvents(task.id).then(setEvents).catch(() => setEvents([])); else setEvents([]);
  }, [task, open]);
  const set = (k: keyof Task, x: any) => setV((s) => ({ ...s, [k]: x === '' ? null : x }));
  const assignee = free ? FREE : v.assignee_user_id ?? NONE;
  const save = async () => {
    if (!v.title?.trim()) { toast.error('Titre requis'); return; }
    setBusy(true);
    try {
      const { id, created_at, updated_at, completed_at, recurrence_count, ...rest } = v as any;
      void id; void created_at; void updated_at; void completed_at; void recurrence_count;
      await saveTask(rest, task ?? undefined); toast.success('Tâche enregistrée'); notifyTasksChanged(); onClose();
    } catch (e: any) { toast.error(e.message ?? 'Erreur'); } finally { setBusy(false); }
  };
  const post = async () => {
    if (!task || !note.trim()) return;
    try { await addEvent(task.id, kind, note.trim()); setNote(''); setEvents(await listEvents(task.id)); } catch (e: any) { toast.error(e.message); }
  };
  const ro = !canWrite;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{task ? 'Tâche marketing' : 'Nouvelle tâche'}</DialogTitle></DialogHeader>
        {task?.source === 'ia' && <div className="flex flex-wrap gap-2 text-xs text-muted-foreground"><Badge variant="outline">Issue du diagnostic IA</Badge>{task.source_analysis_id && <span>Diagnostic n° {task.source_analysis_id.slice(0, 8)}</span>}{task.recurrence_count > 1 && <Badge variant="secondary"><Repeat className="mr-1 h-3 w-3" />Recommandée {task.recurrence_count} fois</Badge>}</div>}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1"><Label>Titre</Label><Input disabled={ro} value={v.title ?? ''} onChange={(e) => set('title', e.target.value)} /></div>
          <div className="sm:col-span-2 space-y-1"><Label>Description</Label><Textarea disabled={ro} rows={4} value={v.description ?? ''} onChange={(e) => set('description', e.target.value)} /></div>
          <div className="space-y-1"><Label>Statut</Label><Select disabled={ro} value={v.status} onValueChange={(x) => set('status', x)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label>Priorité</Label><Select disabled={ro} value={v.priority} onValueChange={(x) => set('priority', x)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PRIORITIES.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label>Responsable</Label>
            <Select disabled={ro} value={assignee} onValueChange={(x) => { if (x === FREE) { setFree(true); setV((s) => ({ ...s, assignee_user_id: null })); } else { setFree(false); setV((s) => ({ ...s, assignee_user_id: x === NONE ? null : x, assignee_label: null })); } }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value={NONE}>Non attribuée</SelectItem>{members.map((m) => <SelectItem key={m.id} value={m.id}>{m.display_name || m.email}</SelectItem>)}<SelectItem value={FREE}>Autre (saisie libre)…</SelectItem></SelectContent>
            </Select>
            {free && <Input disabled={ro} placeholder="Crush AI, prestataire…" value={v.assignee_label ?? ''} onChange={(e) => set('assignee_label', e.target.value)} />}
          </div>
          <div className="space-y-1"><Label>Échéance</Label><Input disabled={ro} type="date" value={v.due_date ?? ''} onChange={(e) => set('due_date', e.target.value)} /></div>
          <div className="space-y-1"><Label>Régie / canal</Label><Select disabled={ro} value={v.channel ?? NONE} onValueChange={(x) => set('channel', x === NONE ? null : x)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={NONE}>—</SelectItem>{CHANNELS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label>Pays</Label><Input disabled={ro} list="mkt-countries" placeholder="FR, IT…" value={v.country ?? ''} onChange={(e) => set('country', e.target.value.toUpperCase())} /><datalist id="mkt-countries">{countries.map((c) => <option key={c} value={c} />)}</datalist></div>
          <div className="space-y-1"><Label>Campagne</Label><Input disabled={ro} value={v.campaign ?? ''} onChange={(e) => set('campaign', e.target.value)} /></div>
          <div className="space-y-1"><Label>Produit</Label><Input disabled={ro} value={v.product ?? ''} onChange={(e) => set('product', e.target.value)} /></div>
          <div className="sm:col-span-2 space-y-1"><Label>Résultats observés après exécution</Label><Textarea disabled={ro} rows={3} placeholder="Ex. MER Italie passé de 3,1 à 3,8 en 2 semaines" value={v.results ?? ''} onChange={(e) => set('results', e.target.value)} /></div>
        </div>
        {canWrite && <DialogFooter><Button variant="outline" onClick={onClose}>Fermer</Button><Button onClick={save} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Enregistrer</Button></DialogFooter>}
        {task && (
          <div className="space-y-2 border-t pt-3">
            <div className="text-sm font-medium">Historique</div>
            {canWrite && <div className="flex gap-2">
              <Select value={kind} onValueChange={setKind}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent>{['commentaire', 'decision', 'action'].map((k) => <SelectItem key={k} value={k}>{EV_L[k]}</SelectItem>)}</SelectContent></Select>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ajouter une note…" onKeyDown={(e) => e.key === 'Enter' && post()} />
              <Button variant="secondary" onClick={post}>Ajouter</Button></div>}
            <div className="max-h-56 space-y-2 overflow-y-auto text-sm">{events.map((e) => (
              <div key={e.id} className="rounded border p-2"><div className="flex justify-between gap-2 text-xs text-muted-foreground"><span><Badge variant="outline" className="mr-1">{EV_L[e.kind] ?? e.kind}</Badge>{e.author_name}</span><span>{new Date(e.created_at).toLocaleString('fr-FR')}</span></div><div className="mt-1 whitespace-pre-wrap">{e.body}</div></div>))}
              {!events.length && <p className="text-muted-foreground">Aucun événement.</p>}</div>
          </div>)}
      </DialogContent>
    </Dialog>
  );
}

export function MarketingTasks({ canWrite }: { canWrite: boolean }) {
  const { tasks, loading, err } = useMarketingTasks();
  const { members, name } = useAssigneeName();
  const [view, setView] = useState('kanban');
  const [q, setQ] = useState(''); const [fs, setFs] = useState(ALL); const [fc, setFc] = useState(ALL); const [fch, setFch] = useState(ALL); const [fa, setFa] = useState(ALL);
  const [sel, setSel] = useState<Task | null>(null); const [dlg, setDlg] = useState(false);
  const countries = useMemo(() => [...new Set(tasks.map((t) => t.country).filter(Boolean) as string[])].sort(), [tasks]);
  const assignees = useMemo(() => [...new Set(tasks.map(name))].sort(), [tasks, name]);
  const rows = useMemo(() => tasks.filter((t) => (fs === ALL ? true : fs === 'open' ? OPEN.has(t.status) : t.status === fs) && (fc === ALL || t.country === fc) && (fch === ALL || t.channel === fch) && (fa === ALL || name(t) === fa)
    && (!q || [t.title, t.description, t.campaign, t.product, t.country].join(' ').toLowerCase().includes(q.toLowerCase()))), [tasks, fs, fc, fch, fa, q, name]);
  const openTask = (t: Task | null) => { setSel(t); setDlg(true); };
  const move = async (t: Task, status: string) => { try { await saveTask({ status }, t); notifyTasksChanged(); } catch (e: any) { toast.error(e.message); } };
  void members;

  const CardItem = ({ t }: { t: Task }) => (
    <div role="button" tabIndex={0} onClick={() => openTask(t)} onKeyDown={(e) => e.key === 'Enter' && openTask(t)} className="cursor-pointer space-y-1.5 rounded-md border bg-card p-2.5 text-sm hover:border-primary">
      <div className="font-medium leading-snug">{t.title}</div>
      <div className="flex flex-wrap gap-1">
        <Badge variant={prioVariant(t.priority)} className="text-[10px]">{PRIO_L[t.priority]}</Badge>
        {t.channel && <Badge variant="secondary" className="text-[10px]">{t.channel}</Badge>}
        {t.country && <Badge variant="outline" className="text-[10px]">{t.country}</Badge>}
        {t.source === 'ia' && <Badge variant="outline" className="text-[10px]">IA{t.recurrence_count > 1 ? ` ×${t.recurrence_count}` : ''}</Badge>}
      </div>
      <div className={`flex justify-between text-xs ${isLate(t) ? 'text-destructive' : 'text-muted-foreground'}`}><span className="truncate">{name(t)}</span><span>{isLate(t) && 'En retard · '}{fdate(t.due_date)}</span></div>
    </div>);

  const groupBy = (k: 'country' | 'channel') => {
    const m: Record<string, Task[]> = {}; for (const t of rows) (m[t[k] || 'Non renseigné'] ??= []).push(t);
    return Object.entries(m).sort((a, b) => b[1].filter((t) => OPEN.has(t.status)).length - a[1].filter((t) => OPEN.has(t.status)).length);
  };

  return (
    <div className="space-y-4">
      <TaskSummary />
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 py-3">
          <Input className="w-56" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} data-readonly-allow />
          <Select value={fs} onValueChange={setFs}><SelectTrigger className="w-36" data-readonly-allow><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>Tous statuts</SelectItem><SelectItem value="open">Ouvertes</SelectItem>{STATUSES.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent></Select>
          <Select value={fch} onValueChange={setFch}><SelectTrigger className="w-40" data-readonly-allow><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>Toutes régies</SelectItem>{CHANNELS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
          <Select value={fc} onValueChange={setFc}><SelectTrigger className="w-32" data-readonly-allow><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>Tous pays</SelectItem>{countries.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
          <Select value={fa} onValueChange={setFa}><SelectTrigger className="w-40" data-readonly-allow><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>Tous responsables</SelectItem>{assignees.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
          <Tabs value={view} onValueChange={setView}><TabsList>
            <TabsTrigger value="kanban" data-readonly-allow>Kanban</TabsTrigger><TabsTrigger value="table" data-readonly-allow>Tableau</TabsTrigger>
            <TabsTrigger value="country" data-readonly-allow>Par pays</TabsTrigger><TabsTrigger value="channel" data-readonly-allow>Par régie</TabsTrigger></TabsList></Tabs>
          {canWrite && <Button className="ml-auto" onClick={() => openTask(null)}><Plus className="mr-1 h-4 w-4" />Créer une tâche</Button>}
        </CardContent>
      </Card>
      {err && <p className="text-sm text-destructive">{err}</p>}
      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : view === 'kanban' ? (
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">{STATUSES.map((s) => {
          const col = rows.filter((t) => t.status === s.v);
          return (
            <div key={s.v} className="space-y-2 rounded-lg bg-muted/40 p-2" onDragOver={(e) => canWrite && e.preventDefault()} onDrop={(e) => { const id = e.dataTransfer.getData('text'); const t = tasks.find((x) => x.id === id); if (t && t.status !== s.v) move(t, s.v); }}>
              <div className="flex justify-between px-1 text-sm font-medium"><span>{s.l}</span><span className="text-muted-foreground">{col.length}</span></div>
              {col.map((t) => <div key={t.id} draggable={canWrite} onDragStart={(e) => e.dataTransfer.setData('text', t.id)}><CardItem t={t} /></div>)}
            </div>);
        })}</div>
      ) : view === 'table' ? (
        <Card><CardContent className="overflow-x-auto pt-4"><Table>
          <TableHeader><TableRow><TableHead>Tâche</TableHead><TableHead>Statut</TableHead><TableHead>Priorité</TableHead><TableHead>Régie</TableHead><TableHead>Pays</TableHead><TableHead>Campagne / produit</TableHead><TableHead>Responsable</TableHead><TableHead>Échéance</TableHead><TableHead>Résultat</TableHead></TableRow></TableHeader>
          <TableBody>{rows.map((t) => (
            <TableRow key={t.id} className="cursor-pointer" onClick={() => openTask(t)}>
              <TableCell className="max-w-72 font-medium">{t.title}{t.source === 'ia' && <Badge variant="outline" className="ml-1 text-[10px]">IA{t.recurrence_count > 1 ? ` ×${t.recurrence_count}` : ''}</Badge>}</TableCell>
              <TableCell>{STATUS_L[t.status]}</TableCell><TableCell><Badge variant={prioVariant(t.priority)}>{PRIO_L[t.priority]}</Badge></TableCell>
              <TableCell>{t.channel ?? '—'}</TableCell><TableCell>{t.country ?? '—'}</TableCell><TableCell className="max-w-48 truncate">{[t.campaign, t.product].filter(Boolean).join(' · ') || '—'}</TableCell>
              <TableCell>{name(t)}</TableCell><TableCell className={isLate(t) ? 'text-destructive' : ''}>{fdate(t.due_date)}</TableCell><TableCell className="max-w-48 truncate text-muted-foreground">{t.results ?? '—'}</TableCell>
            </TableRow>))}
            {!rows.length && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Aucune tâche.</TableCell></TableRow>}</TableBody>
        </Table></CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{groupBy(view as 'country' | 'channel').map(([g, list]) => (
          <Card key={g}><CardHeader className="pb-2"><CardTitle className="flex justify-between text-base"><span>{g}</span><span className="text-sm font-normal text-muted-foreground">{list.filter((t) => OPEN.has(t.status)).length} ouvertes · {list.filter(isLate).length} en retard · {list.filter((t) => t.status === 'termine').length} terminées</span></CardTitle></CardHeader>
            <CardContent className="space-y-2">{list.filter((t) => OPEN.has(t.status)).map((t) => <CardItem key={t.id} t={t} />)}{!list.some((t) => OPEN.has(t.status)) && <p className="text-sm text-muted-foreground">Aucune tâche ouverte.</p>}</CardContent></Card>))}
          {!rows.length && <p className="text-sm text-muted-foreground">Aucune tâche.</p>}</div>
      )}
      <TaskDialog task={sel} open={dlg} onClose={() => setDlg(false)} canWrite={canWrite} countries={countries} />
    </div>
  );
}
