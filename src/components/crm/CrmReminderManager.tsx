import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Bell, Trash2, AlertTriangle, User, ChevronUp } from 'lucide-react';
import { CrmReminder, REMINDER_TYPES } from '@/hooks/useCRMData';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface CrmReminderManagerProps {
  reminders: CrmReminder[];
  customers: { id: string; company_name: string }[];
  customerId?: string;
  onCreate: (r: any) => Promise<any>;
  onComplete: (id: string) => Promise<boolean>;
  onUncomplete?: (id: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  showCustomerName?: boolean;
}

interface CrmWriter {
  id: string;
  label: string; // email or full_name
}

const PRIORITY_COLORS: Record<string, string> = {
  haute: 'bg-destructive/10 text-destructive border-destructive/30',
  moyenne: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
  basse: 'bg-muted text-muted-foreground border-muted',
};

export function CrmReminderManager({
  reminders, customers, customerId, onCreate, onComplete, onUncomplete, onDelete, showCustomerName = false,
}: CrmReminderManagerProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [formCustomerId, setFormCustomerId] = useState(customerId || '');
  const [formDescription, setFormDescription] = useState('');
  const [formDueDate, setFormDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [formType, setFormType] = useState('follow_up');
  const [formPriority, setFormPriority] = useState('moyenne');
  const [formAssignedTo, setFormAssignedTo] = useState('');

  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'completed' | 'overdue'>('pending');
  const [filterType, setFilterType] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');

  const [crmWriters, setCrmWriters] = useState<CrmWriter[]>([]);

  const today = new Date().toISOString().slice(0, 10);

  // Fetch users with CRM write access
  useEffect(() => {
    const fetchWriters = async () => {
      try {
        // 1. Get roles with write access to 'crm' tab
        const { data: perms } = await supabase
          .from('tab_permissions')
          .select('role')
          .eq('tab_key', 'crm')
          .eq('permission', 'write');
        
        if (!perms || perms.length === 0) return;
        const writeRoles = perms.map(p => p.role);

        // 2. Get user_ids with those roles
        const { data: roleEntries } = await supabase
          .from('user_roles')
          .select('user_id, role');
        
        if (!roleEntries) return;
        const writerIds = roleEntries
          .filter(r => writeRoles.includes(r.role))
          .map(r => r.user_id);
        const uniqueIds = [...new Set(writerIds)];

        // 3. Get user info from edge function
        const { data: session } = await supabase.auth.getSession();
        if (!session?.session?.access_token || uniqueIds.length === 0) return;

        const res = await supabase.functions.invoke('list-users', {
          headers: { Authorization: `Bearer ${session.session.access_token}` },
        });

        if (res.data?.users) {
          const writers: CrmWriter[] = res.data.users
            .filter((u: any) => uniqueIds.includes(u.id))
            .map((u: any) => ({
              id: u.id,
              label: u.user_metadata?.full_name || u.email || u.id.slice(0, 8),
            }));
          setCrmWriters(writers);
        }
      } catch {
        // Fallback: no writers dropdown
      }
    };
    fetchWriters();
  }, []);

  const filtered = reminders.filter(r => {
    if (filterType !== 'all' && r.reminder_type !== filterType) return false;
    if (filterPriority !== 'all' && r.priority !== filterPriority) return false;
    if (filterStatus === 'pending' && r.is_completed) return false;
    if (filterStatus === 'completed' && !r.is_completed) return false;
    if (filterStatus === 'overdue' && (r.is_completed || r.due_date >= today)) return false;
    return true;
  });

  const handleCreate = async () => {
    const cid = customerId || formCustomerId;
    if (!cid) return;
    const typeLabel = REMINDER_TYPES.find(t => t.key === formType)?.label || formType;
    await onCreate({
      customer_id: cid,
      title: typeLabel + (formDescription ? ` — ${formDescription}` : ''),
      description: formDescription || null,
      due_date: formDueDate,
      reminder_type: formType,
      priority: formPriority,
      assigned_to: formAssignedTo || null,
    });
    setFormDescription('');
    setFormDueDate(new Date().toISOString().slice(0, 10));
    setFormType('follow_up');
    setFormPriority('moyenne');
    setFormAssignedTo('');
    setShowAdd(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-sm flex items-center gap-1.5">
          <Bell className="h-4 w-4" /> Rappels & Relances ({filtered.length})
        </h4>
        <Button size="sm" variant="outline" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? <ChevronUp className="h-3.5 w-3.5 mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
          {showAdd ? 'Fermer' : 'Ajouter'}
        </Button>
      </div>

      {/* Inline quick form */}
      {showAdd && (
        <div className="mb-3 p-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 space-y-2">
          {!customerId && (
            <Select value={formCustomerId} onValueChange={setFormCustomerId}>
              <SelectTrigger className="text-sm"><SelectValue placeholder="Client *" /></SelectTrigger>
              <SelectContent>
                {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Select value={formType} onValueChange={setFormType}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {REMINDER_TYPES.map(t => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="date" value={formDueDate} onChange={e => setFormDueDate(e.target.value)} className="text-sm" />
          </div>
          <Input
            placeholder="Description (optionnel)"
            value={formDescription}
            onChange={e => setFormDescription(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            className="text-sm"
          />
          <div className="flex items-center gap-2">
            <Select value={formPriority} onValueChange={setFormPriority}>
              <SelectTrigger className="text-sm flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="haute">🔴 Haute</SelectItem>
                <SelectItem value="moyenne">🟡 Moyenne</SelectItem>
                <SelectItem value="basse">⚪ Basse</SelectItem>
              </SelectContent>
            </Select>
            {crmWriters.length > 0 ? (
              <Select value={formAssignedTo} onValueChange={setFormAssignedTo}>
                <SelectTrigger className="text-sm flex-1"><SelectValue placeholder="Assigner à…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Non assigné</SelectItem>
                  {crmWriters.map(w => <SelectItem key={w.id} value={w.label}>{w.label}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <Input placeholder="Assigner à…" value={formAssignedTo} onChange={e => setFormAssignedTo(e.target.value)} className="text-sm flex-1" />
            )}
            <Button size="sm" onClick={handleCreate} disabled={!(customerId || formCustomerId)} className="shrink-0">
              <Plus className="h-3.5 w-3.5 mr-1" /> Créer
            </Button>
          </div>
        </div>
      )}

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
                  onCheckedChange={() => r.is_completed ? onUncomplete?.(r.id) : onComplete(r.id)}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">{typeLabel}</Badge>
                    <Badge variant="outline" className={cn("text-[10px]", PRIORITY_COLORS[r.priority])}>{r.priority}</Badge>
                    {isOverdue && <Badge variant="destructive" className="text-[10px] flex items-center gap-0.5"><AlertTriangle className="h-2.5 w-2.5" />Retard</Badge>}
                  </div>
                  {r.description && <p className={cn("text-sm mt-1", r.is_completed && 'line-through text-muted-foreground')}>{r.description}</p>}
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
    </div>
  );
}
