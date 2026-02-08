import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Customer } from '@/hooks/useCRMData';

interface CustomerListProps {
  customers: Customer[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRefresh: () => void;
  onCreate?: (customer: Omit<Customer, 'id' | 'created_at' | 'updated_at'>) => Promise<Customer | null>;
}

export function CustomerList({ customers, selectedId, onSelect, onRefresh, onCreate }: CustomerListProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ company_name: '', contact_name: '', email: '', phone: '', city: '', status: 'prospect' as const, pricing_tier: 'bronze' as const });

  const handleCreate = async () => {
    if (!onCreate || !form.company_name.trim()) return;
    const result = await onCreate({
      ...form,
      address: null, postal_code: null, country: 'France',
      latitude: null, longitude: null, notes: null,
    } as any);
    if (result) {
      setShowAdd(false);
      setForm({ company_name: '', contact_name: '', email: '', phone: '', city: '', status: 'prospect', pricing_tier: 'bronze' });
      onSelect(result.id);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Clients</CardTitle>
            <div className="flex gap-1">
              {onCreate && (
                <Button size="sm" variant="ghost" onClick={() => setShowAdd(true)}>
                  <Plus className="h-4 w-4" />
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={onRefresh}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          {customers.length === 0 && <p className="text-sm text-muted-foreground">Aucun client</p>}
          {customers.map(c => (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={cn(
                'w-full text-left p-3 rounded-lg transition-colors',
                selectedId === c.id ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted/50'
              )}
            >
              <div className="font-medium text-sm">{c.company_name}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                {c.city && <span>{c.city}</span>}
                <Badge variant="outline" className="text-[10px]">{c.pricing_tier}</Badge>
              </div>
            </button>
          ))}
        </CardContent>
      </Card>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau Client</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input placeholder="Nom de l'entreprise *" value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} />
            <Input placeholder="Nom du contact" value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} />
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              <Input placeholder="Téléphone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <Input placeholder="Ville" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
            <div className="grid grid-cols-2 gap-3">
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="prospect">Prospect</SelectItem>
                  <SelectItem value="active">Actif</SelectItem>
                  <SelectItem value="inactive">Inactif</SelectItem>
                </SelectContent>
              </Select>
              <Select value={form.pricing_tier} onValueChange={v => setForm(f => ({ ...f, pricing_tier: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bronze">Bronze</SelectItem>
                  <SelectItem value="silver">Silver</SelectItem>
                  <SelectItem value="gold">Gold</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={!form.company_name.trim()}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
