import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Edit, Search } from 'lucide-react';
import type { CostFlowSupplier } from '@/hooks/useCostFlowData';

interface Props {
  suppliers: CostFlowSupplier[];
  onCreateSupplier: (supplier: Partial<CostFlowSupplier>) => Promise<void>;
  onUpdateSupplier: (id: string, supplier: Partial<CostFlowSupplier>) => Promise<void>;
  onDeleteSupplier: (id: string) => Promise<void>;
}

const emptyForm = { name: '', contact_name: '', email: '', phone: '', country: 'France', comments: '' };

export function SupplierManager({ suppliers, onCreateSupplier, onUpdateSupplier, onDeleteSupplier }: Props) {
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.contact_name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (s: CostFlowSupplier) => {
    setEditingId(s.id);
    setForm({ name: s.name, contact_name: s.contact_name, email: s.email, phone: s.phone, country: s.country, comments: s.comments });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    if (editingId) {
      await onUpdateSupplier(editingId, form);
    } else {
      await onCreateSupplier(form);
    }
    setDialogOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher un fournisseur..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Nouveau fournisseur</Button>
      </div>

      <div className="border rounded overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Téléphone</TableHead>
              <TableHead>Pays</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Aucun fournisseur. Cliquez sur "Nouveau fournisseur" pour commencer.</TableCell></TableRow>
            )}
            {filtered.map(s => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{s.contact_name || '-'}</TableCell>
                <TableCell>{s.email || '-'}</TableCell>
                <TableCell>{s.phone || '-'}</TableCell>
                <TableCell>{s.country}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Edit className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => onDeleteSupplier(s.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">{filtered.length} fournisseur(s)</p>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Nom *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nom du fournisseur" />
            </div>
            <div>
              <Label>Contact</Label>
              <Input value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} placeholder="Nom du contact" />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" />
            </div>
            <div>
              <Label>Téléphone</Label>
              <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+33 ..." />
            </div>
            <div>
              <Label>Pays</Label>
              <Input value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} placeholder="France" />
            </div>
            <div className="col-span-2">
              <Label>Commentaires</Label>
              <Textarea value={form.comments} onChange={e => setForm({ ...form, comments: e.target.value })} rows={2} />
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <Button onClick={handleSave} disabled={!form.name.trim()}>{editingId ? 'Mettre à jour' : 'Créer'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
