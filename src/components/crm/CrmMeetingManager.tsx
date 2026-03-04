import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Calendar, MapPin, Clock, Users, CheckCircle2, XCircle, Trash2, Save, ChevronDown, ChevronUp } from 'lucide-react';
import { CrmMeeting } from '@/hooks/useCRMData';
import { cn } from '@/lib/utils';

interface CrmMeetingManagerProps {
  meetings: CrmMeeting[];
  customerId: string;
  onCreate: (meeting: any) => Promise<any>;
  onUpdate: (id: string, updates: any) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  planned: { label: 'Planifié', variant: 'outline' },
  completed: { label: 'Réalisé', variant: 'default' },
  cancelled: { label: 'Annulé', variant: 'destructive' },
};

export function CrmMeetingManager({ meetings, customerId, onCreate, onUpdate, onDelete }: CrmMeetingManagerProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 16));
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editDrafts, setEditDrafts] = useState<Record<string, { notes: string; action_items: string }>>({});
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
      setEditDrafts(d => ({ ...d, [id]: { notes: meeting.notes || '', action_items: meeting.action_items || '' } }));
    }
  };

  const updateDraft = (id: string, field: 'notes' | 'action_items', value: string) => {
    setEditDrafts(d => ({ ...d, [id]: { ...d[id], [field]: value } }));
  };

  const saveDraft = async (id: string) => {
    const draft = editDrafts[id];
    if (!draft) return;
    setSavingId(id);
    await onUpdate(id, { notes: draft.notes, action_items: draft.action_items });
    setSavingId(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-sm flex items-center gap-1.5">
          <Calendar className="h-4 w-4" /> RDV & Réunions ({meetings.length})
        </h4>
        <Button size="sm" variant="outline" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? <ChevronUp className="h-3.5 w-3.5 mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
          {showAdd ? 'Fermer' : 'Planifier'}
        </Button>
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

      {meetings.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun RDV enregistré.</p>
      ) : (
        <div className="space-y-2">
          {meetings.map(m => {
            const st = STATUS_MAP[m.status] || STATUS_MAP.planned;
            const isExpanded = expandedId === m.id;
            const draft = editDrafts[m.id];
            const hasChanges = draft && (draft.notes !== (m.notes || '') || draft.action_items !== (m.action_items || ''));
            return (
              <div key={m.id} className={cn("p-3 rounded-lg border transition-colors", m.status === 'completed' ? 'bg-muted/20' : 'bg-background')}>
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
                    {m.status === 'planned' && (
                      <>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={e => { e.stopPropagation(); onUpdate(m.id, { status: 'completed' }); }}>
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={e => { e.stopPropagation(); onUpdate(m.id, { status: 'cancelled' }); }}>
                          <XCircle className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </>
                    )}
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={e => { e.stopPropagation(); onDelete(m.id); }}>
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t space-y-3 text-sm" onClick={e => e.stopPropagation()}>
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
    </div>
  );
}
