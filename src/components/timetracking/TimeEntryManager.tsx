import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Edit, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isToday, isSameDay, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { TimeEntry, TimeCategory } from '@/hooks/useTimeTrackingData';

interface Props {
  entries: TimeEntry[];
  categories: TimeCategory[];
  onCreateEntry: (entry: Partial<TimeEntry>) => Promise<void>;
  onUpdateEntry: (id: string, updates: Partial<TimeEntry>) => Promise<void>;
  onDeleteEntry: (id: string) => Promise<void>;
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${m.toString().padStart(2, '0')}`;
}

export function TimeEntryManager({ entries, categories, onCreateEntry, onUpdateEntry, onDeleteEntry }: Props) {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ task_description: '', category_id: '', duration_hours: 0, duration_minutes: 0, comments: '' });

  const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: currentWeekStart, end: weekEnd });

  const dayEntries = useMemo(() =>
    entries.filter(e => isSameDay(parseISO(e.date), selectedDate)),
    [entries, selectedDate]
  );

  const weekTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    weekDays.forEach(day => {
      const key = format(day, 'yyyy-MM-dd');
      totals[key] = entries
        .filter(e => e.date === key)
        .reduce((sum, e) => sum + e.duration_minutes, 0);
    });
    return totals;
  }, [entries, weekDays]);

  const dayTotal = dayEntries.reduce((sum, e) => sum + e.duration_minutes, 0);

  const getCategoryById = (id: string | null) => categories.find(c => c.id === id);

  const openCreate = () => {
    setEditingId(null);
    setForm({ task_description: '', category_id: '', duration_hours: 0, duration_minutes: 0, comments: '' });
    setDialogOpen(true);
  };

  const openEdit = (entry: TimeEntry) => {
    setEditingId(entry.id);
    setForm({
      task_description: entry.task_description,
      category_id: entry.category_id || '',
      duration_hours: Math.floor(entry.duration_minutes / 60),
      duration_minutes: entry.duration_minutes % 60,
      comments: entry.comments,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.task_description.trim()) return;
    const totalMinutes = (form.duration_hours * 60) + form.duration_minutes;
    const data: Partial<TimeEntry> = {
      date: format(selectedDate, 'yyyy-MM-dd'),
      task_description: form.task_description,
      category_id: form.category_id || null,
      duration_minutes: totalMinutes,
      comments: form.comments,
    };
    if (editingId) {
      await onUpdateEntry(editingId, data);
    } else {
      await onCreateEntry(data);
    }
    setDialogOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">
          Semaine du {format(currentWeekStart, 'd MMMM', { locale: fr })} au {format(weekEnd, 'd MMMM yyyy', { locale: fr })}
        </span>
        <Button variant="outline" size="icon" onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Week day selector */}
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map(day => {
          const key = format(day, 'yyyy-MM-dd');
          const total = weekTotals[key] || 0;
          const isSelected = isSameDay(day, selectedDate);
          return (
            <button
              key={key}
              onClick={() => setSelectedDate(day)}
              className={`p-3 rounded-lg border text-center transition-colors ${
                isSelected ? 'bg-primary text-primary-foreground border-primary' :
                isToday(day) ? 'border-primary/50 bg-primary/5' :
                'border-border hover:bg-muted'
              }`}
            >
              <div className="text-xs font-medium">{format(day, 'EEE', { locale: fr })}</div>
              <div className="text-lg font-bold">{format(day, 'd')}</div>
              {total > 0 && (
                <div className={`text-xs mt-1 ${isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                  {formatDuration(total)}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Day header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{format(selectedDate, 'EEEE d MMMM yyyy', { locale: fr })}</h3>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            Total : {formatDuration(dayTotal)}
          </div>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Ajouter une tâche</Button>
      </div>

      {/* Day entries */}
      <div className="border rounded overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Catégorie</TableHead>
              <TableHead>Tâche</TableHead>
              <TableHead className="text-right">Durée</TableHead>
              <TableHead>Commentaire</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dayEntries.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Aucune entrée pour ce jour. Cliquez sur "Ajouter une tâche".</TableCell></TableRow>
            )}
            {dayEntries.map(entry => {
              const cat = getCategoryById(entry.category_id);
              return (
                <TableRow key={entry.id}>
                  <TableCell>
                    {cat ? (
                      <Badge variant="outline" className="gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                        {cat.name}
                      </Badge>
                    ) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="font-medium">{entry.task_description}</TableCell>
                  <TableCell className="text-right font-mono-numbers">{formatDuration(entry.duration_minutes)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">{entry.comments || '—'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(entry)}><Edit className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => onDeleteEntry(entry.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Modifier la tâche' : 'Nouvelle tâche'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tâche *</Label>
              <Input value={form.task_description} onChange={e => setForm({ ...form, task_description: e.target.value })} placeholder="Description de la tâche..." />
            </div>
            <div>
              <Label>Catégorie</Label>
              <Select value={form.category_id || 'none'} onValueChange={v => setForm({ ...form, category_id: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune</SelectItem>
                  {categories.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                        {c.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Durée</Label>
              <div className="flex items-center gap-2">
                <Input type="number" min={0} max={23} className="w-20 text-right" value={form.duration_hours} onChange={e => setForm({ ...form, duration_hours: parseInt(e.target.value) || 0 })} />
                <span className="text-sm text-muted-foreground">h</span>
                <Input type="number" min={0} max={59} step={5} className="w-20 text-right" value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: parseInt(e.target.value) || 0 })} />
                <span className="text-sm text-muted-foreground">min</span>
              </div>
            </div>
            <div>
              <Label>Commentaire</Label>
              <Textarea value={form.comments} onChange={e => setForm({ ...form, comments: e.target.value })} rows={2} placeholder="Notes optionnelles..." />
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <Button onClick={handleSave} disabled={!form.task_description.trim()}>{editingId ? 'Mettre à jour' : 'Ajouter'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
