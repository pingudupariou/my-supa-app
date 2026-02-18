import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { formatCurrency } from '@/data/financialConfig';
import { InteractionHistory } from './InteractionHistory';
import { Customer, CustomerInteraction, CustomerOpportunity, PIPELINE_STAGES } from '@/hooks/useCRMData';
import { Save, AlertCircle } from 'lucide-react';

interface CustomerDetailProps {
  customer: Customer;
  orders: any[];
  interactions: CustomerInteraction[];
  opportunities: CustomerOpportunity[];
  onRefresh: () => void;
  onUpdateCustomer: (id: string, updates: Partial<Customer>) => Promise<boolean>;
  onCreateInteraction: (interaction: any) => Promise<any>;
}

export function CustomerDetail({ customer, orders, interactions, opportunities, onUpdateCustomer, onCreateInteraction }: CustomerDetailProps) {
  const totalRevenue = orders.reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0);
  const [editing, setEditing] = useState(false);
  const [priority, setPriority] = useState(customer.priority || 'moyenne');
  const [nextAction, setNextAction] = useState(customer.next_action || '');
  const [nextActionDate, setNextActionDate] = useState(customer.next_action_date || '');

  const handleSave = async () => {
    await onUpdateCustomer(customer.id, {
      priority,
      next_action: nextAction || null,
      next_action_date: nextActionDate || null,
    } as any);
    setEditing(false);
  };

  const currentStage = opportunities.length > 0
    ? PIPELINE_STAGES.find(s => s.key === opportunities[0].stage)
    : null;

  const priorityColor = {
    haute: 'bg-destructive/10 text-destructive',
    moyenne: 'bg-amber-500/10 text-amber-700',
    basse: 'bg-green-500/10 text-green-700',
  }[priority] || 'bg-muted';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{customer.company_name}</span>
          <div className="flex items-center gap-2">
            {currentStage && <Badge variant="outline">{currentStage.label}</Badge>}
            <Badge>{customer.status}</Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Info grid */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">Contact:</span>
            <span className="ml-2">{customer.contact_name || '-'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Email:</span>
            <span className="ml-2">{customer.email || '-'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Ville:</span>
            <span className="ml-2">{customer.city || '-'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">CA Total:</span>
            <span className="ml-2 font-mono-numbers">{formatCurrency(totalRevenue, true)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Dernière interaction:</span>
            <span className="ml-2">
              {customer.last_interaction_date
                ? new Date(customer.last_interaction_date).toLocaleDateString('fr-FR')
                : '-'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Priorité:</span>
            {editing ? (
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="h-7 w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="haute">Haute</SelectItem>
                  <SelectItem value="moyenne">Moyenne</SelectItem>
                  <SelectItem value="basse">Basse</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Badge className={priorityColor}>{priority}</Badge>
            )}
          </div>
        </div>

        {/* Next action */}
        <div className="p-3 rounded-lg bg-muted/30 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" /> Prochaine action
            </span>
            {editing ? (
              <Button size="sm" variant="default" onClick={handleSave}><Save className="h-3.5 w-3.5 mr-1" /> Sauver</Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Modifier</Button>
            )}
          </div>
          {editing ? (
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Action à faire" value={nextAction} onChange={e => setNextAction(e.target.value)} className="h-8 text-sm" />
              <Input type="date" value={nextActionDate} onChange={e => setNextActionDate(e.target.value)} className="h-8 text-sm" />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {customer.next_action || 'Aucune action planifiée'}
              {customer.next_action_date && (
                <span className="ml-2 text-xs">— {new Date(customer.next_action_date).toLocaleDateString('fr-FR')}</span>
              )}
            </p>
          )}
        </div>

        {/* Orders */}
        {orders.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="font-medium text-sm mb-2">Commandes ({orders.length})</h4>
              <div className="space-y-1">
                {orders.slice(0, 5).map((order: any) => (
                  <div key={order.id} className="flex justify-between text-sm p-2 bg-muted/30 rounded">
                    <span>{order.order_reference}</span>
                    <span className="font-mono-numbers">{formatCurrency(order.total_amount, true)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Interactions */}
        <Separator />
        <InteractionHistory
          interactions={interactions}
          customerId={customer.id}
          onCreate={onCreateInteraction}
        />
      </CardContent>
    </Card>
  );
}
