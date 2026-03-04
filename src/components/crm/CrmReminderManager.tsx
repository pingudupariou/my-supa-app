import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Bell, CheckCircle2, Trash2, AlertTriangle, User } from 'lucide-react';
import { CrmReminder, REMINDER_TYPES } from '@/hooks/useCRMData';
import { B2BClient } from '@/hooks/useB2BClientsData';
import { cn } from '@/lib/utils';

interface CrmReminderManagerProps {
  reminders: CrmReminder[];
  customers: { id: string; company_name: string }[];
  customerId?: string; // if provided, filters to one customer
  onCreate: (r: any) => Promise<any>;
  onComplete: (id: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  showCustomerName?: boolean;
  filterOptions?: {
    type?: string;
    priority?: string;
    assignedTo?: string;
    status?: 'all' | 'pending' | 'completed' | 'overdue';
  };
}

const PRIORITY_COLORS: Record<string, string> = {
  haute: 'bg-destructive/10 text-destructive border-destructive/30',
  moyenne: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
  basse: 'bg-muted text-muted-foreground border-muted',
};

const emptyForm = (customerId?: string) => ({
  customer_id: customerId || '',
  title: '', description: '', due_date: new Date().toISOString().slice(0, 10),
  reminder_type: 'follow_up', priority: 'moyenne', assigned_to: '',
});

export function CrmReminderManager({
  reminders, customers, customerId, onCreate, onComplete, onDelete, showCustomerName = false,
}: CrmReminderManagerProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm(customerId));
  const [filterType, setFilterType] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'completed' | 'overdue'>('pending');
  const [filterAssignedTo, setFilterAssignedTo] = useState('all');

  const today = new Date().toISOString().slice(0, 10);

  // Get unique assigned_to values
  const assignees = [...new Set(reminders.map(r => r.assigned_to).filter(Boolean))] as string[];

  const filtered = reminders.filter(r => {
    if (filterType !== 'all' && r.reminder_type !== filterType) return false;
    if (filterPriority !== 'all' && r.priority !== filterPriority) return false;
    if (filterAssignedTo !== 'all' && r.assigned_to !== filterAssignedTo) return false;
    if (filterStatus === 'pending' && r.is_completed) return false;
    if (filterStatus === 'completed' && !r.is_completed) return false;
    if (filterStatus === 'overdue' && (r.is_completed || r.due_date >= today)) return false;
    return true;
  });

  const handleCreate = async () => {
    if (!form.title.trim() || !form.customer_id) return;
    await onCreate(form);
    setShowAdd(false);
    setForm(emptyForm(customerId));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-sm flex items-center gap-1.5">
          <Bell className="h-4 w-4" /> Rappels & Relances ({filtered.length})
        </h4>
        <Button size="sm" variant="outline" onClick={() => { setForm(emptyForm(customerId)); setShowAdd(true); }}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-3">
        <Select value={filterStatus} onValueChange={v => setFilterStatus(v as any)}>
          <SelectTrigger className="h-7 text-xs w-auto min-w-[100px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="pending">En cours</SelectItem>
            <SelectItem value="overdue">En retard</SelectItem>
            <SelectItem value="completed">Terminés</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="h-7 text-xs w-auto min-w-[100px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous types</SelectItem>
            {REMINDER_TYPES.map(t => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="h-7 text-xs w-auto min-w-[100px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes priorités</SelectItem>
            <SelectItem value="haute">Haute</SelectItem>
            <SelectItem value="moyenne">Moyenne</SelectItem>
            <SelectItem value="basse">Basse</SelectItem>
          </SelectContent>
        </Select>
        {assignees.length > 0 && (
          <Select value={filterAssignedTo} onValueChange={setFilterAssignedTo}>
            <SelectTrigger className="h-7 text-xs w-auto min-w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous utilisateurs</SelectItem>
              {assignees.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun rappel.</p>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(r => {
            const isOverdue = !r.is_completed && r.due_date < today;
            const typeLabel = REMINDER_TYPES.find(t => t.key === r.reminder_type)?.label || r.reminder_type;
            const customerName = customers.find(c => c.id === r.customer_id)?.company_name;
            return (
              <div key={r.id} className={cn(
                "flex items-start gap-3 p-3 rounded-lg border transition-colors",
                r.is_completed ? 'opacity-50 bg-muted/20' : isOverdue ? 'border-destructive/40 bg-destructive/5' : 'bg-background'
              )}>
                <Checkbox
                  checked={r.is_completed}
                  onCheckedChange={() => !r.is_completed && onComplete(r.id)}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn("font-medium text-sm", r.is_completed && 'line-through')}>{r.title}</span>
                    <Badge variant="outline" className={cn("text-[10px]", PRIORITY_COLORS[r.priority])}>{r.priority}</Badge>
                    <Badge variant="outline" className="text-[10px]">{typeLabel}</Badge>
                    {isOverdue && <Badge variant="destructive" className="text-[10px] flex items-center gap-0.5"><AlertTriangle className="h-2.5 w-2.5" />Retard</Badge>}
                  </div>
                  {r.description && <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>}
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-1">
                    <span>Échéance: {new Date(r.due_date).toLocaleDateString('fr-FR')}</span>
                    {r.assigned_to && <span className="flex items-center gap-0.5"><User className="h-2.5 w-2.5" />{r.assigned_to}</span>}
                    {showCustomerName && customerName && <span>• {customerName}</span>}
                  </div>
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => onDelete(r.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouveau rappel</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            {!customerId && (
              <Select value={form.customer_id} onValueChange={v => setForm(f => ({ ...f, customer_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un client *" /></SelectTrigger>
                <SelectContent>
                  {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Input placeholder="Titre *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            <Textarea placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            <div className="grid grid-cols-2 gap-3">
              <Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
              <Select value={form.reminder_type} onValueChange={v => setForm(f => ({ ...f, reminder_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REMINDER_TYPES.map(t => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="haute">Haute</SelectItem>
                  <SelectItem value="moyenne">Moyenne</SelectItem>
                  <SelectItem value="basse">Basse</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Assigné à" value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={!form.title.trim() || !form.customer_id}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
