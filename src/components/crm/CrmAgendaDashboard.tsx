import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, CalendarDays, Download, Bell, Users, AlertTriangle, Plus, Pencil, Trash2, CheckCircle2, MapPin } from 'lucide-react';
import { CrmMeeting, CrmReminder, REMINDER_TYPES } from '@/hooks/useCRMData';
import { downloadIcs, IcsItem } from '@/lib/crmIcs';
import { cn } from '@/lib/utils';
import { reminderQueue } from './reminderQueue';

const pad = (n: number) => String(n).padStart(2, '0');
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const OPEN_KEY = 'crm-agenda-open';
const fmtDay = (k: string) => new Date(k + 'T12:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });

const readOpen = () => {
  try { return localStorage.getItem(OPEN_KEY) !== '0'; } catch { return true; }
};

interface Props {
  reminders: CrmReminder[];
  meetings: CrmMeeting[];
  customers: { id: string; company_name: string }[];
  onComplete: (id: string) => Promise<boolean>;
  onUncomplete?: (id: string) => Promise<boolean>;
  onSelectClient?: (id: string) => void;
  onCreateMeeting?: (m: Partial<CrmMeeting> & { customer_id: string }) => Promise<unknown>;
  onUpdateMeeting?: (id: string, m: Partial<CrmMeeting>) => Promise<boolean>;
  onDeleteMeeting?: (id: string) => Promise<boolean>;
  onCreateReminder?: (r: Partial<CrmReminder> & { customer_id: string }) => Promise<unknown>;
  onDeleteReminder?: (id: string) => Promise<boolean>;
}

type MeetForm = { id?: string; customer_id: string; title: string; date: string; time: string; duration: string; location: string; notes: string; status: CrmMeeting['status'] };
type RemForm = { customer_id: string; title: string; due_date: string; reminder_type: string; priority: string; description: string };

export function CrmAgendaDashboard({ reminders, meetings, customers, onComplete, onUncomplete, onSelectClient, onCreateMeeting, onUpdateMeeting, onDeleteMeeting, onCreateReminder, onDeleteReminder }: Props) {
  const todayKey = keyOf(new Date());
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [selected, setSelected] = useState(todayKey);
  const [asOf, setAsOf] = useState(todayKey);
  const [showDone, setShowDone] = useState(false);
  const [open, setOpen] = useState(readOpen);
  const [meetForm, setMeetForm] = useState<MeetForm | null>(null);
  const [remForm, setRemForm] = useState<RemForm | null>(null);
  const [saving, setSaving] = useState(false);
  const name = (id: string) => customers.find(c => c.id === id)?.company_name ?? '';
  const sortedCustomers = useMemo(() => [...customers].sort((a, b) => a.company_name.localeCompare(b.company_name)), [customers]);

  const activeMeetings = useMemo(() => meetings.filter(x => x.status !== 'cancelled'), [meetings]);
  const meetByDay = useMemo(() => {
    const m = new Map<string, CrmMeeting[]>();
    activeMeetings.forEach(x => { const k = keyOf(new Date(x.meeting_date)); if (!m.has(k)) m.set(k, []); m.get(k)!.push(x); });
    m.forEach(list => list.sort((a, b) => a.meeting_date.localeCompare(b.meeting_date)));
    return m;
  }, [activeMeetings]);

  const queue = useMemo(() => reminderQueue(reminders, asOf || todayKey), [reminders, asOf, todayKey]);
  const overdue = reminders.filter(r => !r.is_completed && r.due_date.slice(0, 10) < todayKey);
  const todayCount = reminders.filter(r => !r.is_completed && r.due_date.slice(0, 10) === todayKey).length;

  const cells = useMemo(() => {
    const start = new Date(month); start.setDate(1 - ((month.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }, [month]);

  const dayMeets = meetByDay.get(selected) ?? [];
  const typeLabel = (t: string) => REMINDER_TYPES.find(x => x.key === t)?.label ?? t;

  const exportUpcoming = () => {
    const items: IcsItem[] = [
      ...reminders.filter(r => !r.is_completed && r.due_date.slice(0, 10) >= todayKey).map(r => ({
        uid: `rem-${r.id}`, title: `${r.title}${name(r.customer_id) ? ' – ' + name(r.customer_id) : ''}`, date: r.due_date, allDay: true, description: r.description })),
      ...meetings.filter(x => x.status === 'planned' && new Date(x.meeting_date) >= new Date()).map(x => ({
        uid: `rdv-${x.id}`, title: `RDV ${x.title}${name(x.customer_id) ? ' – ' + name(x.customer_id) : ''}`, date: x.meeting_date, durationMin: x.duration_minutes ?? 60, description: x.notes })),
    ];
    downloadIcs(items, 'crm-agenda.ics');
  };

  const persistOpen = (v: boolean) => { try { localStorage.setItem(OPEN_KEY, v ? '1' : '0'); } catch { /* stockage indisponible */ } };
  const openAt = (k: string) => { setAsOf(k < todayKey ? todayKey : k); setOpen(true); persistOpen(true); };

  const nextUp = useMemo(() => {
    const pending = reminders.filter(r => !r.is_completed);
    return [...pending].sort((a, b) => a.due_date.localeCompare(b.due_date)).slice(0, 5);
  }, [reminders]);

  const newMeeting = (k: string) => setMeetForm({ customer_id: '', title: '', date: k, time: '09:00', duration: '60', location: '', notes: '', status: 'planned' });
  const editMeeting = (x: CrmMeeting) => { const d = new Date(x.meeting_date); setMeetForm({ id: x.id, customer_id: x.customer_id, title: x.title, date: keyOf(d), time: `${pad(d.getHours())}:${pad(d.getMinutes())}`, duration: String(x.duration_minutes ?? 60), location: x.location ?? '', notes: x.notes ?? '', status: x.status }); };

  const saveMeeting = async () => {
    if (!meetForm || !meetForm.customer_id || !meetForm.title.trim() || !meetForm.date) return;
    setSaving(true);
    const payload: Partial<CrmMeeting> = {
      customer_id: meetForm.customer_id, title: meetForm.title.trim(),
      meeting_date: new Date(`${meetForm.date}T${meetForm.time || '09:00'}`).toISOString(),
      duration_minutes: Number(meetForm.duration) || 60, location: meetForm.location || null, notes: meetForm.notes || null, status: meetForm.status,
    };
    const ok = meetForm.id ? await onUpdateMeeting?.(meetForm.id, payload) : await onCreateMeeting?.(payload as Partial<CrmMeeting> & { customer_id: string });
    setSaving(false);
    if (ok) { setSelected(meetForm.date); setMeetForm(null); }
  };
  const removeMeeting = async () => {
    if (!meetForm?.id || !confirm('Supprimer ce rendez-vous ? (il part dans la corbeille)')) return;
    if (await onDeleteMeeting?.(meetForm.id)) setMeetForm(null);
  };

  const saveReminder = async () => {
    if (!remForm || !remForm.customer_id || !remForm.title.trim() || !remForm.due_date) return;
    setSaving(true);
    const ok = await onCreateReminder?.({ customer_id: remForm.customer_id, title: remForm.title.trim(), due_date: remForm.due_date, reminder_type: remForm.reminder_type as CrmReminder['reminder_type'], priority: remForm.priority as CrmReminder['priority'], description: remForm.description || null });
    setSaving(false);
    if (ok) setRemForm(null);
  };

  const clientSelect = (value: string, onChange: (v: string) => void) => (
    <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={value} onChange={e => onChange(e.target.value)}>
      <option value="">Choisir un client…</option>
      {sortedCustomers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
    </select>
  );

  const reminderRow = (r: CrmReminder) => {
    const k = r.due_date.slice(0, 10);
    const late = !r.is_completed && k < todayKey;
    return (
      <div key={r.id} className={cn('group flex items-start gap-2 rounded-lg border p-2.5 text-sm transition-colors',
        r.is_completed ? 'bg-muted/40 opacity-70' : late ? 'border-destructive/40 bg-destructive/5' : k === todayKey ? 'border-primary/40 bg-primary/5' : 'bg-background')}>
        <Checkbox checked={r.is_completed} className="mt-0.5" aria-label={r.is_completed ? 'Marquer non traitée' : 'Marquer traitée'}
          onCheckedChange={() => r.is_completed ? onUncomplete?.(r.id) : onComplete(r.id)} />
        <div className="min-w-0 flex-1">
          <div className={cn('font-medium leading-tight', r.is_completed && 'line-through')}>{r.title}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span className={cn('font-medium', late && 'text-destructive')}>{late ? 'En retard · ' : ''}{fmtDay(k)}</span>
            <span>{typeLabel(r.reminder_type)}</span>
            {r.priority === 'haute' && <span className="text-destructive">priorité haute</span>}
            {name(r.customer_id) && <button type="button" className="text-primary hover:underline" onClick={() => onSelectClient?.(r.customer_id)}>{name(r.customer_id)}</button>}
          </div>
          {r.description && <p className="mt-0.5 text-xs text-muted-foreground whitespace-pre-line line-clamp-2">{r.description}</p>}
          {r.is_completed && r.completed_at && <p className="mt-0.5 text-[11px] text-muted-foreground">Traitée le {new Date(r.completed_at).toLocaleDateString('fr-FR')}</p>}
        </div>
        {onDeleteReminder && <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100" aria-label="Supprimer la relance"
          onClick={() => { if (confirm('Supprimer cette relance ?')) onDeleteReminder(r.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-5 w-5" /> Agenda & relances</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            {overdue.length > 0 && <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />{overdue.length} relance{overdue.length > 1 ? 's' : ''} en retard</Badge>}
            <Button size="sm" variant="outline" onClick={exportUpcoming} title="Fichier à ouvrir dans Outlook pour ajouter les rappels et RDV à venir">
              <Download className="h-3.5 w-3.5 mr-1" /> Ajouter à Outlook
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setOpen(v => { const next = !v; persistOpen(next); return next; }); }} title={open ? 'Replier l\'agenda' : 'Déplier l\'agenda'} aria-label={open ? 'Replier l\'agenda' : 'Déplier l\'agenda'}>
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      {!open && (
        <CardContent className="pt-0">
          {nextUp.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune relance à faire. Ouvrez l'agenda pour en programmer une.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {nextUp.map(r => {
                const k = r.due_date.slice(0, 10);
                const late = k < todayKey;
                return (
                  <button key={r.id} onClick={() => openAt(k)} className={cn(
                    'max-w-full rounded-md border px-2 py-1 text-left text-xs transition-colors hover:bg-accent',
                    late ? 'border-destructive/40 bg-destructive/10 text-destructive' : 'bg-background')}>
                    <span className="font-medium">{fmtDay(k)}</span>
                    {' · '}{r.title}
                    {name(r.customer_id) && <span className="text-muted-foreground"> – {name(r.customer_id)}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      )}
      {open && (
      <CardContent className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        {/* Calendrier des rendez-vous */}
        <div className="rounded-xl border p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Mois précédent" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft className="h-4 w-4" /></Button>
              <button className="font-medium capitalize text-sm min-w-[120px]" onClick={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); setSelected(todayKey); }}>
                {month.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
              </button>
              <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Mois suivant" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight className="h-4 w-4" /></Button>
            </div>
            {onCreateMeeting && <Button size="sm" onClick={() => newMeeting(selected)}><Plus className="h-3.5 w-3.5 mr-1" /> Rendez-vous</Button>}
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground mb-1">{WEEKDAYS.map(w => <div key={w}>{w}</div>)}</div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map(d => {
              const k = keyOf(d); const list = meetByDay.get(k) ?? [];
              return (
                <button key={k} onClick={() => setSelected(k)} onDoubleClick={() => onCreateMeeting && newMeeting(k)} className={cn(
                  'min-h-[68px] rounded-md border p-1 text-left transition-colors hover:bg-accent overflow-hidden',
                  d.getMonth() !== month.getMonth() && 'opacity-40',
                  k === todayKey && 'border-primary',
                  k === selected && 'bg-primary/10 ring-1 ring-primary')}>
                  <div className={cn('text-xs font-medium', k === todayKey && 'text-primary')}>{d.getDate()}</div>
                  <div className="mt-0.5 space-y-0.5">
                    {list.slice(0, 2).map(x => (
                      <div key={x.id} className={cn('truncate rounded px-1 text-[10px]', x.status === 'completed' ? 'bg-muted text-muted-foreground' : 'bg-primary/15 text-primary')}>
                        {new Date(x.meeting_date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} {name(x.customer_id) || x.title}
                      </div>
                    ))}
                    {list.length > 2 && <div className="text-[10px] text-muted-foreground">+{list.length - 2}</div>}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-3 border-t pt-3 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm capitalize">{new Date(selected + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</h4>
              {onCreateMeeting && <Button size="sm" variant="ghost" onClick={() => newMeeting(selected)}><Plus className="h-3.5 w-3.5 mr-1" /> Ajouter ce jour</Button>}
            </div>
            {dayMeets.length === 0 && <p className="text-sm text-muted-foreground">Aucun rendez-vous ce jour.</p>}
            {dayMeets.map(x => (
              <div key={x.id} className="flex items-start gap-2 rounded-md border bg-secondary/40 p-2 text-sm">
                <Users className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{new Date(x.meeting_date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} · {x.title}{x.status === 'completed' && <span className="ml-1 text-xs text-muted-foreground">(effectué)</span>}</div>
                  <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                    {name(x.customer_id) && <button className="text-primary hover:underline" onClick={() => onSelectClient?.(x.customer_id)}>{name(x.customer_id)}</button>}
                    {x.location && <span className="flex items-center gap-0.5"><MapPin className="h-3 w-3" />{x.location}</span>}
                  </div>
                </div>
                {onUpdateMeeting && <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Modifier le rendez-vous" onClick={() => editMeeting(x)}><Pencil className="h-3.5 w-3.5" /></Button>}
              </div>
            ))}
          </div>
        </div>

        {/* Gestion des relances */}
        <div className="rounded-xl border bg-gradient-to-b from-primary/5 to-transparent p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="flex items-center gap-2 font-semibold text-sm"><Bell className="h-4 w-4" /> Mes relances</h4>
            {onCreateReminder && <Button size="sm" variant="outline" onClick={() => setRemForm({ customer_id: '', title: '', due_date: asOf || todayKey, reminder_type: 'follow_up', priority: 'moyenne', description: '' })}><Plus className="h-3.5 w-3.5 mr-1" /> Relance</Button>}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border bg-background p-2"><div className="text-lg font-semibold text-destructive">{overdue.length}</div><div className="text-[11px] text-muted-foreground">En retard</div></div>
            <div className="rounded-lg border bg-background p-2"><div className="text-lg font-semibold text-primary">{todayCount}</div><div className="text-[11px] text-muted-foreground">Aujourd'hui</div></div>
            <div className="rounded-lg border bg-background p-2"><div className="text-lg font-semibold">{queue.done.length}</div><div className="text-[11px] text-muted-foreground">Traitées</div></div>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="rem-asof" className="text-xs whitespace-nowrap">À faire jusqu'au</Label>
            <Input id="rem-asof" type="date" className="h-8" value={asOf} onChange={e => setAsOf(e.target.value)} />
            {asOf !== todayKey && <Button size="sm" variant="ghost" className="h-8" onClick={() => setAsOf(todayKey)}>Aujourd'hui</Button>}
          </div>
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {queue.pending.length === 0 ? (
              <div className="flex flex-col items-center gap-1 py-6 text-center text-sm text-muted-foreground">
                <CheckCircle2 className="h-6 w-6 text-primary" /> Aucune relance à faire jusqu'à cette date.
              </div>
            ) : queue.pending.map(reminderRow)}
          </div>
          {queue.later > 0 && <p className="text-xs text-muted-foreground">{queue.later} relance{queue.later > 1 ? 's' : ''} prévue{queue.later > 1 ? 's' : ''} après cette date.</p>}
          <div className="border-t pt-2">
            <button className="flex w-full items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground" onClick={() => setShowDone(v => !v)}>
              <span>Traitées ({queue.done.length})</span>{showDone ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            {showDone && <div className="mt-2 space-y-2 max-h-[300px] overflow-y-auto pr-1">{queue.done.length === 0 ? <p className="text-xs text-muted-foreground">Aucune relance traitée.</p> : queue.done.map(reminderRow)}</div>}
          </div>
        </div>
      </CardContent>
      )}

      <Dialog open={!!meetForm} onOpenChange={v => !v && setMeetForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{meetForm?.id ? 'Modifier le rendez-vous' : 'Nouveau rendez-vous'}</DialogTitle></DialogHeader>
          {meetForm && (
            <div className="grid gap-3">
              <div><Label>Client</Label>{clientSelect(meetForm.customer_id, v => setMeetForm({ ...meetForm, customer_id: v }))}</div>
              <div><Label>Objet</Label><Input value={meetForm.title} onChange={e => setMeetForm({ ...meetForm, title: e.target.value })} placeholder="Ex. Présentation gamme 2027" /></div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label>Date</Label><Input type="date" value={meetForm.date} onChange={e => setMeetForm({ ...meetForm, date: e.target.value })} /></div>
                <div><Label>Heure</Label><Input type="time" value={meetForm.time} onChange={e => setMeetForm({ ...meetForm, time: e.target.value })} /></div>
                <div><Label>Durée (min)</Label><Input type="number" min={5} step={5} value={meetForm.duration} onChange={e => setMeetForm({ ...meetForm, duration: e.target.value })} /></div>
              </div>
              <div><Label>Lieu</Label><Input value={meetForm.location} onChange={e => setMeetForm({ ...meetForm, location: e.target.value })} /></div>
              <div><Label>Notes</Label><Textarea rows={3} value={meetForm.notes} onChange={e => setMeetForm({ ...meetForm, notes: e.target.value })} /></div>
              {meetForm.id && (
                <div><Label>Statut</Label>
                  <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={meetForm.status} onChange={e => setMeetForm({ ...meetForm, status: e.target.value as CrmMeeting['status'] })}>
                    <option value="planned">Prévu</option><option value="completed">Effectué</option><option value="cancelled">Annulé</option>
                  </select>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2 sm:justify-between">
            {meetForm?.id && onDeleteMeeting ? <Button variant="destructive" onClick={removeMeeting}><Trash2 className="h-4 w-4 mr-1" /> Supprimer</Button> : <span />}
            <div className="flex gap-2">
              {meetForm?.id && meetForm.customer_id && <Button variant="outline" onClick={() => { onSelectClient?.(meetForm.customer_id); setMeetForm(null); }}>Voir le client</Button>}
              <Button onClick={saveMeeting} disabled={saving || !meetForm?.customer_id || !meetForm?.title.trim()}>Enregistrer</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!remForm} onOpenChange={v => !v && setRemForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouvelle relance</DialogTitle></DialogHeader>
          {remForm && (
            <div className="grid gap-3">
              <div><Label>Client</Label>{clientSelect(remForm.customer_id, v => setRemForm({ ...remForm, customer_id: v }))}</div>
              <div><Label>Action</Label><Input value={remForm.title} onChange={e => setRemForm({ ...remForm, title: e.target.value })} placeholder="Ex. Relancer le devis" /></div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label>Date</Label><Input type="date" value={remForm.due_date} onChange={e => setRemForm({ ...remForm, due_date: e.target.value })} /></div>
                <div><Label>Type</Label>
                  <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={remForm.reminder_type} onChange={e => setRemForm({ ...remForm, reminder_type: e.target.value })}>
                    {REMINDER_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </select></div>
                <div><Label>Priorité</Label>
                  <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={remForm.priority} onChange={e => setRemForm({ ...remForm, priority: e.target.value })}>
                    <option value="basse">Basse</option><option value="moyenne">Moyenne</option><option value="haute">Haute</option>
                  </select></div>
              </div>
              <div><Label>Détail</Label><Textarea rows={3} value={remForm.description} onChange={e => setRemForm({ ...remForm, description: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter><Button onClick={saveReminder} disabled={saving || !remForm?.customer_id || !remForm?.title.trim()}>Enregistrer</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
