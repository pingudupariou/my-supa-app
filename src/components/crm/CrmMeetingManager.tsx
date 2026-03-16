import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Calendar, MapPin, Clock, Users, CheckCircle2, XCircle, Trash2, Save, ChevronUp, RotateCcw, Archive, AlertTriangle } from 'lucide-react';
import { CrmMeeting } from '@/hooks/useCRMData';
import { cn } from '@/lib/utils';

interface CrmMeetingManagerProps {
  meetings: CrmMeeting[];
  customerId: string;
  onCreate: (meeting: any) => Promise<any>;
  onUpdate: (id: string, updates: any) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onRestore?: (id: string) => Promise<boolean>;
  onPermanentDelete?: (id: string) => Promise<boolean>;
  getTrashedMeetings?: () => Promise<CrmMeeting[]>;
  isAdmin?: boolean;
}

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  planned: { label: 'Planifié', variant: 'outline' },
  completed: { label: 'Réalisé', variant: 'default' },
  cancelled: { label: 'Annulé', variant: 'destructive' },
};

export function CrmMeetingManager({ meetings, customerId, onCreate, onUpdate, onDelete, onRestore, onPermanentDelete, getTrashedMeetings, isAdmin }: CrmMeetingManagerProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [trashedMeetings, setTrashedMeetings] = useState<CrmMeeting[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 16));
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editDrafts, setEditDrafts] = useState<Record<string, { title: string; notes: string; action_items: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    await onCreate({ customer_id: customerId, title: newTitle, meeting_date: newDate, status: 'planned', duration_minutes: 60 });
    setNewTitle('');
    setNewDate(new Date().toISOString().slice(0, 16));
    setShowAdd(false);
  };

  const handleExpand = (id: string, meeting: CrmMeeting) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!editDrafts[id]) {
      setEditDrafts(d => ({ ...d, [id]: { title: meeting.title || '', notes: meeting.notes || '', action_items: meeting.action_items || '' } }));
    }
  };

  const updateDraft = (id: string, field: 'title' | 'notes' | 'action_items', value: string) => {
    setEditDrafts(d => ({ ...d, [id]: { ...d[id], [field]: value } }));
  };

  const saveDraft = async (id: string) => {
    const draft = editDrafts[id];
    if (!draft) return;
    setSavingId(id);
    await onUpdate(id, { title: draft.title, notes: draft.notes, action_items: draft.action_items });
    setSavingId(null);
  };

  const loadTrash = async () => {
    if (!getTrashedMeetings) return;
    const trashed = await getTrashedMeetings();
    // Filter by customerId
    setTrashedMeetings(trashed.filter(m => m.customer_id === customerId));
  };

  const toggleTrash = async () => {
    if (!showTrash) await loadTrash();
    setShowTrash(!showTrash);
  };

  const handleRestore = async (id: string) => {
    if (!onRestore) return;
    await onRestore(id);
    setTrashedMeetings(prev => prev.filter(m => m.id !== id));
  };

  const handlePermanentDelete = async (id: string) => {
    if (!onPermanentDelete) return;
    await onPermanentDelete(id);
    setTrashedMeetings(prev => prev.filter(m => m.id !== id));
    setConfirmDeleteId(null);
  };

  const meetingToDelete = trashedMeetings.find(m => m.id === confirmDeleteId);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-sm flex items-center gap-1.5">
          <Calendar className="h-4 w-4" /> RDV & Réunions ({meetings.length})
        </h4>
        <div className="flex items-center gap-1">
          {getTrashedMeetings && (
            <Button size="sm" variant="ghost" onClick={toggleTrash} className={cn("h-7 text-xs", showTrash && 'bg-muted')}>
              <Archive className="h-3.5 w-3.5 mr-1" /> Corbeille
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setShowAdd(!showAdd)}>
            {showAdd ? <ChevronUp className="h-3.5 w-3.5 mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
            {showAdd ? 'Fermer' : 'Planifier'}
          </Button>
        </div>
      </div>

      {/* Inline quick form */}
      {showAdd && (
        <div className="mb-3 p-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 space-y-2">
          <Input
            placeholder="Titre du RDV *"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            autoFocus
            className="text-sm"
          />
          <div className="flex items-center gap-2">
            <Input
              type="datetime-local"
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
              className="text-sm flex-1"
            />
            <Button size="sm" onClick={handleCreate} disabled={!newTitle.trim()} className="shrink-0">
              <Plus className="h-3.5 w-3.5 mr-1" /> Créer
            </Button>
          </div>
        </div>
      )}

      {/* Trash view */}
      {showTrash && (
        <div className="mb-3 p-3 rounded-lg border border-dashed border-destructive/30 bg-destructive/5 space-y-2">
          <h5 className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Archive className="h-3 w-3" /> RDV supprimés
          </h5>
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
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleRestore(m.id)}>
                    <RotateCcw className="h-3 w-3 mr-1" /> Restaurer
                  </Button>
                  {isAdmin && (
                    <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => setConfirmDeleteId(m.id)}>
                      <Trash2 className="h-3 w-3 mr-1" /> Supprimer
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
          {!isAdmin && trashedMeetings.length > 0 && (
            <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
              <AlertTriangle className="h-3 w-3" />
              Seul un administrateur peut supprimer définitivement un RDV.
            </p>
          )}
        </div>
      )}

      {meetings.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun RDV enregistré.</p>
      ) : (
        <div className="space-y-2">
          {meetings.map(m => {
            const st = STATUS_MAP[m.status] || STATUS_MAP.planned;
            const isExpanded = expandedId === m.id;
            const draft = editDrafts[m.id];
            const hasChanges = draft && (draft.title !== (m.title || '') || draft.notes !== (m.notes || '') || draft.action_items !== (m.action_items || ''));
            return (
              <div key={m.id} className={cn(
                "p-3 rounded-lg border transition-colors",
                m.status === 'completed' ? 'bg-muted/20' : m.status === 'cancelled' ? 'bg-destructive/5' : 'bg-background'
              )}>
                <div className="flex items-start justify-between cursor-pointer" onClick={() => handleExpand(m.id, m)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{m.title}</span>
                      <Badge variant={st.variant} className="text-[10px]">{st.label}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(m.meeting_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      {m.duration_minutes && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{m.duration_minutes}min</span>}
                      {m.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{m.location}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Status change buttons based on current status */}
                    {m.status === 'planned' && (
                      <>
                        <Button size="icon" variant="ghost" className="h-7 w-7" title="Marquer réalisé" onClick={e => { e.stopPropagation(); onUpdate(m.id, { status: 'completed' }); }}>
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" title="Annuler" onClick={e => { e.stopPropagation(); onUpdate(m.id, { status: 'cancelled' }); }}>
                          <XCircle className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </>
                    )}
                    {m.status === 'completed' && (
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="Remettre en planifié" onClick={e => { e.stopPropagation(); onUpdate(m.id, { status: 'planned' }); }}>
                        <RotateCcw className="h-3.5 w-3.5 text-primary" />
                      </Button>
                    )}
                    {m.status === 'cancelled' && (
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="Replanifier" onClick={e => { e.stopPropagation(); onUpdate(m.id, { status: 'planned' }); }}>
                        <RotateCcw className="h-3.5 w-3.5 text-primary" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-7 w-7" title="Supprimer" onClick={e => { e.stopPropagation(); onDelete(m.id); }}>
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t space-y-3 text-sm" onClick={e => e.stopPropagation()}>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Titre</label>
                      <Input
                        value={draft?.title ?? m.title ?? ''}
                        onChange={e => updateDraft(m.id, 'title', e.target.value)}
                        placeholder="Titre du RDV"
                        className="text-sm"
                      />
                    </div>

                    {/* Status selector */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Statut</label>
                      <Select value={m.status} onValueChange={v => onUpdate(m.id, { status: v })}>
                        <SelectTrigger className="text-sm h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="planned">📅 Planifié</SelectItem>
                          <SelectItem value="completed">✅ Réalisé</SelectItem>
                          <SelectItem value="cancelled">❌ Annulé</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {m.participants && <div><span className="text-muted-foreground"><Users className="h-3 w-3 inline mr-1" />Participants:</span> {m.participants}</div>}
                    {m.responsible && <div><span className="text-muted-foreground">Responsable:</span> {m.responsible}</div>}
                    
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes / Compte-rendu</label>
                      <Textarea
                        value={draft?.notes ?? m.notes ?? ''}
                        onChange={e => updateDraft(m.id, 'notes', e.target.value)}
                        placeholder="Écrire les notes ici…"
                        rows={3}
                        className="text-xs resize-y"
                      />
                    </div>
                    
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Actions à suivre</label>
                      <Textarea
                        value={draft?.action_items ?? m.action_items ?? ''}
                        onChange={e => updateDraft(m.id, 'action_items', e.target.value)}
                        placeholder="Lister les actions…"
                        rows={2}
                        className="text-xs resize-y"
                      />
                    </div>

                    {hasChanges && (
                      <div className="flex justify-end">
                        <Button size="sm" onClick={() => saveDraft(m.id)} disabled={savingId === m.id} className="h-7 text-xs">
                          <Save className="h-3 w-3 mr-1" />
                          {savingId === m.id ? 'Enregistrement…' : 'Enregistrer'}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!confirmDeleteId} onOpenChange={open => !open && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suppression définitive</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer définitivement le RDV <strong>{meetingToDelete?.title}</strong> ?
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDeleteId && handlePermanentDelete(confirmDeleteId)}
            >
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
