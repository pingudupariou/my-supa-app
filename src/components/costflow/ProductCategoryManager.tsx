import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Edit, Tags } from 'lucide-react';
import type { CostFlowProductCategory } from '@/hooks/useCostFlowData';

interface Props {
  categories: CostFlowProductCategory[];
  onCreateCategory: (cat: Partial<CostFlowProductCategory>) => Promise<void>;
  onUpdateCategory: (id: string, cat: Partial<CostFlowProductCategory>) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
}

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
];

export function ProductCategoryManager({ categories, onCreateCategory, onUpdateCategory, onDeleteCategory }: Props) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CostFlowProductCategory | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [description, setDescription] = useState('');

  const openCreate = () => {
    setEditing(null);
    setName('');
    setColor('#6366f1');
    setDescription('');
    setOpen(true);
  };

  const openEdit = (cat: CostFlowProductCategory) => {
    setEditing(cat);
    setName(cat.name);
    setColor(cat.color);
    setDescription(cat.description);
    setOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    if (editing) {
      await onUpdateCategory(editing.id, { name, color, description });
    } else {
      await onCreateCategory({ name, color, description });
    }
    setOpen(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tags className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Catégories de produits</span>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" onClick={openCreate}>
              <Plus className="h-3 w-3 mr-1" /> Catégorie
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{editing ? 'Modifier la catégorie' : 'Nouvelle catégorie'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nom *</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Optique, Mécanique..." />
              </div>
              <div>
                <Label>Couleur</Label>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${color === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                      onClick={() => setColor(c)}
                    />
                  ))}
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optionnel" />
              </div>
              <Button onClick={handleSave} className="w-full">{editing ? 'Mettre à jour' : 'Créer'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {categories.map(cat => (
            <Badge
              key={cat.id}
              variant="outline"
              className="gap-1 pr-1 cursor-pointer hover:bg-muted/50"
              onClick={() => openEdit(cat)}
            >
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: cat.color }} />
              {cat.name}
              <button
                className="ml-1 text-destructive hover:text-destructive/80 p-0.5"
                onClick={e => { e.stopPropagation(); onDeleteCategory(cat.id); }}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {categories.length === 0 && (
        <p className="text-xs text-muted-foreground">Aucune catégorie. Créez-en pour organiser vos produits.</p>
      )}
    </div>
  );
}
