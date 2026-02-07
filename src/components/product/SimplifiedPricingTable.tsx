import { Product } from '@/engine/types';
import { SectionCard } from '@/components/ui/KPICard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/data/financialConfig';
import { Plus, Trash2 } from 'lucide-react';

interface SimplifiedPricingTableProps {
  products: Product[];
  onUpdateProduct: (product: Product) => void;
  onAddProduct: (product: Product) => void;
  onRemoveProduct: (id: string) => void;
}

export function SimplifiedPricingTable({ products, onUpdateProduct, onAddProduct, onRemoveProduct }: SimplifiedPricingTableProps) {
  const handleAdd = () => {
    const newProduct: Product = {
      id: `product-${Date.now()}`,
      name: 'Nouveau Produit',
      category: 'B2C',
      launchYear: 2026,
      devCost: 100000,
      devAmortizationYears: 5,
      unitCost: 200,
      priceHT: 500,
      priceTTC_B2C: 600,
      vatRate: 0.20,
      coef_shop: 1.8,
      coef_dist: 1.4,
      coef_oem: 1.5,
      volumesByYear: {},
    };
    onAddProduct(newProduct);
  };

  return (
    <SectionCard title="Pricing Produits">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produit</TableHead>
              <TableHead className="text-right">Prix TTC B2C</TableHead>
              <TableHead className="text-right">Prix HT</TableHead>
              <TableHead className="text-right">Coût Unitaire</TableHead>
              <TableHead className="text-right">Marge</TableHead>
              <TableHead className="text-right">Dev Cost</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map(product => (
              <TableRow key={product.id}>
                <TableCell>
                  <Input
                    value={product.name}
                    onChange={e => onUpdateProduct({ ...product, name: e.target.value })}
                    className="h-8 w-40"
                  />
                </TableCell>
                <TableCell className="text-right font-mono-numbers">
                  <Input
                    type="number"
                    value={product.priceTTC_B2C}
                    onChange={e => {
                      const ttc = Number(e.target.value);
                      onUpdateProduct({ ...product, priceTTC_B2C: ttc, priceHT: ttc / (1 + product.vatRate) });
                    }}
                    className="h-8 w-24 text-right"
                  />
                </TableCell>
                <TableCell className="text-right font-mono-numbers">{formatCurrency(product.priceHT)}</TableCell>
                <TableCell className="text-right font-mono-numbers">{formatCurrency(product.unitCost)}</TableCell>
                <TableCell className="text-right font-mono-numbers">
                  {((1 - product.unitCost / product.priceHT) * 100).toFixed(0)}%
                </TableCell>
                <TableCell className="text-right font-mono-numbers">{formatCurrency(product.devCost, true)}</TableCell>
                <TableCell>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onRemoveProduct(product.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Button variant="outline" size="sm" className="mt-4" onClick={handleAdd}>
        <Plus className="h-4 w-4 mr-1" /> Ajouter Produit
      </Button>
    </SectionCard>
  );
}
