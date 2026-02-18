import { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, GripVertical, Building2, User, DollarSign, Calendar, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/data/financialConfig';
import { CustomerOpportunity, Customer, PIPELINE_STAGES } from '@/hooks/useCRMData';

interface PipelineKanbanProps {
  opportunities: CustomerOpportunity[];
  customers: Customer[];
  onCreateOpportunity: (opp: any) => Promise<any>;
  onUpdateOpportunity: (id: string, updates: Partial<CustomerOpportunity>) => Promise<boolean>;
  onDeleteOpportunity: (id: string) => Promise<boolean>;
}

export function PipelineKanban({ opportunities, customers, onCreateOpportunity, onUpdateOpportunity, onDeleteOpportunity }: PipelineKanbanProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [addStage, setAddStage] = useState('prospect');
  const [form, setForm] = useState({ customer_id: '', contact_name: '', estimated_amount: '', probability: '50', expected_close_date: '', responsible: '' });
  const dragItem = useRef<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  const handleDragStart = (oppId: string) => { dragItem.current = oppId; };
  const handleDragOver = (e: React.DragEvent, stage: string) => { e.preventDefault(); setDragOverStage(stage); };
  const handleDragLeave = () => { setDragOverStage(null); };
  const handleDrop = async (stage: string) => {
    setDragOverStage(null);
    if (dragItem.current) {
      await onUpdateOpportunity(dragItem.current, { stage });
      dragItem.current = null;
    }
  };

  const handleCreate = async () => {
    if (!form.customer_id) return;
    await onCreateOpportunity({
      customer_id: form.customer_id,
      stage: addStage,
      contact_name: form.contact_name || null,
      estimated_amount: Number(form.estimated_amount) || 0,
      probability: Number(form.probability) || 0,
      expected_close_date: form.expected_close_date || null,
      responsible: form.responsible || null,
    });
    setShowAdd(false);
    setForm({ customer_id: '', contact_name: '', estimated_amount: '', probability: '50', expected_close_date: '', responsible: '' });
  };

  const openAdd = (stage: string) => { setAddStage(stage); setShowAdd(true); };

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: 400 }}>
        {PIPELINE_STAGES.map(stage => {
          const stageOpps = opportunities.filter(o => o.stage === stage.key);
          const stageTotal = stageOpps.reduce((s, o) => s + (o.estimated_amount || 0), 0);
          return (
            <div
              key={stage.key}
              className={cn(
                'flex-shrink-0 w-[220px] rounded-xl border p-3 transition-colors',
                stage.color,
                dragOverStage === stage.key && 'ring-2 ring-primary'
              )}
              onDragOver={e => handleDragOver(e, stage.key)}
              onDragLeave={handleDragLeave}
              onDrop={() => handleDrop(stage.key)}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-sm">{stage.label}</h3>
                  <span className="text-xs text-muted-foreground">{stageOpps.length} · {formatCurrency(stageTotal, true)}</span>
                </div>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openAdd(stage.key)}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="space-y-2">
                {stageOpps.map(opp => {
                  const cust = customers.find(c => c.id === opp.customer_id);
                  return (
                    <Card
                      key={opp.id}
                      draggable
                      onDragStart={() => handleDragStart(opp.id)}
                      className="cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow"
                    >
                      <CardContent className="p-3 space-y-1.5">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-1.5">
                            <GripVertical className="h-3 w-3 text-muted-foreground/50" />
                            <span className="font-medium text-xs">{cust?.company_name || '?'}</span>
                          </div>
                          <Button size="icon" variant="ghost" className="h-5 w-5 text-muted-foreground hover:text-destructive" onClick={() => onDeleteOpportunity(opp.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        {opp.contact_name && (
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <User className="h-3 w-3" /> {opp.contact_name}
                          </div>
                        )}
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-mono-numbers font-medium">{formatCurrency(opp.estimated_amount, true)}</span>
                          <Badge variant="outline" className="text-[10px]">{opp.probability}%</Badge>
                        </div>
                        {opp.expected_close_date && (
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Calendar className="h-3 w-3" /> {new Date(opp.expected_close_date).toLocaleDateString('fr-FR')}
                          </div>
                        )}
                        {opp.responsible && (
                          <div className="text-[10px] text-muted-foreground">{opp.responsible}</div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle Opportunité — {PIPELINE_STAGES.find(s => s.key === addStage)?.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Select value={form.customer_id} onValueChange={v => setForm(f => ({ ...f, customer_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Client *" /></SelectTrigger>
              <SelectContent>
                {customers.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input placeholder="Contact" value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} />
            <div className="grid grid-cols-2 gap-3">
              <Input type="number" placeholder="Montant estimé (€)" value={form.estimated_amount} onChange={e => setForm(f => ({ ...f, estimated_amount: e.target.value }))} />
              <Input type="number" placeholder="Probabilité (%)" value={form.probability} onChange={e => setForm(f => ({ ...f, probability: e.target.value }))} />
            </div>
            <Input type="date" placeholder="Date conclusion" value={form.expected_close_date} onChange={e => setForm(f => ({ ...f, expected_close_date: e.target.value }))} />
            <Input placeholder="Responsable" value={form.responsible} onChange={e => setForm(f => ({ ...f, responsible: e.target.value }))} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={!form.customer_id}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
