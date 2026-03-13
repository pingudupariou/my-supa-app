import { useState } from 'react';
import { Task } from '@/hooks/useTasksData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Calendar, User, Flag, Trash2, ChevronRight, Clock, CheckCircle2, Circle, ArrowRight, History, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { TaskHistory } from '@/hooks/useTasksData';

interface TaskManagerProps {
  tasks: Task[];
  history: TaskHistory[];
  users: { id: string; email: string; display_name: string }[];
  customers?: { id: string; company_name: string }[];
  currentUserId?: string;
  onCreateTask: (task: Partial<Task>) => Promise<void>;
  onUpdateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
  getTaskHistory: (taskId: string) => TaskHistory[];
  defaultCustomerId?: string;
  defaultMeetingId?: string;
  defaultContext?: string;
  compact?: boolean;
}

const statusConfig = {
  todo: { label: 'À faire', color: 'bg-muted text-muted-foreground', icon: Circle },
  in_progress: { label: 'En cours', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', icon: Clock },
  done: { label: 'Terminé', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', icon: CheckCircle2 },
};

const priorityConfig = {
  haute: { label: 'Haute', color: 'bg-destructive/10 text-destructive' },
  moyenne: { label: 'Moyenne', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  basse: { label: 'Basse', color: 'bg-muted text-muted-foreground' },
};

export function TaskManager({
  tasks, history, users, customers, currentUserId, onCreateTask, onUpdateTask, onDeleteTask,
  getTaskHistory, defaultCustomerId, defaultMeetingId, defaultContext, compact,
}: TaskManagerProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [historyTaskId, setHistoryTaskId] = useState<string | null>(null);
  const [newTask, setNewTask] = useState({
    title: '', description: '', priority: 'moyenne' as string,
    assigned_to: '', customer_id: defaultCustomerId || '', due_date: '',
  });
  const [filter, setFilter] = useState<'all' | 'todo' | 'in_progress' | 'done'>('all');
  const [search, setSearch] = useState('');

  const handleCreate = async () => {
    await onCreateTask({
      title: newTask.title,
      description: newTask.description,
      priority: newTask.priority as any,
      assigned_to: newTask.assigned_to || null,
      customer_id: newTask.customer_id || defaultCustomerId || null,
      meeting_id: defaultMeetingId || null,
      context: defaultContext || 'global',
      due_date: newTask.due_date || null,
    });
    setNewTask({ title: '', description: '', priority: 'moyenne', assigned_to: '', customer_id: defaultCustomerId || '', due_date: '' });
    setCreateOpen(false);
  };

  const cycleStatus = (task: Task) => {
    const next = task.status === 'todo' ? 'in_progress' : task.status === 'in_progress' ? 'done' : 'todo';
    onUpdateTask(task.id, { status: next });
  };

  const filtered = tasks
    .filter(t => filter === 'all' || t.status === filter)
    .filter(t => !search || t.title.toLowerCase().includes(search.toLowerCase()));

  const getUserName = (id: string | null) => {
    if (!id) return '—';
    const u = users.find(u => u.id === id);
    return u?.display_name || u?.email?.split('@')[0] || '?';
  };

  const getCustomerName = (id: string | null) => {
    if (!id || !customers) return null;
    return customers.find(c => c.id === id)?.company_name;
  };

  const taskHistoryEntries = historyTaskId ? getTaskHistory(historyTaskId) : [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Rechercher..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-48"
          />
          <div className="flex gap-1">
            {(['all', 'todo', 'in_progress', 'done'] as const).map(s => (
              <Button
                key={s}
                variant={filter === s ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter(s)}
              >
                {s === 'all' ? 'Tout' : statusConfig[s].label}
                <span className="ml-1 text-xs opacity-70">
                  ({s === 'all' ? tasks.length : tasks.filter(t => t.status === s).length})
                </span>
              </Button>
            ))}
          </div>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nouvelle tâche</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Créer une tâche</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Titre *" value={newTask.title} onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))} />
              <Textarea placeholder="Description" value={newTask.description} onChange={e => setNewTask(p => ({ ...p, description: e.target.value }))} rows={2} />
              <div className="grid grid-cols-2 gap-2">
                <Select value={newTask.priority} onValueChange={v => setNewTask(p => ({ ...p, priority: v }))}>
                  <SelectTrigger><SelectValue placeholder="Priorité" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="haute">🔴 Haute</SelectItem>
                    <SelectItem value="moyenne">🟡 Moyenne</SelectItem>
                    <SelectItem value="basse">🟢 Basse</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="date" value={newTask.due_date} onChange={e => setNewTask(p => ({ ...p, due_date: e.target.value }))} />
              </div>
              <Select value={newTask.assigned_to} onValueChange={v => setNewTask(p => ({ ...p, assigned_to: v }))}>
                <SelectTrigger><SelectValue placeholder="Assigner à..." /></SelectTrigger>
                <SelectContent>
                  {users.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.display_name || u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {customers && customers.length > 0 && !defaultCustomerId && (
                <Select value={newTask.customer_id || 'none'} onValueChange={v => setNewTask(p => ({ ...p, customer_id: v === 'none' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="Client (optionnel)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {customers.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button onClick={handleCreate} disabled={!newTask.title.trim()} className="w-full">Créer</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Kanban view */}
      {!compact ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(['todo', 'in_progress', 'done'] as const).map(status => {
            const cfg = statusConfig[status];
            const Icon = cfg.icon;
            const statusTasks = tasks
              .filter(t => t.status === status)
              .filter(t => !search || t.title.toLowerCase().includes(search.toLowerCase()));
            return (
              <div key={status} className="space-y-2">
                <div className="flex items-center gap-2 px-2 py-1.5">
                  <Icon className="h-4 w-4" />
                  <span className="font-semibold text-sm">{cfg.label}</span>
                  <Badge variant="secondary" className="ml-auto text-xs">{statusTasks.length}</Badge>
                </div>
                <div className="space-y-2 min-h-[100px]">
                  {statusTasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      getUserName={getUserName}
                      getCustomerName={getCustomerName}
                      onCycleStatus={() => cycleStatus(task)}
                      onUpdate={(u) => onUpdateTask(task.id, u)}
                      onDelete={() => onDeleteTask(task.id)}
                      onShowHistory={() => setHistoryTaskId(task.id)}
                      users={users}
                      canEdit={currentUserId === task.user_id}
                      canChangeStatus={currentUserId === task.user_id || currentUserId === task.assigned_to}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Compact list view */
        <div className="space-y-1.5">
          {filtered.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              getUserName={getUserName}
              getCustomerName={getCustomerName}
              onCycleStatus={() => cycleStatus(task)}
              onUpdate={(u) => onUpdateTask(task.id, u)}
              onDelete={() => onDeleteTask(task.id)}
              onShowHistory={() => setHistoryTaskId(task.id)}
              users={users}
              canEdit={currentUserId === task.user_id}
              canChangeStatus={currentUserId === task.user_id || currentUserId === task.assigned_to}
              compact
            />
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">Aucune tâche</p>
          )}
        </div>
      )}

      {/* History dialog */}
      <Dialog open={!!historyTaskId} onOpenChange={() => setHistoryTaskId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><History className="h-4 w-4" /> Historique</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {taskHistoryEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun historique</p>
            ) : taskHistoryEntries.map(h => (
              <div key={h.id} className="flex items-start gap-2 text-sm border-b pb-2">
                <div className="text-xs text-muted-foreground whitespace-nowrap pt-0.5">
                  {format(new Date(h.created_at), 'dd/MM HH:mm', { locale: fr })}
                </div>
                <div>
                  <span className="font-medium">{getUserName(h.user_id)}</span>
                  <span className="text-muted-foreground ml-1">— {h.details || h.action}</span>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TaskCard({
  task, getUserName, getCustomerName, onCycleStatus, onUpdate, onDelete, onShowHistory, users, canEdit, canChangeStatus, compact,
}: {
  task: Task;
  getUserName: (id: string | null) => string;
  getCustomerName: (id: string | null) => string | null | undefined;
  onCycleStatus: () => void;
  onUpdate: (u: Partial<Task>) => void;
  onDelete: () => void;
  onShowHistory: () => void;
  users: { id: string; email: string; display_name: string }[];
  canEdit?: boolean;
  canChangeStatus?: boolean;
  compact?: boolean;
}) {
  const stCfg = statusConfig[task.status];
  const prCfg = priorityConfig[task.priority] || priorityConfig.moyenne;
  const StatusIcon = stCfg.icon;
  const customerName = getCustomerName(task.customer_id);
  const isOverdue = task.due_date && task.status !== 'done' && task.due_date < new Date().toISOString().slice(0, 10);

  if (compact) {
    return (
      <div className={`flex items-center gap-2 p-2 rounded-lg border ${isOverdue ? 'border-destructive/50 bg-destructive/5' : ''}`}>
        <button onClick={canChangeStatus ? onCycleStatus : undefined} className={`shrink-0 ${!canChangeStatus ? 'cursor-default opacity-50' : ''}`} disabled={!canChangeStatus}>
          <StatusIcon className={`h-4 w-4 ${task.status === 'done' ? 'text-green-600' : task.status === 'in_progress' ? 'text-blue-600' : 'text-muted-foreground'}`} />
        </button>
        <span className={`text-sm flex-1 ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>{task.title}</span>
        {customerName && <Badge variant="outline" className="text-[10px]"><Building2 className="h-3 w-3 mr-0.5" />{customerName}</Badge>}
        <Badge className={`text-[10px] ${prCfg.color}`}>{prCfg.label}</Badge>
        {task.assigned_to && <span className="text-xs text-muted-foreground"><User className="h-3 w-3 inline mr-0.5" />→ {getUserName(task.assigned_to)}</span>}
        {task.user_id && <span className="text-xs text-muted-foreground opacity-70">par {getUserName(task.user_id)}</span>}
        {task.due_date && <span className={`text-xs ${isOverdue ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>{format(new Date(task.due_date), 'dd/MM')}</span>}
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onShowHistory}><History className="h-3 w-3" /></Button>
        {canEdit && <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={onDelete}><Trash2 className="h-3 w-3" /></Button>}
      </div>
    );
  }

  return (
    <Card className={`${isOverdue ? 'border-destructive/50' : ''}`}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 flex-1">
            <button onClick={canChangeStatus ? onCycleStatus : undefined} className={`mt-0.5 shrink-0 ${!canChangeStatus ? 'cursor-default opacity-50' : ''}`} disabled={!canChangeStatus}>
              <StatusIcon className={`h-4 w-4 ${task.status === 'done' ? 'text-green-600' : task.status === 'in_progress' ? 'text-blue-600' : 'text-muted-foreground'}`} />
            </button>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>{task.title}</p>
              {task.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>}
            </div>
          </div>
          <div className="flex gap-0.5 shrink-0">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onShowHistory}><History className="h-3 w-3" /></Button>
            {canEdit && <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={onDelete}><Trash2 className="h-3 w-3" /></Button>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge className={`text-[10px] ${prCfg.color}`}>
            <Flag className="h-3 w-3 mr-0.5" />{prCfg.label}
          </Badge>
          {customerName && (
            <Badge variant="outline" className="text-[10px]">
              <Building2 className="h-3 w-3 mr-0.5" />{customerName}
            </Badge>
          )}
          <Badge variant="secondary" className="text-[10px]">
            <ArrowRight className="h-3 w-3 mr-0.5" />{task.assigned_to ? getUserName(task.assigned_to) : 'Non assigné'}
          </Badge>
          <Badge variant="outline" className="text-[10px] opacity-70">
            <User className="h-3 w-3 mr-0.5" />par {getUserName(task.user_id)}
          </Badge>
          {task.due_date && (
            <Badge variant={isOverdue ? 'destructive' : 'outline'} className="text-[10px]">
              <Calendar className="h-3 w-3 mr-0.5" />
              {format(new Date(task.due_date), 'dd MMM', { locale: fr })}
            </Badge>
          )}
        </div>
        {/* Quick actions */}
        {(canEdit || canChangeStatus) && (
          <div className="flex gap-1 pt-1">
            {canChangeStatus && (
              <Select value={task.status} onValueChange={v => onUpdate({ status: v as any })}>
                <SelectTrigger className="h-6 text-[10px] w-auto"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">À faire</SelectItem>
                  <SelectItem value="in_progress">En cours</SelectItem>
                  <SelectItem value="done">Terminé</SelectItem>
                </SelectContent>
              </Select>
            )}
            {canEdit && (
              <Select value={task.assigned_to || 'none'} onValueChange={v => onUpdate({ assigned_to: v === 'none' ? null : v })}>
                <SelectTrigger className="h-6 text-[10px] w-auto"><SelectValue placeholder="Assigner" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Non assigné</SelectItem>
                  {users.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.display_name || u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
