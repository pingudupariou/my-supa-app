import { useState, useMemo } from 'react';
import { CostFlowReference, CostFlowProduct, CostFlowBomEntry } from '@/hooks/useCostFlowData';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Search, ChevronRight, Package, Layers, AlertTriangle } from 'lucide-react';

interface Props {
  references: CostFlowReference[];
  products: CostFlowProduct[];
  bom: CostFlowBomEntry[];
}

interface RefUsage {
  reference: CostFlowReference;
  usages: { product: CostFlowProduct; quantity: number }[];
}

export function ReferenceUsageMap({ references, products, bom }: Props) {
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'used' | 'unused'>('all');

  const usageMap = useMemo<RefUsage[]>(() => {
    return references
      .filter(r => !r.deleted_at)
      .map(ref => {
        const entries = bom.filter(b => b.reference_id === ref.id);
        const usages = entries
          .map(e => {
            const product = products.find(p => p.id === e.product_id && !p.deleted_at);
            return product ? { product, quantity: e.quantity } : null;
          })
          .filter(Boolean) as { product: CostFlowProduct; quantity: number }[];
        return { reference: ref, usages };
      })
      .sort((a, b) => b.usages.length - a.usages.length);
  }, [references, products, bom]);

  const filtered = useMemo(() => {
    let list = usageMap;
    if (filterMode === 'used') list = list.filter(r => r.usages.length > 0);
    if (filterMode === 'unused') list = list.filter(r => r.usages.length === 0);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.reference.code.toLowerCase().includes(q) ||
        r.reference.name.toLowerCase().includes(q) ||
        r.reference.supplier?.toLowerCase().includes(q) ||
        r.usages.some(u => u.product.name.toLowerCase().includes(q))
      );
    }
    return list;
  }, [usageMap, search, filterMode]);

  const totalRefs = usageMap.length;
  const usedRefs = usageMap.filter(r => r.usages.length > 0).length;
  const unusedRefs = totalRefs - usedRefs;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <Card
          className={`cursor-pointer transition-all ${filterMode === 'all' ? 'ring-2 ring-primary' : 'hover:bg-muted/50'}`}
          onClick={() => setFilterMode('all')}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <Layers className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{totalRefs}</p>
              <p className="text-xs text-muted-foreground">Références totales</p>
            </div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all ${filterMode === 'used' ? 'ring-2 ring-primary' : 'hover:bg-muted/50'}`}
          onClick={() => setFilterMode('used')}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <Package className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{usedRefs}</p>
              <p className="text-xs text-muted-foreground">Utilisées</p>
            </div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all ${filterMode === 'unused' ? 'ring-2 ring-destructive' : 'hover:bg-muted/50'}`}
          onClick={() => setFilterMode('unused')}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <div>
              <p className="text-2xl font-bold">{unusedRefs}</p>
              <p className="text-xs text-muted-foreground">Non utilisées</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher par code, nom, fournisseur ou produit..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Results */}
      <div className="space-y-2">
        {filtered.map(({ reference, usages }) => (
          <Collapsible key={reference.id}>
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
                  <div className="text-left">
                    <span className="font-mono text-sm font-semibold">{reference.code}</span>
                    <span className="ml-2 text-sm text-muted-foreground">{reference.name}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {reference.supplier && (
                    <Badge variant="outline" className="text-xs">{reference.supplier}</Badge>
                  )}
                  <Badge variant={usages.length > 0 ? 'default' : 'destructive'} className="text-xs">
                    {usages.length} produit{usages.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              {usages.length > 0 ? (
                <div className="ml-6 mt-1 mb-2 border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produit</TableHead>
                        <TableHead>Famille</TableHead>
                        <TableHead className="text-right">Quantité / unité</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usages.map(u => (
                        <TableRow key={u.product.id}>
                          <TableCell className="font-medium">{u.product.name}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">{u.product.family || '—'}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold">{u.quantity}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="ml-6 mt-1 mb-2 p-3 border rounded-md bg-destructive/5 text-sm text-muted-foreground flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Cette référence n'est utilisée dans aucun produit.
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Aucune référence trouvée.</p>
        )}
      </div>
    </div>
  );
}
