import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useMeetingsData, Meeting, MeetingTask } from '@/hooks/useMeetingsData';
import { Plus, Trash2, CalendarDays, FileText, ChevronLeft, X } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';

export function MeetingManager() {
  const {
    meetings, loading, createMeeting, updateMeeting, deleteMeeting,
    createTask, updateTask, deleteTask, getTasksForMeeting,
  } = useMeetingsData();

  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newTitle, setNewTitle] = useState('');
  const [newTaskText, setNewTaskText] = useState('');
  const [editingContent, setEditingContent] = useState(false);
  const [contentDraft, setContentDraft] = useState('');

  const selectedMeeting = meetings.find(m => m.id === selectedMeetingId);
  const selectedTasks = selectedMeetingId ? getTasksForMeeting(selectedMeetingId) : [];

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    await createMeeting({ meeting_date: newDate, title: newTitle });
    setNewTitle('');
    setNewDate(new Date().toISOString().split('T')[0]);
    setShowNewDialog(false);
  };

  const handleAddTask = async () => {
    if (!selectedMeetingId || !newTaskText.trim()) return;
    await createTask(selectedMeetingId, newTaskText.trim());
    setNewTaskText('');
  };

  const startEditContent = () => {
    if (!selectedMeeting) return;
    setContentDraft(selectedMeeting.content);
    setEditingContent(true);
  };

  const saveContent = async () => {
    if (!selectedMeetingId) return;
    await updateMeeting(selectedMeetingId, { content: contentDraft });
    setEditingContent(false);
  };

  if (loading) return <div className="text-muted-foreground text-center py-8">Chargement…</div>;

  return (
    <div className="flex gap-4 h-[calc(100vh-320px)] min-h-[500px]">
      {/* Left sidebar - meeting list */}
      <Card className="w-64 shrink-0 flex flex-col">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Réunions</CardTitle>
            <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="h-7 text-xs">
                  <Plus className="h-3 w-3 mr-1" /> Nouveau
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nouvelle réunion BE</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Date</Label>
                    <Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} />
                  </div>
                  <div>
                    <Label>Titre / Objet</Label>
                    <Input
                      placeholder="Ex: Réunion BE hebdomadaire"
                      value={newTitle}
                      onChange={e => setNewTitle(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleCreate()}
                    />
                  </div>
                  <Button onClick={handleCreate} disabled={!newTitle.trim()} className="w-full">
                    Créer la réunion
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto p-2 space-y-1">
          {meetings.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">Aucune réunion</p>
          )}
          {meetings.map(m => {
            const isActive = m.id === selectedMeetingId;
            const taskCount = getTasksForMeeting(m.id).length;
            const doneCount = getTasksForMeeting(m.id).filter(t => t.is_completed).length;
            return (
              <button
                key={m.id}
                onClick={() => setSelectedMeetingId(m.id)}
                className={`w-full text-left rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                }`}
              >
                <div className="font-medium truncate">
                  {format(new Date(m.meeting_date), 'dd/MM/yyyy')}
                </div>
                <div className={`text-xs truncate ${isActive ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                  {m.title || 'Sans titre'}
                </div>
                {taskCount > 0 && (
                  <div className={`text-xs mt-0.5 ${isActive ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                    ✓ {doneCount}/{taskCount} tâches
                  </div>
                )}
              </button>
            );
          })}
        </CardContent>
      </Card>

      {/* Right panel - meeting detail */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        {!selectedMeeting ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center space-y-2">
              <CalendarDays className="h-12 w-12 mx-auto opacity-30" />
              <p>Sélectionnez une réunion ou créez-en une nouvelle</p>
            </div>
          </div>
        ) : (
          <>
            <CardHeader className="pb-2 shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-primary" />
                    {format(new Date(selectedMeeting.meeting_date), "EEEE d MMMM yyyy", { locale: fr })}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">{selectedMeeting.title}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={async () => {
                    if (confirm('Supprimer cette réunion et toutes ses tâches ?')) {
                      await deleteMeeting(selectedMeeting.id);
                      setSelectedMeetingId(null);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto space-y-4">
              {/* Content / CR */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold flex items-center gap-1.5">
                    <FileText className="h-4 w-4" /> Compte-rendu
                  </h3>
                  {!editingContent && (
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={startEditContent}>
                      Modifier
                    </Button>
                  )}
                </div>
                {editingContent ? (
                  <div className="space-y-2">
                    <Textarea
                      value={contentDraft}
                      onChange={e => setContentDraft(e.target.value)}
                      rows={10}
                      placeholder="Rédigez le compte-rendu de la réunion…"
                      className="text-sm"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveContent}>Enregistrer</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingContent(false)}>Annuler</Button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-muted/50 rounded-md p-3 min-h-[60px] text-sm whitespace-pre-wrap">
                    {selectedMeeting.content || <span className="text-muted-foreground italic">Aucun compte-rendu rédigé</span>}
                  </div>
                )}
              </div>

              <Separator />

              {/* Tasks */}
              <div>
                <h3 className="text-sm font-semibold mb-2">À faire :</h3>
                <div className="space-y-1.5">
                  {selectedTasks.map(task => (
                    <div key={task.id} className="flex items-start gap-2 group">
                      <Checkbox
                        checked={task.is_completed}
                        onCheckedChange={(checked) =>
                          updateTask(task.id, { is_completed: !!checked })
                        }
                        className="mt-0.5"
                      />
                      <span className={`text-sm flex-1 ${task.is_completed ? 'line-through text-muted-foreground' : ''}`}>
                        {task.description}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive"
                        onClick={() => deleteTask(task.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-3">
                  <Input
                    placeholder="Nouvelle tâche…"
                    value={newTaskText}
                    onChange={e => setNewTaskText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddTask()}
                    className="text-sm"
                  />
                  <Button size="sm" onClick={handleAddTask} disabled={!newTaskText.trim()}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
