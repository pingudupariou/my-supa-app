import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Trash2, Star, Pencil, Building2 } from 'lucide-react';
import { BusinessEntity } from '@/hooks/useBusinessEntities';

interface BusinessEntityManagerProps {
  entities: BusinessEntity[];
  onCreate: (e: { name: string; description?: string; color?: string }) => Promise<any>;
  onUpdate: (id: string, updates: Partial<BusinessEntity>) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onSetDefault: (id: string) => Promise<void>;
  isAdmin: boolean;
}

const COLORS = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

export function BusinessEntityManager({ entities, onCreate, onUpdate, onDelete, onSetDefault, isAdmin }: BusinessEntityManagerProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(COLORS[0]);

  if (!isAdmin) {
    return (
      <div className="space-y-2">
        <h4 className="font-medium text-sm flex items-center gap-1.5">
          <Building2 className="h-4 w-4" /> Entités commerciales
        </h4>
        {entities.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune entité configurée par l'administrateur.</p>
        ) : (
          <div className="space-y-1">
            {entities.map(e => (
              <div key={e.id} className="flex items-center gap-2 p-2 rounded border bg-background">
                <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                <span className="text-sm font-medium">{e.name}</span>
                {e.is_default && <Badge variant="outline" className="text-[10px]">Par défaut</Badge>}
                {e.description && <span className="text-xs text-muted-foreground ml-auto">{e.description}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const openCreate = () => {
    setEditId(null);
    setName('');
    setDescription('');
    setColor(COLORS[entities.length % COLORS.length]);
    setShowDialog(true);
  };

  const openEdit = (e: BusinessEntity) => {
    setEditId(e.id);
    setName(e.name);
    setDescription(e.description || '');
    setColor(e.color);
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    if (editId) {
      await onUpdate(editId, { name, description: description || null, color });
    } else {
      await onCreate({ name, description: description || undefined, color });
    }
    setShowDialog(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm flex items-center gap-1.5">
          <Building2 className="h-4 w-4" /> Entités commerciales ({entities.length})
        </h4>
        <Button size="sm" variant="outline" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter
        </Button>
      </div>

      {entities.length === 0 ? (
        <p className="text-sm text-muted-foreground">Créez votre première entité pour commencer.</p>
      ) : (
        <div className="space-y-1">
          {entities.map(e => (
            <div key={e.id} className="flex items-center gap-2 p-2 rounded border bg-background group">
              <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
              <span className="text-sm font-medium">{e.name}</span>
              {e.is_default && <Badge variant="outline" className="text-[10px]">Par défaut</Badge>}
              {e.description && <span className="text-xs text-muted-foreground">{e.description}</span>}
              <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {!e.is_default && (
                  <Button size="icon" variant="ghost" className="h-6 w-6" title="Définir par défaut" onClick={() => onSetDefault(e.id)}>
                    <Star className="h-3 w-3" />
                  </Button>
                )}
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openEdit(e)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onDelete(e.id)}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? 'Modifier l\'entité' : 'Nouvelle entité commerciale'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input placeholder="Nom de l'entreprise *" value={name} onChange={e => setName(e.target.value)} autoFocus />
            <Input placeholder="Description (optionnel)" value={description} onChange={e => setDescription(e.target.value)} />
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Couleur</label>
              <div className="flex gap-2">
                {COLORS.map(c => (
                  <button
                    key={c}
                    className={`h-6 w-6 rounded-full border-2 transition-all ${color === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={!name.trim()}>{editId ? 'Enregistrer' : 'Créer'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
