import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, Edit } from 'lucide-react';
import type { TimeCategory } from '@/hooks/useTimeTrackingData';

const PRESET_COLORS = ['#6366f1', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];

interface Props {
  categories: TimeCategory[];
  onCreateCategory: (name: string, color: string) => Promise<void>;
  onUpdateCategory: (id: string, updates: Partial<TimeCategory>) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
}

export function CategoryManager({ categories, onCreateCategory, onUpdateCategory, onDeleteCategory }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6366f1');

  const openCreate = () => { setEditingId(null); setName(''); setColor('#6366f1'); setDialogOpen(true); };
  const openEdit = (cat: TimeCategory) => { setEditingId(cat.id); setName(cat.name); setColor(cat.color); setDialogOpen(true); };

  const handleSave = async () => {
    if (!name.trim()) return;
    if (editingId) {
      await onUpdateCategory(editingId, { name, color });
    } else {
      await onCreateCategory(name, color);
    }
    setDialogOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Les catégories permettent de classer les tâches. Seuls les rôles admin et finance peuvent les gérer.</p>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Nouvelle catégorie</Button>
      </div>

      <div className="border rounded overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Couleur</TableHead>
              <TableHead>Nom</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.length === 0 && (
              <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">Aucune catégorie créée.</TableCell></TableRow>
            )}
            {categories.map(cat => (
              <TableRow key={cat.id}>
                <TableCell><div className="w-5 h-5 rounded-full" style={{ backgroundColor: cat.color }} /></TableCell>
                <TableCell className="font-medium">{cat.name}</TableCell>
                <TableCell>
                  <div className="flex gap-1 justify-end">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(cat)}><Edit className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => onDeleteCategory(cat.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Modifier la catégorie' : 'Nouvelle catégorie'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nom *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Développement, Design..." />
            </div>
            <div>
              <Label>Couleur</Label>
              <div className="flex gap-2 mt-2">
                {PRESET_COLORS.map(c => (
                  <button key={c} className={`w-7 h-7 rounded-full border-2 transition-all ${color === c ? 'border-foreground scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} onClick={() => setColor(c)} />
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <Button onClick={handleSave} disabled={!name.trim()}>{editingId ? 'Mettre à jour' : 'Créer'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
