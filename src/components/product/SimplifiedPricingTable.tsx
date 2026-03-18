import { useState } from 'react';
import { Product, ProductPlanCategory } from '@/engine/types';
import { SectionCard } from '@/components/ui/KPICard';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/data/financialConfig';
import { Plus, Trash2, ChevronDown, ChevronRight, MessageSquare, CheckCircle2, Clock } from 'lucide-react';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface SimplifiedPricingTableProps {
  products: Product[];
  categories: ProductPlanCategory[];
  onUpdateProduct: (product: Product) => void;
  onAddProduct: (product: Product) => void;
  onRemoveProduct: (id: string) => void;
}

export function SimplifiedPricingTable({ products, categories, onUpdateProduct, onAddProduct, onRemoveProduct }: SimplifiedPricingTableProps) {
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleComment = (id: string) => {
    setExpandedComments(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleGroup = (catId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      next.has(catId) ? next.delete(catId) : next.add(catId);
      return next;
    });
  };

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
      priceHT_B2B: 300,
      priceHT_OEM: 220,
      vatRate: 0.20,
      coef_shop: 1.8,
      coef_dist: 1.4,
      coef_oem: 1.5,
      volumesByYear: {},
      productComment: '',
      productStatus: 'standby',
    };
    onAddProduct(newProduct);
  };

  const sortedCategories = useMemo(() =>
    [...categories].sort((a, b) => a.sortOrder - b.sortOrder),
    [categories]
  );

  const grouped = useMemo(() => {
    const catMap = new Map<string, { cat: ProductPlanCategory; products: Product[] }>();
    sortedCategories.forEach(c => catMap.set(c.id, { cat: c, products: [] }));

    const uncategorized: Product[] = [];
    products.forEach(p => {
      if (p.productCategoryId && catMap.has(p.productCategoryId)) {
        catMap.get(p.productCategoryId)!.products.push(p);
      } else {
        uncategorized.push(p);
      }
    });

    const groups: { catId: string | null; catName: string | null; color: string | null; products: Product[] }[] = [];
    catMap.forEach(({ cat, products: prods }) => {
      if (prods.length > 0 || sortedCategories.length > 0) {
        groups.push({ catId: cat.id, catName: cat.name, color: cat.color, products: prods });
      }
    });
    if (uncategorized.length > 0 || sortedCategories.length === 0) {
      groups.push({ catId: null, catName: sortedCategories.length > 0 ? 'Non classé' : null, color: null, products: uncategorized });
    }
    return groups;
  }, [products, sortedCategories]);

  const COL_COUNT = 17;

  const marginPct = (price: number, cost: number) =>
    price > 0 ? ((1 - cost / price) * 100).toFixed(1) + '%' : '0%';

  const renderProductRow = (product: Product) => {
    const hasComment = !!product.productComment?.trim();
    const isExpanded = expandedComments.has(product.id);

    return (
      <>
        <TableRow key={product.id} className="group hover:bg-muted/30 transition-colors">
          {/* Nom + bouton commentaire */}
          <TableCell className="py-1.5">
            <div className="flex items-center gap-1">
              <Input
                value={product.name}
                onChange={e => onUpdateProduct({ ...product, name: e.target.value })}
                className="h-8 w-36 text-sm font-medium border-transparent bg-transparent hover:border-input focus:border-input transition-colors"
              />
              <button
                onClick={() => toggleComment(product.id)}
                className={cn(
                  'shrink-0 p-1 rounded hover:bg-muted transition-colors',
                  hasComment ? 'text-primary' : 'text-muted-foreground/40 opacity-0 group-hover:opacity-100'
                )}
                title="Commentaire"
              >
                <MessageSquare className="h-3.5 w-3.5" />
              </button>
            </div>
          </TableCell>
          {/* Catégorie */}
          <TableCell className="py-1.5 text-center">
            {categories.length > 0 ? (
              <Select
                value={product.productCategoryId || '__none__'}
                onValueChange={v => onUpdateProduct({ ...product, productCategoryId: v === '__none__' ? undefined : v })}
              >
                <SelectTrigger className="h-7 w-28 mx-auto text-xs border-transparent bg-transparent hover:border-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {sortedCategories.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                        {c.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </TableCell>
          {/* Lancement */}
          <TableCell className="py-1.5 text-center">
            <Input
              type="number"
              value={product.launchYear}
              onChange={e => onUpdateProduct({ ...product, launchYear: Number(e.target.value) })}
              className="h-7 w-18 text-center mx-auto text-xs border-transparent bg-transparent hover:border-input"
            />
          </TableCell>
          {/* Prix TTC B2C */}
          <TableCell className="py-1.5 text-right font-mono">
            <Input
              type="number"
              value={product.priceTTC_B2C}
              onChange={e => {
                const ttc = Number(e.target.value);
                onUpdateProduct({ ...product, priceTTC_B2C: ttc, priceHT: ttc / (1 + product.vatRate) });
              }}
              className="h-7 w-22 text-right text-xs border-transparent bg-transparent hover:border-input"
            />
          </TableCell>
          {/* Prix HT B2C */}
          <TableCell className="py-1.5 text-right font-mono text-xs text-muted-foreground">
            {formatCurrency(product.priceHT)}
          </TableCell>
          {/* Prix HT B2B */}
          <TableCell className="py-1.5 text-right font-mono">
            <Input
              type="number"
              value={product.priceHT_B2B}
              onChange={e => onUpdateProduct({ ...product, priceHT_B2B: Number(e.target.value) })}
              className="h-7 w-22 text-right text-xs border-transparent bg-transparent hover:border-input"
            />
          </TableCell>
          {/* Prix HT OEM */}
          <TableCell className="py-1.5 text-right font-mono">
            <Input
              type="number"
              value={product.priceHT_OEM}
              onChange={e => onUpdateProduct({ ...product, priceHT_OEM: Number(e.target.value) })}
              className="h-7 w-22 text-right text-xs border-transparent bg-transparent hover:border-input"
            />
          </TableCell>
          {/* Coût Unitaire */}
          <TableCell className="py-1.5 text-right font-mono">
            <Input
              type="number"
              value={product.unitCost}
              onChange={e => onUpdateProduct({ ...product, unitCost: Number(e.target.value) })}
              className="h-7 w-22 text-right text-xs border-transparent bg-transparent hover:border-input"
            />
          </TableCell>
          {/* Marges */}
          <TableCell className="py-1.5 text-right font-mono text-xs">{marginPct(product.priceHT, product.unitCost)}</TableCell>
          <TableCell className="py-1.5 text-right font-mono text-xs">{marginPct(product.priceHT_B2B, product.unitCost)}</TableCell>
          <TableCell className="py-1.5 text-right font-mono text-xs">{marginPct(product.priceHT_OEM, product.unitCost)}</TableCell>
          {/* CAPEX R&D */}
          <TableCell className="py-1.5 text-right font-mono">
            <Input
              type="number"
              value={product.devCost}
              onChange={e => onUpdateProduct({ ...product, devCost: Number(e.target.value) })}
              className="h-7 w-24 text-right text-xs border-transparent bg-transparent hover:border-input"
            />
          </TableCell>
          {/* Amort */}
          <TableCell className="py-1.5 text-center">
            <Input
              type="number"
              value={product.devAmortizationYears || 5}
              min={1}
              onChange={e => onUpdateProduct({ ...product, devAmortizationYears: Number(e.target.value) })}
              className="h-7 w-14 text-center mx-auto text-xs border-transparent bg-transparent hover:border-input"
            />
          </TableCell>
          {/* OPEX R&D */}
          <TableCell className="py-1.5 text-right font-mono">
            <Input
              type="number"
              value={product.opexRD || 0}
              onChange={e => onUpdateProduct({ ...product, opexRD: Number(e.target.value) })}
              className="h-7 w-24 text-right text-xs border-transparent bg-transparent hover:border-input"
            />
          </TableCell>
          {/* OPEX Marketing */}
          <TableCell className="py-1.5 text-right font-mono">
            <Input
              type="number"
              value={product.opexMarketing || 0}
              onChange={e => onUpdateProduct({ ...product, opexMarketing: Number(e.target.value) })}
              className="h-7 w-24 text-right text-xs border-transparent bg-transparent hover:border-input"
            />
          </TableCell>
          {/* Actions */}
          <TableCell className="py-1.5">
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => onRemoveProduct(product.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </TableCell>
        </TableRow>

        {/* Ligne de commentaire (expandable) */}
        {isExpanded && (
          <TableRow key={`comment-${product.id}`} className="bg-muted/10 hover:bg-muted/20">
            <TableCell colSpan={COL_COUNT} className="py-1.5 px-4">
              <div className="flex items-start gap-2 max-w-2xl">
                <MessageSquare className="h-3.5 w-3.5 mt-2 text-muted-foreground shrink-0" />
                <Textarea
                  value={product.productComment || ''}
                  onChange={e => onUpdateProduct({ ...product, productComment: e.target.value })}
                  placeholder="Ajouter un commentaire sur ce produit…"
                  className="min-h-[2rem] h-8 text-xs resize-none border-transparent bg-transparent hover:border-input focus:border-input"
                  rows={1}
                />
              </div>
            </TableCell>
          </TableRow>
        )}
      </>
    );
  };

  return (
    <SectionCard title="Pricing Produits">
      <div className="overflow-x-auto">
        <Table className="text-xs">
          <TableHeader>
            <TableRow className="border-b-2 border-border">
              <TableHead className="text-xs font-semibold">Produit</TableHead>
              <TableHead className="text-xs font-semibold text-center">Catégorie</TableHead>
              <TableHead className="text-xs font-semibold text-center">Lancement</TableHead>
              <TableHead className="text-xs font-semibold text-right">TTC B2C</TableHead>
              <TableHead className="text-xs font-semibold text-right">HT B2C</TableHead>
              <TableHead className="text-xs font-semibold text-right">HT B2B</TableHead>
              <TableHead className="text-xs font-semibold text-right">HT OEM</TableHead>
              <TableHead className="text-xs font-semibold text-right">Coût Unit.</TableHead>
              <TableHead className="text-xs font-semibold text-right">Marge B2C</TableHead>
              <TableHead className="text-xs font-semibold text-right">Marge B2B</TableHead>
              <TableHead className="text-xs font-semibold text-right">Marge OEM</TableHead>
              <TableHead className="text-xs font-semibold text-right">CAPEX R&D</TableHead>
              <TableHead className="text-xs font-semibold text-center">Amort.</TableHead>
              <TableHead className="text-xs font-semibold text-right">OPEX R&D</TableHead>
              <TableHead className="text-xs font-semibold text-right">OPEX Mktg</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {grouped.map(group => {
              const groupKey = group.catId || '__uncategorized__';
              const isCollapsed = collapsedGroups.has(groupKey);

              return (
                <> 
                  {group.catName && (
                    <TableRow key={`cat-${groupKey}`} className="bg-muted/50 hover:bg-muted/60 border-t-2 border-border/50">
                      <TableCell colSpan={COL_COUNT} className="py-2">
                        <button
                          onClick={() => toggleGroup(groupKey)}
                          className="flex items-center gap-2 font-semibold text-sm w-full text-left"
                        >
                          {isCollapsed
                            ? <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          }
                          {group.color && (
                            <span className="inline-block h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
                          )}
                          {group.catName}
                          <span className="text-xs text-muted-foreground font-normal">
                            ({group.products.length} produit{group.products.length > 1 ? 's' : ''})
                          </span>
                        </button>
                      </TableCell>
                    </TableRow>
                  )}
                  {!isCollapsed && group.products.map(renderProductRow)}
                </>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <Button variant="outline" size="sm" className="mt-4" onClick={handleAdd}>
        <Plus className="h-4 w-4 mr-1" /> Ajouter Produit
      </Button>
    </SectionCard>
  );
}
