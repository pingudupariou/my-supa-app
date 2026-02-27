import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Edit, Search, Upload, Calculator, PenLine } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ProductImportDialog } from './ProductImportDialog';
import type { CostFlowProduct, CostFlowReference, CostFlowProductCategory, CostMode } from '@/hooks/useCostFlowData';

interface Props {
  products: CostFlowProduct[];
  references: CostFlowReference[];
  categories: CostFlowProductCategory[];
  onCreateProduct: (prod: Partial<CostFlowProduct>) => Promise<void>;
  onUpdateProduct: (id: string, prod: Partial<CostFlowProduct>) => Promise<void>;
  onDeleteProduct: (id: string) => Promise<void>;
  onSelectProduct: (prod: CostFlowProduct) => void;
  onImportProduct: (product: Partial<CostFlowProduct>, bomEntries: { referenceId: string; quantity: number }[]) => Promise<void>;
  calculateProductCosts: (productId: string) => Record<number, number>;
}

export function ProductManager({ products, references, categories, onCreateProduct, onUpdateProduct, onDeleteProduct, onSelectProduct, onImportProduct, calculateProductCosts }: Props) {
  const [search, setSearch] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProd, setEditingProd] = useState<CostFlowProduct | null>(null);
  const [form, setForm] = useState({
    name: '', main_supplier: '', coefficient: 1.3,
    price_ttc: 0, default_volume: 500, comments: '', category_id: '' as string | null,
  });

  const filtered = products.filter(p => {
    const catName = categories.find(c => c.id === p.category_id)?.name || '';
    return p.name.toLowerCase().includes(search.toLowerCase()) ||
      catName.toLowerCase().includes(search.toLowerCase());
  });

  const openCreate = () => {
    setEditingProd(null);
    setForm({ name: '', main_supplier: '', coefficient: 1.3, price_ttc: 0, default_volume: 500, comments: '', category_id: null });
    setDialogOpen(true);
  };

  const openEdit = (prod: CostFlowProduct) => {
    setEditingProd(prod);
    setForm({ name: prod.name, main_supplier: prod.main_supplier, coefficient: prod.coefficient, price_ttc: prod.price_ttc, default_volume: prod.default_volume, comments: prod.comments, category_id: prod.category_id || null });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name) return;
    if (editingProd) {
      await onUpdateProduct(editingProd.id, form);
    } else {
      await onCreateProduct(form);
    }
    setDialogOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher produit ou catégorie..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4 mr-1" /> Importer</Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Nouveau produit</Button>
            </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingProd ? 'Modifier le produit' : 'Nouveau produit'}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Nom *</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nom du produit" />
              </div>
              <div>
                <Label>Catégorie</Label>
                <Select value={form.category_id || 'none'} onValueChange={v => setForm({ ...form, category_id: v === 'none' ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="Aucune catégorie" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune</SelectItem>
                    {categories.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="flex items-center gap-2">
                          <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: c.color }} />
                          {c.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fournisseur principal</Label>
                <Input value={form.main_supplier} onChange={e => setForm({ ...form, main_supplier: e.target.value })} />
              </div>
              <div>
                <Label>Coefficient (MO + assemblage)</Label>
                <Input type="number" step="0.01" className="font-mono-numbers" value={form.coefficient} onChange={e => setForm({ ...form, coefficient: parseFloat(e.target.value) || 1 })} />
              </div>
              <div>
                <Label>Volume d'achat par défaut</Label>
                <Input type="number" className="font-mono-numbers" value={form.default_volume} onChange={e => setForm({ ...form, default_volume: parseInt(e.target.value) || 500 })} />
              </div>
              <div>
                <Label>Prix TTC public (€)</Label>
                <Input type="number" step="0.01" className="font-mono-numbers bg-muted" value={form.price_ttc} readOnly disabled title="Géré depuis l'onglet Pricing" />
                <p className="text-xs text-muted-foreground mt-1">Géré depuis l'onglet Pricing</p>
              </div>
              <div className="col-span-2">
                <Label>Commentaires</Label>
                <Textarea value={form.comments} onChange={e => setForm({ ...form, comments: e.target.value })} rows={2} />
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <Button onClick={handleSave}>{editingProd ? 'Mettre à jour' : 'Créer'}</Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="border rounded overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produit</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead className="text-center">Mode coût</TableHead>
              <TableHead>Fournisseur</TableHead>
              <TableHead className="text-right">Coef.</TableHead>
              <TableHead className="text-right">Coût unitaire</TableHead>
              <TableHead className="text-right">Coût pondéré</TableHead>
              <TableHead className="text-right">Prix TTC</TableHead>
              <TableHead className="text-right">Marge</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Aucun produit. Cliquez sur "Nouveau produit" pour commencer.</TableCell></TableRow>
            )}
            {filtered.map(prod => {
              const costs = calculateProductCosts(prod.id);
              const unitCost = prod.cost_mode === 'manual' ? prod.manual_unit_cost : (costs[500] || 0) / (prod.coefficient || 1);
              const weightedCost = prod.cost_mode === 'manual' ? prod.manual_unit_cost * prod.coefficient : (costs[500] || 0);
              const margin = prod.price_ttc > 0 ? ((prod.price_ttc / 1.2 - weightedCost) / (prod.price_ttc / 1.2)) * 100 : 0;
              return (
                <TableRow key={prod.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onSelectProduct(prod)}>
                  <TableCell className="font-medium">{prod.name}</TableCell>
                  <TableCell>
                    {(() => {
                      const cat = categories.find(c => c.id === prod.category_id);
                      return cat ? (
                        <Badge variant="outline" className="gap-1">
                          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: cat.color }} />
                          {cat.name}
                        </Badge>
                      ) : <span className="text-muted-foreground text-xs">—</span>;
                    })()}
                  </TableCell>
                  <TableCell className="text-center" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1">
                      <button
                        className={`p-1.5 rounded transition-colors ${prod.cost_mode === 'bom' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                        title="Calcul BOM (nomenclature)"
                        onClick={() => onUpdateProduct(prod.id, { cost_mode: 'bom' } as any)}
                      >
                        <Calculator className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className={`p-1.5 rounded transition-colors ${prod.cost_mode === 'manual' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                        title="Coût manuel"
                        onClick={() => onUpdateProduct(prod.id, { cost_mode: 'manual' } as any)}
                      >
                        <PenLine className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </TableCell>
                  <TableCell>{prod.main_supplier || '-'}</TableCell>
                  <TableCell className="text-right font-mono-numbers">{prod.coefficient.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono-numbers" onClick={e => e.stopPropagation()}>
                    {prod.cost_mode === 'manual' ? (
                      <Input
                        type="number"
                        step="0.01"
                        value={prod.manual_unit_cost}
                        onChange={e => onUpdateProduct(prod.id, { manual_unit_cost: parseFloat(e.target.value) || 0 } as any)}
                        className="h-7 w-24 text-right font-mono-numbers inline-block"
                        title="Coût unitaire saisi (€)"
                      />
                    ) : (
                      <span>{unitCost > 0 ? `${unitCost.toFixed(2)} €` : '-'}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono-numbers font-medium">
                    {weightedCost > 0 ? `${weightedCost.toFixed(2)} €` : '-'}
                  </TableCell>
                  <TableCell className="text-right font-mono-numbers">{prod.price_ttc > 0 ? `${prod.price_ttc.toFixed(2)} €` : '-'}</TableCell>
                  <TableCell className={`text-right font-mono-numbers font-medium ${margin > 0 ? 'positive-value' : 'negative-value'}`}>
                    {prod.price_ttc > 0 ? `${margin.toFixed(1)}%` : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); openEdit(prod); }}><Edit className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); onDeleteProduct(prod.id); }}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <ProductImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        existingReferences={references}
        existingSuppliers={[...new Set(references.map(r => r.supplier).filter(Boolean))]}
        onImportProduct={onImportProduct}
      />
    </div>
  );
}
