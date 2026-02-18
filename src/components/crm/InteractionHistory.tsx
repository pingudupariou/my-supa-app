import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Phone, Mail, Calendar, FileText } from 'lucide-react';
import { CustomerInteraction } from '@/hooks/useCRMData';

const TYPE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  call: { label: 'Appel', icon: Phone, color: 'bg-blue-500/10 text-blue-700' },
  email: { label: 'Email', icon: Mail, color: 'bg-green-500/10 text-green-700' },
  meeting: { label: 'RDV', icon: Calendar, color: 'bg-purple-500/10 text-purple-700' },
  note: { label: 'Note', icon: FileText, color: 'bg-amber-500/10 text-amber-700' },
};

interface InteractionHistoryProps {
  interactions: CustomerInteraction[];
  customerId: string;
  onCreate: (interaction: { customer_id: string; interaction_type: string; subject: string; content?: string; interaction_date?: string }) => Promise<any>;
}

export function InteractionHistory({ interactions, customerId, onCreate }: InteractionHistoryProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ interaction_type: 'note', subject: '', content: '', interaction_date: new Date().toISOString().slice(0, 16) });

  const handleCreate = async () => {
    if (!form.subject.trim()) return;
    await onCreate({
      customer_id: customerId,
      interaction_type: form.interaction_type,
      subject: form.subject,
      content: form.content || undefined,
      interaction_date: form.interaction_date || undefined,
    });
    setShowAdd(false);
    setForm({ interaction_type: 'note', subject: '', content: '', interaction_date: new Date().toISOString().slice(0, 16) });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-sm">Historique des interactions</h4>
        <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter
        </Button>
      </div>

      {interactions.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune interaction enregistrée.</p>
      ) : (
        <div className="relative space-y-0">
          {/* Timeline line */}
          <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />
          {interactions.map(int => {
            const cfg = TYPE_CONFIG[int.interaction_type] || TYPE_CONFIG.note;
            const Icon = cfg.icon;
            return (
              <div key={int.id} className="relative flex gap-3 py-2">
                <div className={`z-10 flex items-center justify-center h-8 w-8 rounded-full ${cfg.color} shrink-0`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{int.subject}</span>
                    <Badge variant="outline" className="text-[10px] shrink-0">{cfg.label}</Badge>
                  </div>
                  {int.content && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{int.content}</p>}
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(int.interaction_date).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle interaction</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Select value={form.interaction_type} onValueChange={v => setForm(f => ({ ...f, interaction_type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="call">Appel</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="meeting">RDV</SelectItem>
                <SelectItem value="note">Note</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Sujet *" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
            <Textarea placeholder="Commentaire" value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} rows={3} />
            <Input type="datetime-local" value={form.interaction_date} onChange={e => setForm(f => ({ ...f, interaction_date: e.target.value }))} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={!form.subject.trim()}>Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
