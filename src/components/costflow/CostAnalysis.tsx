import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import type { CostFlowProduct, CostFlowReference, CostFlowBomEntry } from '@/hooks/useCostFlowData';

const VOLUME_TIERS = [50, 100, 200, 500, 1000, 2000, 5000, 10000];

interface Props {
  products: CostFlowProduct[];
  references: CostFlowReference[];
  bom: CostFlowBomEntry[];
  calculateProductCosts: (productId: string) => Record<number, number>;
}

export function CostAnalysis({ products, references, bom, calculateProductCosts }: Props) {
  const [copiedProducts, setCopiedProducts] = useState(false);
  const [copiedRefs, setCopiedRefs] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [selectedRefs, setSelectedRefs] = useState<Set<string>>(new Set());

  const toggleProduct = (id: string) => {
    const next = new Set(selectedProducts);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedProducts(next);
  };

  const toggleRef = (id: string) => {
    const next = new Set(selectedRefs);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedRefs(next);
  };

  const copyProductsToClipboard = () => {
    const items = products.filter(p => selectedProducts.size === 0 || selectedProducts.has(p.id));
    const header = ['Produit', 'Famille', 'Coef.', ...VOLUME_TIERS.map(v => `Coût @${v}`), 'Prix TTC', 'Marge @500'].join('\t');
    const rows = items.map(p => {
      const costs = calculateProductCosts(p.id);
      const priceHT = p.price_ttc / 1.2;
      const margin = priceHT > 0 ? ((priceHT - (costs[500] || 0)) / priceHT * 100).toFixed(1) + '%' : '-';
      return [p.name, p.family, p.coefficient.toFixed(2), ...VOLUME_TIERS.map(v => (costs[v] || 0).toFixed(2)), p.price_ttc.toFixed(2), margin].join('\t');
    });
    navigator.clipboard.writeText([header, ...rows].join('\n'));
    setCopiedProducts(true);
    setTimeout(() => setCopiedProducts(false), 2000);
    toast.success('Données produits copiées');
  };

  const copyRefsToClipboard = () => {
    const items = references.filter(r => selectedRefs.size === 0 || selectedRefs.has(r.id));
    const header = ['Code', 'Nom', 'Catégorie', 'Fournisseur', ...VOLUME_TIERS.map(v => `Prix @${v}`), 'Devise', 'Commentaires'].join('\t');
    const rows = items.map(r =>
      [r.code, r.name, r.category, r.supplier, ...VOLUME_TIERS.map(v => (r.prices[v] || 0).toFixed(2)), r.currency, r.comments].join('\t')
    );
    navigator.clipboard.writeText([header, ...rows].join('\n'));
    setCopiedRefs(true);
    setTimeout(() => setCopiedRefs(false), 2000);
    toast.success('Données références copiées');
  };

  return (
    <Tabs defaultValue="products" className="space-y-4">
      <TabsList>
        <TabsTrigger value="products">Export Produits</TabsTrigger>
        <TabsTrigger value="references">Export Références</TabsTrigger>
        <TabsTrigger value="margins">Analyse Marges</TabsTrigger>
      </TabsList>

      <TabsContent value="products" className="space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">{selectedProducts.size > 0 ? `${selectedProducts.size} produit(s) sélectionné(s)` : 'Tous les produits seront exportés'}</p>
          <Button variant="outline" onClick={copyProductsToClipboard}>
            {copiedProducts ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
            Copier vers Excel
          </Button>
        </div>
        <div className="border rounded overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Produit</TableHead>
                <TableHead>Famille</TableHead>
                {VOLUME_TIERS.map(v => <TableHead key={v} className="text-right text-xs">@{v}</TableHead>)}
                <TableHead className="text-right">Prix TTC</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map(p => {
                const costs = calculateProductCosts(p.id);
                return (
                  <TableRow key={p.id} className="cursor-pointer" onClick={() => toggleProduct(p.id)}>
                    <TableCell><input type="checkbox" checked={selectedProducts.has(p.id)} readOnly /></TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell><Badge variant="secondary">{p.family}</Badge></TableCell>
                    {VOLUME_TIERS.map(v => <TableCell key={v} className="text-right font-mono-numbers text-xs">{(costs[v] || 0).toFixed(2)}</TableCell>)}
                    <TableCell className="text-right font-mono-numbers">{p.price_ttc.toFixed(2)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </TabsContent>

      <TabsContent value="references" className="space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">{selectedRefs.size > 0 ? `${selectedRefs.size} référence(s) sélectionnée(s)` : 'Toutes les références seront exportées'}</p>
          <Button variant="outline" onClick={copyRefsToClipboard}>
            {copiedRefs ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
            Copier vers Excel
          </Button>
        </div>
        <div className="border rounded overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Fournisseur</TableHead>
                {VOLUME_TIERS.map(v => <TableHead key={v} className="text-right text-xs">@{v}</TableHead>)}
                <TableHead>Devise</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {references.map(r => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => toggleRef(r.id)}>
                  <TableCell><input type="checkbox" checked={selectedRefs.has(r.id)} readOnly /></TableCell>
                  <TableCell className="font-mono-numbers">{r.code}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell>{r.supplier || '-'}</TableCell>
                  {VOLUME_TIERS.map(v => <TableCell key={v} className="text-right font-mono-numbers text-xs">{(r.prices[v] || 0).toFixed(2)}</TableCell>)}
                  <TableCell>{r.currency}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </TabsContent>

      <TabsContent value="margins" className="space-y-4">
        <div className="border rounded overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produit</TableHead>
                <TableHead className="text-right">Prix HT</TableHead>
                {VOLUME_TIERS.map(v => <TableHead key={v} className="text-right text-xs">Marge @{v}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map(p => {
                const costs = calculateProductCosts(p.id);
                const priceHT = p.price_ttc / 1.2;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-right font-mono-numbers">{priceHT > 0 ? priceHT.toFixed(2) : '-'}</TableCell>
                    {VOLUME_TIERS.map(v => {
                      const margin = priceHT > 0 ? ((priceHT - (costs[v] || 0)) / priceHT) * 100 : 0;
                      return (
                        <TableCell key={v} className={`text-right font-mono-numbers text-xs font-medium ${margin >= 30 ? 'positive-value' : margin >= 0 ? 'text-warning' : 'negative-value'}`}>
                          {priceHT > 0 ? `${margin.toFixed(1)}%` : '-'}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </TabsContent>
    </Tabs>
  );
}
