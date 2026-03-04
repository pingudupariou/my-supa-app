import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Calendar, MapPin, Clock, Users, CheckCircle2, XCircle, Trash2 } from 'lucide-react';
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

const emptyForm = () => ({
  title: '', meeting_date: new Date().toISOString().slice(0, 16), duration_minutes: 60,
  location: '', participants: '', notes: '', action_items: '', responsible: '', status: 'planned',
});

export function CrmMeetingManager({ meetings, customerId, onCreate, onUpdate, onDelete }: CrmMeetingManagerProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!form.title.trim()) return;
    await onCreate({ customer_id: customerId, ...form, duration_minutes: Number(form.duration_minutes) || 60 });
    setShowAdd(false);
    setForm(emptyForm());
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-sm flex items-center gap-1.5">
          <Calendar className="h-4 w-4" /> RDV & Réunions ({meetings.length})
        </h4>
        <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Planifier
        </Button>
      </div>

      {meetings.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun RDV enregistré.</p>
      ) : (
        <div className="space-y-2">
          {meetings.map(m => {
            const st = STATUS_MAP[m.status] || STATUS_MAP.planned;
            const isExpanded = expandedId === m.id;
            return (
              <div key={m.id} className={cn("p-3 rounded-lg border transition-colors", m.status === 'completed' ? 'bg-muted/20' : 'bg-background')}>
                <div className="flex items-start justify-between cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : m.id)}>
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
                  <div className="mt-3 pt-3 border-t space-y-2 text-sm">
                    {m.participants && <div><span className="text-muted-foreground"><Users className="h-3 w-3 inline mr-1" />Participants:</span> {m.participants}</div>}
                    {m.responsible && <div><span className="text-muted-foreground">Responsable:</span> {m.responsible}</div>}
                    {m.notes && <div className="p-2 rounded bg-muted/30"><span className="text-muted-foreground font-medium text-xs">Notes:</span><p className="whitespace-pre-wrap text-xs mt-1">{m.notes}</p></div>}
                    {m.action_items && <div className="p-2 rounded bg-primary/5"><span className="text-xs font-medium">Actions à suivre:</span><p className="whitespace-pre-wrap text-xs mt-1">{m.action_items}</p></div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Planifier un RDV</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Input placeholder="Titre du RDV *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            <div className="grid grid-cols-2 gap-3">
              <Input type="datetime-local" value={form.meeting_date} onChange={e => setForm(f => ({ ...f, meeting_date: e.target.value }))} />
              <Input type="number" placeholder="Durée (min)" value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: Number(e.target.value) }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Lieu" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
              <Input placeholder="Responsable" value={form.responsible} onChange={e => setForm(f => ({ ...f, responsible: e.target.value }))} />
            </div>
            <Input placeholder="Participants (séparés par des virgules)" value={form.participants} onChange={e => setForm(f => ({ ...f, participants: e.target.value }))} />
            <Textarea placeholder="Notes / Compte-rendu" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} />
            <Textarea placeholder="Actions à suivre" value={form.action_items} onChange={e => setForm(f => ({ ...f, action_items: e.target.value }))} rows={2} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={!form.title.trim()}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
