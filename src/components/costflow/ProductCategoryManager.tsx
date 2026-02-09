import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, Edit, Tag } from 'lucide-react';
import type { CostFlowProductCategory } from '@/hooks/useCostFlowData';

interface Props {
  categories: CostFlowProductCategory[];
  onCreateCategory: (cat: Partial<CostFlowProductCategory>) => Promise<void>;
  onUpdateCategory: (id: string, cat: Partial<CostFlowProductCategory>) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
}

export function ProductCategoryManager({ categories, onCreateCategory, onUpdateCategory, onDeleteCategory }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CostFlowProductCategory | null>(null);
  const [form, setForm] = useState({ name: '', description: '', color: '#6366f1' });

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', description: '', color: '#6366f1' });
    setDialogOpen(true);
  };

  const openEdit = (cat: CostFlowProductCategory) => {
    setEditing(cat);
    setForm({ name: cat.name, description: cat.description, color: cat.color });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    if (editing) {
      await onUpdateCategory(editing.id, form);
    } else {
      await onCreateCategory(form);
    }
    setDialogOpen(false);
  };

  return (
    <div className="financial-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="section-title flex items-center gap-2"><Tag className="h-4 w-4" /> Catégories de produits</h4>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Nouvelle catégorie</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editing ? 'Modifier la catégorie' : 'Nouvelle catégorie'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nom *</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Électronique, Mécanique..." />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Description optionnelle" />
              </div>
              <div>
                <Label>Couleur</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className="h-9 w-12 rounded border cursor-pointer" />
                  <Input value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className="font-mono-numbers flex-1" />
                </div>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <Button onClick={handleSave}>{editing ? 'Mettre à jour' : 'Créer'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">Aucune catégorie. Créez-en pour organiser vos produits.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Couleur</TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Description</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map(cat => (
              <TableRow key={cat.id}>
                <TableCell>
                  <div className="h-5 w-5 rounded-full border" style={{ backgroundColor: cat.color }} />
                </TableCell>
                <TableCell className="font-medium">{cat.name}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{cat.description || '-'}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(cat)}><Edit className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => onDeleteCategory(cat.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
