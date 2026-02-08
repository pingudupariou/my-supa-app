import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Edit, Search, Upload } from 'lucide-react';
import { ReferenceImportDialog } from './ReferenceImportDialog';
import type { CostFlowReference } from '@/hooks/useCostFlowData';

const CATEGORIES = ['Mécanique', 'Électronique', 'Plastique', 'Composite', 'Caoutchouc', 'Visserie', 'Câblage', 'Autre'];
const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'CNY', 'JPY'];
const REVISIONS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const VOLUME_TIERS = [50, 100, 200, 500, 1000, 2000, 5000, 10000];

interface Props {
  references: CostFlowReference[];
  onCreateReference: (ref: Partial<CostFlowReference>) => Promise<void>;
  onUpdateReference: (id: string, ref: Partial<CostFlowReference>) => Promise<void>;
  onDeleteReference: (id: string) => Promise<void>;
  onBulkImport: (refs: Partial<CostFlowReference>[]) => Promise<void>;
  onSelectReference: (ref: CostFlowReference) => void;
}

export function ReferenceManager({ references, onCreateReference, onUpdateReference, onDeleteReference, onBulkImport, onSelectReference }: Props) {
  const [search, setSearch] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRef, setEditingRef] = useState<CostFlowReference | null>(null);
  const [form, setForm] = useState({
    code: '', name: '', category: 'Mécanique', revision: 'A',
    supplier: '', currency: 'EUR', comments: '',
    prices: {} as Record<number, number>,
  });

  const filtered = references.filter(r =>
    r.code.toLowerCase().includes(search.toLowerCase()) ||
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.supplier.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditingRef(null);
    setForm({ code: '', name: '', category: 'Mécanique', revision: 'A', supplier: '', currency: 'EUR', comments: '', prices: {} });
    setDialogOpen(true);
  };

  const openEdit = (ref: CostFlowReference) => {
    setEditingRef(ref);
    setForm({ code: ref.code, name: ref.name, category: ref.category, revision: ref.revision, supplier: ref.supplier, currency: ref.currency, comments: ref.comments, prices: { ...ref.prices } });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.code || !form.name) return;
    if (editingRef) {
      await onUpdateReference(editingRef.id, form);
    } else {
      await onCreateReference(form);
    }
    setDialogOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher code, nom, fournisseur..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4 mr-1" /> Importer</Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Nouvelle référence</Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingRef ? 'Modifier la référence' : 'Nouvelle référence'}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Code *</Label>
                <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="REF-001" />
              </div>
              <div>
                <Label>Nom *</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nom de la pièce" />
              </div>
              <div>
                <Label>Catégorie</Label>
                <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Révision</Label>
                <Select value={form.revision} onValueChange={v => setForm({ ...form, revision: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{REVISIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fournisseur</Label>
                <Input value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} placeholder="Nom du fournisseur" />
              </div>
              <div>
                <Label>Devise</Label>
                <Select value={form.currency} onValueChange={v => setForm({ ...form, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-4">
              <Label className="text-sm font-semibold">Grille de prix par volume ({form.currency})</Label>
              <div className="grid grid-cols-4 gap-2 mt-2">
                {VOLUME_TIERS.map(vol => (
                  <div key={vol}>
                    <Label className="text-xs text-muted-foreground">{vol} unités</Label>
                    <Input type="number" step="0.01" className="font-mono-numbers text-right" value={form.prices[vol] || ''} onChange={e => setForm({ ...form, prices: { ...form.prices, [vol]: parseFloat(e.target.value) || 0 } })} placeholder="0.00" />
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4">
              <Label>Commentaires</Label>
              <Textarea value={form.comments} onChange={e => setForm({ ...form, comments: e.target.value })} rows={2} />
            </div>
            <div className="flex justify-end mt-4">
              <Button onClick={handleSave}>{editingRef ? 'Mettre à jour' : 'Créer'}</Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="border rounded overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead>Rév.</TableHead>
              <TableHead>Fournisseur</TableHead>
              <TableHead>Devise</TableHead>
              <TableHead className="text-right">Prix @500</TableHead>
              <TableHead className="text-right">Prix @1000</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Aucune référence. Cliquez sur "Nouvelle référence" pour commencer.</TableCell></TableRow>
            )}
            {filtered.map(ref => (
              <TableRow key={ref.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onSelectReference(ref)}>
                <TableCell className="font-mono-numbers font-medium">{ref.code}</TableCell>
                <TableCell>{ref.name}</TableCell>
                <TableCell><Badge variant="secondary">{ref.category}</Badge></TableCell>
                <TableCell>{ref.revision}</TableCell>
                <TableCell>{ref.supplier || '-'}</TableCell>
                <TableCell>{ref.currency}</TableCell>
                <TableCell className="text-right font-mono-numbers">{ref.prices[500]?.toFixed(2) || '-'}</TableCell>
                <TableCell className="text-right font-mono-numbers">{ref.prices[1000]?.toFixed(2) || '-'}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); openEdit(ref); }}><Edit className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); onDeleteReference(ref.id); }}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">{filtered.length} référence(s) • Cliquez sur une ligne pour voir les détails et plans techniques</p>
      <ReferenceImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={onBulkImport}
        existingCodes={references.map(r => r.code)}
      />
    </div>
  );
}
