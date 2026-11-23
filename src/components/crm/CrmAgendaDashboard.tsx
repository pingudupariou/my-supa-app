import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, CalendarDays, Download, Bell, Users, AlertTriangle } from 'lucide-react';
import { CrmMeeting, CrmReminder, REMINDER_TYPES } from '@/hooks/useCRMData';
import { downloadIcs, IcsItem } from '@/lib/crmIcs';
import { cn } from '@/lib/utils';

const pad = (n: number) => String(n).padStart(2, '0');
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const OPEN_KEY = 'crm-agenda-open';

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
}

export function CrmAgendaDashboard({ reminders, meetings, customers, onComplete, onUncomplete, onSelectClient }: Props) {
  const todayKey = keyOf(new Date());
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [selected, setSelected] = useState(todayKey);
  const [open, setOpen] = useState(readOpen);
  const toggleOpen = () => setOpen(v => { const next = !v; try { localStorage.setItem(OPEN_KEY, next ? '1' : '0'); } catch { /* stockage indisponible */ } return next; });
  const name = (id: string) => customers.find(c => c.id === id)?.company_name ?? '';

  const byDay = useMemo(() => {
    const m = new Map<string, { rem: CrmReminder[]; meet: CrmMeeting[] }>();
    const get = (k: string) => { if (!m.has(k)) m.set(k, { rem: [], meet: [] }); return m.get(k)!; };
    reminders.forEach(r => get(r.due_date.slice(0, 10)).rem.push(r));
    meetings.filter(x => x.status !== 'cancelled').forEach(x => get(keyOf(new Date(x.meeting_date))).meet.push(x));
    return m;
  }, [reminders, meetings]);

  const overdue = reminders.filter(r => !r.is_completed && r.due_date.slice(0, 10) < todayKey);
  const upcoming7 = reminders.filter(r => { const k = r.due_date.slice(0, 10); const lim = keyOf(new Date(Date.now() + 7 * 864e5)); return !r.is_completed && k >= todayKey && k <= lim; });

  const cells = useMemo(() => {
    const start = new Date(month); start.setDate(1 - ((month.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }, [month]);

  const day = byDay.get(selected) ?? { rem: [], meet: [] };
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
  const openDay = (k: string) => { const d = new Date(k + 'T12:00'); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); setSelected(k); setOpen(true); persistOpen(true); };

  // Prochaines actions à faire : retards d'abord, puis les dates les plus proches
  const nextUp = useMemo(() => {
    const pending = reminders.filter(r => !r.is_completed);
    const late = pending.filter(r => r.due_date.slice(0, 10) < todayKey).sort((a, b) => a.due_date.localeCompare(b.due_date));
    const soon = pending.filter(r => r.due_date.slice(0, 10) >= todayKey).sort((a, b) => a.due_date.localeCompare(b.due_date));
    return [...late, ...soon].slice(0, 5);
  }, [reminders, todayKey]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-5 w-5" /> Agenda des actions</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            {overdue.length > 0 && <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />{overdue.length} en retard</Badge>}
            <Badge variant="outline">{upcoming7.length} dans les 7 jours</Badge>
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
            <p className="text-sm text-muted-foreground">Aucune action à faire. Ouvrez l'agenda pour planifier un rappel.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {nextUp.map(r => {
                const k = r.due_date.slice(0, 10);
                const late = k < todayKey;
                return (
                  <button key={r.id} onClick={() => openDay(k)} className={cn(
                    'max-w-full rounded-md border px-2 py-1 text-left text-xs transition-colors hover:bg-accent',
                    late ? 'border-destructive/40 bg-destructive/10 text-destructive' : 'bg-background')}>
                    <span className="font-medium">{new Date(r.due_date + 'T12:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
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
      <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div>
          <div className="flex items-center justify-between mb-2">
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft className="h-4 w-4" /></Button>
            <button className="font-medium capitalize text-sm" onClick={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); setSelected(todayKey); }}>
              {month.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
            </button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground mb-1">{WEEKDAYS.map(w => <div key={w}>{w}</div>)}</div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map(d => {
              const k = keyOf(d); const e = byDay.get(k);
              const pending = e?.rem.filter(r => !r.is_completed).length ?? 0;
              const done = e?.rem.filter(r => r.is_completed).length ?? 0;
              const meets = e?.meet.length ?? 0;
              const late = pending > 0 && k < todayKey;
              return (
                <button key={k} onClick={() => setSelected(k)} className={cn(
                  'min-h-[60px] rounded-md border p-1 text-left transition-colors hover:bg-accent',
                  d.getMonth() !== month.getMonth() && 'opacity-40',
                  k === todayKey && 'border-primary',
                  k === selected && 'bg-primary/10 ring-1 ring-primary')}>
                  <div className={cn('text-xs font-medium', k === todayKey && 'text-primary')}>{d.getDate()}</div>
                  <div className="flex flex-wrap gap-0.5 mt-1">
                    {pending > 0 && <span className={cn('text-[10px] px-1 rounded', late ? 'bg-destructive/15 text-destructive' : 'bg-primary/15 text-primary')}>{pending} à faire</span>}
                    {meets > 0 && <span className="text-[10px] px-1 rounded bg-secondary text-secondary-foreground">{meets} RDV</span>}
                    {done > 0 && pending === 0 && <span className="text-[10px] px-1 rounded bg-muted text-muted-foreground">✓ {done}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="font-medium text-sm capitalize">{new Date(selected + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</h4>
          {day.rem.length === 0 && day.meet.length === 0 && <p className="text-sm text-muted-foreground">Rien de prévu ce jour.</p>}
          {day.meet.map(x => (
            <div key={x.id} className="p-2 rounded-md border bg-secondary/40 text-sm">
              <div className="flex items-center gap-1.5 font-medium"><Users className="h-3.5 w-3.5" />{new Date(x.meeting_date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} · {x.title}</div>
              {name(x.customer_id) && <button className="text-xs text-primary hover:underline" onClick={() => onSelectClient?.(x.customer_id)}>{name(x.customer_id)}</button>}
            </div>
          ))}
          {day.rem.map(r => (
            <label key={r.id} className={cn('flex items-start gap-2 p-2 rounded-md border text-sm cursor-pointer', r.is_completed && 'opacity-60')}>
              <Checkbox checked={r.is_completed} className="mt-0.5" onCheckedChange={() => r.is_completed ? onUncomplete?.(r.id) : onComplete(r.id)} />
              <div className="min-w-0 flex-1">
                <div className={cn('font-medium flex items-center gap-1.5', r.is_completed && 'line-through')}><Bell className="h-3.5 w-3.5 shrink-0" />{r.title}</div>
                <div className="text-xs text-muted-foreground">{typeLabel(r.reminder_type)} · priorité {r.priority}</div>
                {r.description && <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-line">{r.description}</p>}
                {name(r.customer_id) && <button type="button" className="text-xs text-primary hover:underline" onClick={e => { e.preventDefault(); onSelectClient?.(r.customer_id); }}>{name(r.customer_id)}</button>}
              </div>
            </label>
          ))}
          {overdue.length > 0 && (
            <div className="pt-2 border-t">
              <p className="text-xs font-medium text-destructive mb-1">En retard</p>
              {overdue.slice(0, 6).map(r => (
                <button key={r.id} onClick={() => openDay(r.due_date.slice(0, 10))}
                  className="block w-full text-left text-xs hover:underline truncate">
                  {new Date(r.due_date).toLocaleDateString('fr-FR')} · {r.title} {name(r.customer_id) && `– ${name(r.customer_id)}`}
                </button>
              ))}
            </div>
          )}
        </div>
      </CardContent>
      )}
    </Card>
  );
}
