import { useState, useMemo } from 'react';
import { CostFlowReference, CostFlowProduct } from '@/hooks/useCostFlowData';
import { useStockData, StockEntry } from '@/hooks/useStockData';
import { StockImportWizard } from './StockImportWizard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Upload, Package, Layers, AlertTriangle, History, Edit2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Props {
  references: CostFlowReference[];
  products: CostFlowProduct[];
}

export function StockManager({ references, products }: Props) {
  const { stock, imports, loading, upsertStock, bulkUpsertStock, getStockForItem } = useStockData();
  const [search, setSearch] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [editItem, setEditItem] = useState<{ type: 'reference' | 'product'; id: string; name: string; qty: number } | null>(null);
  const [editQty, setEditQty] = useState('');
  const [activeTab, setActiveTab] = useState('references');

  const activeRefs = useMemo(() => references.filter(r => !r.deleted_at), [references]);
  const activeProducts = useMemo(() => products.filter(p => !p.deleted_at), [products]);

  const filteredRefs = useMemo(() => {
    const q = search.toLowerCase();
    return activeRefs
      .map(r => ({ ref: r, stock: getStockForItem('reference', r.id) }))
      .filter(({ ref }) =>
        !q || ref.code.toLowerCase().includes(q) || ref.name.toLowerCase().includes(q)
      )
      .sort((a, b) => (b.stock?.quantity ?? 0) - (a.stock?.quantity ?? 0));
  }, [activeRefs, search, getStockForItem]);

  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase();
    return activeProducts
      .map(p => ({ product: p, stock: getStockForItem('product', p.id) }))
      .filter(({ product }) =>
        !q || product.name.toLowerCase().includes(q)
      )
      .sort((a, b) => (b.stock?.quantity ?? 0) - (a.stock?.quantity ?? 0));
  }, [activeProducts, search, getStockForItem]);

  // KPIs
  const totalRefStock = stock.filter(s => s.item_type === 'reference').reduce((sum, s) => sum + s.quantity, 0);
  const totalProdStock = stock.filter(s => s.item_type === 'product').reduce((sum, s) => sum + s.quantity, 0);
  const zeroStockRefs = activeRefs.filter(r => {
    const s = getStockForItem('reference', r.id);
    return !s || s.quantity === 0;
  }).length;

  const handleEditSave = async () => {
    if (!editItem) return;
    await upsertStock(editItem.type, editItem.id, Number(editQty) || 0);
    setEditItem(null);
  };

  if (showImport) {
    return (
      <StockImportWizard
        references={references}
        products={products}
        onImportComplete={(entries, fileName, matched, partial, unmatched) => {
          bulkUpsertStock(entries, fileName, matched, partial, unmatched);
          setShowImport(false);
        }}
        onClose={() => setShowImport(false)}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Layers className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{totalRefStock}</p>
              <p className="text-xs text-muted-foreground">Stock Références</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Package className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{totalProdStock}</p>
              <p className="text-xs text-muted-foreground">Stock Produits</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <div>
              <p className="text-2xl font-bold">{zeroStockRefs}</p>
              <p className="text-xs text-muted-foreground">Refs sans stock</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <History className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{imports.length}</p>
              <p className="text-xs text-muted-foreground">Imports réalisés</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par code ou nom..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={() => setShowImport(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Importer Excel
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="references">📦 Références ({activeRefs.length})</TabsTrigger>
          <TabsTrigger value="products">🎯 Produits ({activeProducts.length})</TabsTrigger>
          <TabsTrigger value="history">📋 Historique imports</TabsTrigger>
        </TabsList>

        <TabsContent value="references">
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Fournisseur</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Dernière MAJ</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRefs.map(({ ref, stock: s }) => (
                  <TableRow key={ref.id}>
                    <TableCell className="font-mono text-xs font-semibold">{ref.code}</TableCell>
                    <TableCell className="text-sm">{ref.name}</TableCell>
                    <TableCell>
                      {ref.supplier && <Badge variant="outline" className="text-xs">{ref.supplier}</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`font-mono font-bold ${!s || s.quantity === 0 ? 'text-destructive' : ''}`}>
                        {s ? s.quantity : '—'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {s ? format(new Date(s.last_updated_at), 'dd/MM HH:mm', { locale: fr }) : '—'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          setEditItem({ type: 'reference', id: ref.id, name: `${ref.code} — ${ref.name}`, qty: s?.quantity ?? 0 });
                          setEditQty(String(s?.quantity ?? 0));
                        }}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredRefs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">Aucune référence trouvée</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="products">
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produit</TableHead>
                  <TableHead>Famille</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Dernière MAJ</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map(({ product, stock: s }) => (
                  <TableRow key={product.id}>
                    <TableCell className="text-sm font-medium">{product.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">{product.family || '—'}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`font-mono font-bold ${!s || s.quantity === 0 ? 'text-destructive' : ''}`}>
                        {s ? s.quantity : '—'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {s ? format(new Date(s.last_updated_at), 'dd/MM HH:mm', { locale: fr }) : '—'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          setEditItem({ type: 'product', id: product.id, name: product.name, qty: s?.quantity ?? 0 });
                          setEditQty(String(s?.quantity ?? 0));
                        }}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredProducts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">Aucun produit trouvé</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fichier</TableHead>
                  <TableHead className="text-right">Exacts</TableHead>
                  <TableHead className="text-right">Partiels</TableHead>
                  <TableHead className="text-right">Non trouvés</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {imports.map(imp => (
                  <TableRow key={imp.id}>
                    <TableCell className="text-sm font-medium">{imp.file_name}</TableCell>
                    <TableCell className="text-right font-mono">{imp.matched_count}</TableCell>
                    <TableCell className="text-right font-mono">{imp.partial_count}</TableCell>
                    <TableCell className="text-right font-mono">{imp.unmatched_count}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {format(new Date(imp.imported_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                    </TableCell>
                  </TableRow>
                ))}
                {imports.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">Aucun import réalisé</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit dialog */}
      <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier le stock</DialogTitle>
          </DialogHeader>
          {editItem && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{editItem.name}</p>
              <div>
                <label className="text-sm font-medium mb-1 block">Quantité en stock</label>
                <Input
                  type="number"
                  value={editQty}
                  onChange={e => setEditQty(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleEditSave()}
                  autoFocus
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>Annuler</Button>
            <Button onClick={handleEditSave}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
