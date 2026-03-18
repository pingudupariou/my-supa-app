import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, Edit, GripVertical, Tag } from 'lucide-react';
import type { ProductPlanCategory } from '@/engine/types';

interface Props {
  categories: ProductPlanCategory[];
  onUpdate: (categories: ProductPlanCategory[]) => void;
}

export function ProductPlanCategoryManager({ categories, onUpdate }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProductPlanCategory | null>(null);
  const [form, setForm] = useState({ name: '', color: '#6366f1' });

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', color: '#6366f1' });
    setDialogOpen(true);
  };

  const openEdit = (cat: ProductPlanCategory) => {
    setEditing(cat);
    setForm({ name: cat.name, color: cat.color });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    if (editing) {
      onUpdate(categories.map(c => c.id === editing.id ? { ...c, name: form.name, color: form.color } : c));
    } else {
      const maxOrder = categories.length > 0 ? Math.max(...categories.map(c => c.sortOrder)) : -1;
      onUpdate([...categories, { id: `pcat-${Date.now()}`, name: form.name, color: form.color, sortOrder: maxOrder + 1 }]);
    }
    setDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    onUpdate(categories.filter(c => c.id !== id));
  };

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
    const temp = sorted[idx].sortOrder;
    sorted[idx].sortOrder = sorted[idx - 1].sortOrder;
    sorted[idx - 1].sortOrder = temp;
    onUpdate(sorted);
  };

  const moveDown = (idx: number) => {
    const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
    if (idx >= sorted.length - 1) return;
    const temp = sorted[idx].sortOrder;
    sorted[idx].sortOrder = sorted[idx + 1].sortOrder;
    sorted[idx + 1].sortOrder = temp;
    onUpdate(sorted);
  };

  const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Tag className="h-4 w-4" /> Catégories & Priorités
        </h4>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Catégorie
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{editing ? 'Modifier' : 'Nouvelle catégorie'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nom *</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Flagship, Accessoire..." />
              </div>
              <div>
                <Label>Couleur</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className="h-9 w-12 rounded border cursor-pointer" />
                  <Input value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className="font-mono flex-1" />
                </div>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <Button onClick={handleSave}>{editing ? 'Mettre à jour' : 'Créer'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {sorted.length === 0 ? (
        <p className="text-xs text-muted-foreground">Aucune catégorie. Les produits seront affichés sans classement.</p>
      ) : (
        <div className="space-y-1">
          {sorted.map((cat, idx) => (
            <div key={cat.id} className="flex items-center gap-2 p-2 rounded-md border bg-card text-sm">
              <div className="flex flex-col gap-0.5">
                <button onClick={() => moveUp(idx)} className="text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={idx === 0}>▲</button>
                <button onClick={() => moveDown(idx)} className="text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={idx === sorted.length - 1}>▼</button>
              </div>
              <div className="h-4 w-4 rounded-full border shrink-0" style={{ backgroundColor: cat.color }} />
              <span className="font-medium flex-1">{cat.name}</span>
              <span className="text-xs text-muted-foreground">Prio {idx + 1}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(cat)}><Edit className="h-3 w-3" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(cat.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
