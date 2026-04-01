import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InteractionHistory } from './InteractionHistory';
import { CrmMeetingManager } from './CrmMeetingManager';
import { CrmReminderManager } from './CrmReminderManager';
import { B2BClient } from '@/hooks/useB2BClientsData';
import { CustomerInteraction, CustomerOpportunity, CrmMeeting, CrmReminder, PIPELINE_STAGES } from '@/hooks/useCRMData';
import { Mail, Phone, Globe, FileText, Calendar, Bell, MessageSquare, Building2, ClipboardList, CheckCircle2, Clock, AlertCircle, StickyNote, Plus, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Inline calendar recap component — shows all meetings with status, edit, delete/trash
function ClientCalendarRecap({
  meetings,
  customerId,
  onUpdateMeeting,
  onDeleteMeeting,
  onRestoreMeeting,
  onPermanentDeleteMeeting,
  getTrashedMeetings,
  isAdmin,
}: {
  meetings: CrmMeeting[];
  customerId: string;
  onUpdateMeeting: (id: string, updates: any) => Promise<boolean>;
  onDeleteMeeting: (id: string) => Promise<boolean>;
  onRestoreMeeting?: (id: string) => Promise<boolean>;
  onPermanentDeleteMeeting?: (id: string) => Promise<boolean>;
  getTrashedMeetings?: () => Promise<CrmMeeting[]>;
  isAdmin?: boolean;
}) {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showTrash, setShowTrash] = useState(false);
  const [trashedMeetings, setTrashedMeetings] = useState<CrmMeeting[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filtered = meetings
    .filter(m => statusFilter === 'all' || m.status === statusFilter)
    .sort((a, b) => new Date(b.meeting_date).getTime() - new Date(a.meeting_date).getTime());

  const plannedCount = meetings.filter(m => m.status === 'planned').length;
  const completedCount = meetings.filter(m => m.status === 'completed').length;
  const cancelledCount = meetings.filter(m => m.status === 'cancelled').length;

  const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; dot: string }> = {
    planned: { label: 'Planifié', variant: 'outline', dot: 'bg-blue-500' },
    completed: { label: 'Réalisé', variant: 'default', dot: 'bg-emerald-500' },
    cancelled: { label: 'Annulé', variant: 'destructive', dot: 'bg-destructive' },
  };

  const loadTrash = async () => {
    if (!getTrashedMeetings) return;
    const all = await getTrashedMeetings();
    setTrashedMeetings(all.filter(m => m.customer_id === customerId));
  };

  const toggleTrash = async () => {
    if (!showTrash) await loadTrash();
    setShowTrash(!showTrash);
  };

  const handleRestore = async (id: string) => {
    if (!onRestoreMeeting) return;
    await onRestoreMeeting(id);
    setTrashedMeetings(prev => prev.filter(m => m.id !== id));
  };

  const handlePermanentDelete = async () => {
    if (!confirmDeleteId || !onPermanentDeleteMeeting) return;
    await onPermanentDeleteMeeting(confirmDeleteId);
    setTrashedMeetings(prev => prev.filter(m => m.id !== confirmDeleteId));
    setConfirmDeleteId(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h4 className="font-medium text-sm flex items-center gap-1.5">
          <Calendar className="h-4 w-4" /> Calendrier ({meetings.length})
        </h4>
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Filter badges */}
          <Badge variant={statusFilter === 'all' ? 'default' : 'outline'} className="text-[10px] cursor-pointer" onClick={() => setStatusFilter('all')}>
            Tous ({meetings.length})
          </Badge>
          <Badge variant={statusFilter === 'planned' ? 'default' : 'outline'} className="text-[10px] cursor-pointer gap-1" onClick={() => setStatusFilter(statusFilter === 'planned' ? 'all' : 'planned')}>
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />Planifiés ({plannedCount})
          </Badge>
          <Badge variant={statusFilter === 'completed' ? 'default' : 'outline'} className="text-[10px] cursor-pointer gap-1" onClick={() => setStatusFilter(statusFilter === 'completed' ? 'all' : 'completed')}>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Réalisés ({completedCount})
          </Badge>
          {cancelledCount > 0 && (
            <Badge variant={statusFilter === 'cancelled' ? 'default' : 'outline'} className="text-[10px] cursor-pointer gap-1" onClick={() => setStatusFilter(statusFilter === 'cancelled' ? 'all' : 'cancelled')}>
              Annulés ({cancelledCount})
            </Badge>
          )}
          {getTrashedMeetings && (
            <Button size="sm" variant="ghost" onClick={toggleTrash} className={cn("h-6 text-[10px] px-2", showTrash && 'bg-muted')}>
              <Trash2 className="h-3 w-3 mr-1" /> Corbeille
            </Button>
          )}
        </div>
      </div>

      {/* Trash section */}
      {showTrash && (
        <div className="p-3 rounded-lg border border-dashed border-destructive/30 bg-destructive/5 space-y-2">
          <h5 className="text-xs font-medium text-muted-foreground">RDV supprimés</h5>
          {trashedMeetings.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aucun RDV en corbeille.</p>
          ) : (
            trashedMeetings.map(m => (
              <div key={m.id} className="flex items-center justify-between p-2 rounded border bg-background">
                <div className="min-w-0">
                  <span className="text-sm font-medium truncate block">{m.title}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(m.meeting_date).toLocaleDateString('fr-FR')}
                    {m.deleted_at && ` • Supprimé le ${new Date(m.deleted_at).toLocaleDateString('fr-FR')}`}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => handleRestore(m.id)}>
                    Restaurer
                  </Button>
                  {isAdmin && (
                    <Button size="sm" variant="destructive" className="h-6 text-[10px]" onClick={() => setConfirmDeleteId(m.id)}>
                      Supprimer
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Meeting list */}
      {filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Calendar className="h-8 w-8 mx-auto mb-2 opacity-20" />
          <p className="text-sm">Aucun RDV</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(m => {
            const st = STATUS_MAP[m.status] || STATUS_MAP.planned;
            const date = new Date(m.meeting_date);
            return (
              <div key={m.id} className={cn(
                "p-3 rounded-lg border transition-colors",
                m.status === 'completed' ? 'bg-muted/20' : m.status === 'cancelled' ? 'bg-destructive/5 opacity-60' : 'bg-background'
              )}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("h-2 w-2 rounded-full shrink-0", st.dot)} />
                      <span className="font-medium text-sm truncate">{m.title}</span>
                      <Badge variant={st.variant} className="text-[10px]">{st.label}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {date.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                        {' '}
                        {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {m.duration_minutes && <span>{m.duration_minutes}min</span>}
                      {m.location && <span>{m.location}</span>}
                    </div>
                    {m.notes && <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 italic">{m.notes}</p>}
                    {m.action_items && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1"><span className="font-medium not-italic">Actions:</span> {m.action_items}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Status change */}
                    <Select value={m.status} onValueChange={v => onUpdateMeeting(m.id, { status: v })}>
                      <SelectTrigger className="h-6 text-[10px] w-[90px] px-1.5"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="planned">📅 Planifié</SelectItem>
                        <SelectItem value="completed">✅ Réalisé</SelectItem>
                        <SelectItem value="cancelled">❌ Annulé</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="icon" variant="ghost" className="h-7 w-7" title="Supprimer" onClick={() => onDeleteMeeting(m.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Permanent delete confirmation */}
      <AlertDialog open={!!confirmDeleteId} onOpenChange={open => !open && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suppression définitive</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handlePermanentDelete}>
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  assigned_to?: string | null;
  assigned_by?: string | null;
  due_date?: string | null;
  customer_id?: string | null;
  context?: string | null;
  created_at: string;
  updated_at: string;
}

interface TeamMember {
  id: string;
  email: string;
}

interface CustomerDetailProps {
  client: B2BClient;
  interactions: CustomerInteraction[];
  opportunities: CustomerOpportunity[];
  meetings: CrmMeeting[];
  reminders: CrmReminder[];
  tasks?: Task[];
  onCreateInteraction: (interaction: any) => Promise<any>;
  onDeleteInteraction?: (id: string) => Promise<boolean>;
  onUpdateInteraction?: (id: string, updates: any) => Promise<boolean>;
  onCreateMeeting: (meeting: any) => Promise<any>;
  onUpdateMeeting: (id: string, updates: any) => Promise<boolean>;
  onDeleteMeeting: (id: string) => Promise<boolean>;
  onRestoreMeeting?: (id: string) => Promise<boolean>;
  onPermanentDeleteMeeting?: (id: string) => Promise<boolean>;
  getTrashedMeetings?: () => Promise<CrmMeeting[]>;
  onCreateReminder: (reminder: any) => Promise<any>;
  onCompleteReminder: (id: string) => Promise<boolean>;
  onUncompleteReminder?: (id: string) => Promise<boolean>;
  onDeleteReminder: (id: string) => Promise<boolean>;
  onCreateTask?: (task: any) => Promise<any>;
  onUpdateTask?: (id: string, updates: any) => Promise<any>;
  users?: TeamMember[];
  isAdmin?: boolean;
  selectedEntityName?: string;
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  haute: { label: 'Haute', color: 'text-red-600 bg-red-50 dark:bg-red-950/30' },
  moyenne: { label: 'Moyenne', color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30' },
  basse: { label: 'Basse', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' },
};

const STATUS_CONFIG: Record<string, { label: string; icon: any }> = {
  todo: { label: 'À faire', icon: Clock },
  in_progress: { label: 'En cours', icon: AlertCircle },
  done: { label: 'Terminé', icon: CheckCircle2 },
};

export function CustomerDetail({
  client, interactions, opportunities, meetings, reminders, tasks = [],
  onCreateInteraction, onDeleteInteraction, onUpdateInteraction, onCreateMeeting, onUpdateMeeting, onDeleteMeeting,
  onRestoreMeeting, onPermanentDeleteMeeting, getTrashedMeetings,
  onCreateReminder, onCompleteReminder, onUncompleteReminder, onDeleteReminder,
  onCreateTask, onUpdateTask, users = [],
  isAdmin, selectedEntityName,
}: CustomerDetailProps) {
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'moyenne', assigned_to: '' });

  const currentStage = opportunities.length > 0
    ? PIPELINE_STAGES.find(s => s.key === opportunities[0].stage)
    : null;

  const pendingReminders = reminders.filter(r => !r.is_completed).length;
  const pendingTasks = tasks.filter(t => t.status !== 'done').length;

  const handleCreateTask = async () => {
    if (!newTask.title.trim() || !onCreateTask) return;
    await onCreateTask({
      title: newTask.title,
      description: newTask.description || undefined,
      priority: newTask.priority,
      assigned_to: newTask.assigned_to || undefined,
    });
    setNewTask({ title: '', description: '', priority: 'moyenne', assigned_to: '' });
    setShowAddTask(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="text-lg">{client.company_name}</span>
          <div className="flex items-center gap-2">
            {selectedEntityName && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <Building2 className="h-3 w-3" />{selectedEntityName}
              </Badge>
            )}
            {pendingReminders > 0 && (
              <Badge variant="destructive" className="text-[10px]">
                <Bell className="h-3 w-3 mr-0.5" />{pendingReminders}
              </Badge>
            )}
            {pendingTasks > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                <ClipboardList className="h-3 w-3 mr-0.5" />{pendingTasks}
              </Badge>
            )}
            {currentStage && <Badge variant="outline">{currentStage.label}</Badge>}
            <Badge variant={client.is_active ? 'default' : 'secondary'}>
              {client.is_active ? 'Actif' : 'Inactif'}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Compact info row */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {client.contact_email && (
            <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{client.contact_email}</span>
          )}
          {client.contact_phone && (
            <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{client.contact_phone}</span>
          )}
          {client.country && (
            <span className="flex items-center gap-1"><Globe className="h-3 w-3" />{client.country}</span>
          )}
          {client.client_type && <span>Type: {client.client_type}</span>}
          {client.payment_terms && <span>Paiement: {client.payment_terms}</span>}
        </div>

        {/* Notes */}
        {client.notes && (
          <div className="p-3 rounded-lg bg-muted/30 border">
            <div className="flex items-center gap-1.5 mb-1">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">Notes client</span>
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{client.notes}</p>
          </div>
        )}

        {/* Main management tabs */}
        <Separator />
        <Tabs defaultValue="meetings" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="meetings" className="flex-1 text-xs">
              <Calendar className="h-3.5 w-3.5 mr-1" />Note RDV ({meetings.length})
            </TabsTrigger>
            <TabsTrigger value="calendrier" className="flex-1 text-xs">
              <MessageSquare className="h-3.5 w-3.5 mr-1" />Calendrier
            </TabsTrigger>
            <TabsTrigger value="tasks" className="flex-1 text-xs">
              <ClipboardList className="h-3.5 w-3.5 mr-1" />Tâches
              {pendingTasks > 0 && (
                <span className="ml-1 text-[10px] bg-primary/10 text-primary px-1.5 rounded-full">{pendingTasks}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="reminders" className="flex-1 text-xs">
              <Bell className="h-3.5 w-3.5 mr-1" />Rappels
              {pendingReminders > 0 && (
                <span className="ml-1 text-[10px] bg-destructive/10 text-destructive px-1.5 rounded-full">{pendingReminders}</span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="meetings" className="mt-3 space-y-6">
            <CrmMeetingManager
              meetings={meetings}
              customerId={client.id}
              onCreate={onCreateMeeting}
              onUpdate={onUpdateMeeting}
              onDelete={onDeleteMeeting}
              onRestore={onRestoreMeeting}
              onPermanentDelete={onPermanentDeleteMeeting}
              getTrashedMeetings={getTrashedMeetings}
              isAdmin={isAdmin}
            />
            <Separator />
            <InteractionHistory
              interactions={interactions}
              customerId={client.id}
              onCreate={onCreateInteraction}
              onDelete={onDeleteInteraction}
              onUpdate={onUpdateInteraction}
            />
          </TabsContent>

          <TabsContent value="calendrier" className="mt-3">
            <ClientCalendarRecap
              meetings={meetings}
              customerId={client.id}
              onUpdateMeeting={onUpdateMeeting}
              onDeleteMeeting={onDeleteMeeting}
              onRestoreMeeting={onRestoreMeeting}
              onPermanentDeleteMeeting={onPermanentDeleteMeeting}
              getTrashedMeetings={getTrashedMeetings}
              isAdmin={isAdmin}
            />
          </TabsContent>

          <TabsContent value="tasks" className="mt-3">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-sm flex items-center gap-1.5">
                  <ClipboardList className="h-4 w-4" /> Tâches client ({tasks.length})
                </h4>
                {onCreateTask && (
                  <Button size="sm" variant="outline" onClick={() => setShowAddTask(!showAddTask)} className="h-7 text-xs">
                    {showAddTask ? 'Fermer' : '+ Ajouter'}
                  </Button>
                )}
              </div>

              {/* Quick add form */}
              {showAddTask && onCreateTask && (
                <div className="mb-4 p-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 space-y-2">
                  <Input
                    placeholder="Titre de la tâche *"
                    value={newTask.title}
                    onChange={e => setNewTask(t => ({ ...t, title: e.target.value }))}
                    className="text-sm"
                    autoFocus
                  />
                  <Textarea
                    placeholder="Description (optionnel)"
                    value={newTask.description}
                    onChange={e => setNewTask(t => ({ ...t, description: e.target.value }))}
                    rows={2}
                    className="text-sm resize-y"
                  />
                  <div className="flex gap-2">
                    <Select value={newTask.priority} onValueChange={v => setNewTask(t => ({ ...t, priority: v }))}>
                      <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="haute">🔴 Haute</SelectItem>
                        <SelectItem value="moyenne">🟡 Moyenne</SelectItem>
                        <SelectItem value="basse">🟢 Basse</SelectItem>
                      </SelectContent>
                    </Select>
                    {users.length > 0 && (
                      <Select value={newTask.assigned_to} onValueChange={v => setNewTask(t => ({ ...t, assigned_to: v }))}>
                        <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Assigner à…" /></SelectTrigger>
                        <SelectContent>
                          {users.map(u => (
                            <SelectItem key={u.id} value={u.id}>{u.email}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Button size="sm" onClick={handleCreateTask} disabled={!newTask.title.trim()} className="h-8 text-xs shrink-0">
                      Créer
                    </Button>
                  </div>
                </div>
              )}

              {/* Tasks list */}
              {tasks.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">Aucune tâche pour ce client</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {[...tasks].sort((a, b) => {
                    if (a.status === 'done' && b.status !== 'done') return 1;
                    if (a.status !== 'done' && b.status === 'done') return -1;
                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                  }).map(task => {
                    const prioCfg = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.moyenne;
                    const statusCfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.todo;
                    const StatusIcon = statusCfg.icon;
                    const isDone = task.status === 'done';
                    const assignedUser = users.find(u => u.id === task.assigned_to);

                    return (
                      <div
                        key={task.id}
                        className={cn(
                          "p-3 rounded-lg border transition-colors",
                          isDone ? 'bg-muted/20 opacity-60' : 'bg-card'
                        )}
                      >
                        <div className="flex items-start gap-2">
                          {/* Status toggle */}
                          {onUpdateTask && (
                            <button
                              className="mt-0.5 shrink-0"
                              onClick={() => onUpdateTask(task.id, {
                                status: isDone ? 'todo' : 'done',
                                ...(isDone ? {} : { completed_at: new Date().toISOString() })
                              })}
                            >
                              <StatusIcon className={cn("h-5 w-5", isDone ? 'text-green-500' : 'text-muted-foreground')} />
                            </button>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={cn("font-medium text-sm", isDone && "line-through")}>{task.title}</span>
                              <Badge variant="outline" className={cn("text-[10px]", prioCfg.color)}>
                                {prioCfg.label}
                              </Badge>
                              <Badge variant="outline" className="text-[10px]">{statusCfg.label}</Badge>
                            </div>
                            {task.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>
                            )}
                            <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                              {assignedUser && <span>→ {assignedUser.email}</span>}
                              {task.due_date && <span>Échéance: {new Date(task.due_date).toLocaleDateString('fr-FR')}</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="reminders" className="mt-3">
            <CrmReminderManager
              reminders={reminders}
              customers={[{ id: client.id, company_name: client.company_name }]}
              customerId={client.id}
              onCreate={onCreateReminder}
              onComplete={onCompleteReminder}
              onUncomplete={onUncompleteReminder}
              onDelete={onDeleteReminder}
            />
          </TabsContent>
        </Tabs>

        {/* Opportunities summary */}
        {opportunities.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="font-medium text-sm mb-2">Opportunités ({opportunities.length})</h4>
              <div className="space-y-1">
                {opportunities.map(opp => {
                  const stage = PIPELINE_STAGES.find(s => s.key === opp.stage);
                  return (
                    <div key={opp.id} className="flex justify-between items-center text-sm p-2 bg-muted/30 rounded">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{stage?.label || opp.stage}</Badge>
                        {opp.contact_name && <span className="text-muted-foreground">{opp.contact_name}</span>}
                      </div>
                      <span className="font-mono text-xs">
                        {(opp.estimated_amount || 0).toLocaleString('fr-FR')} € · {opp.probability}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
