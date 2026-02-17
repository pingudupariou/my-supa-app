import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';

interface SalesRule {
  id: string;
  name: string;
  type: 'b2b' | 'oem' | 'b2c';
  tvaRate: number;
  intermediaries: { label: string; coefficient: number }[];
}

interface ProductCategory {
  id: string;
  name: string;
  color: string | null;
}

interface MarginChartProps {
  products: any[];
  productCategories: ProductCategory[];
  salesRules: SalesRule[];
  calculateProductCost: (productId: string, volume: number) => number;
  computeChainFromPublicTTC: (priceTTC: number, rule: SalesRule) => { ourB2BPrice: number } | null;
  getEffectivePrice: (prod: any) => number;
  editedOurPrices: Record<string, number>;
  pricingMode: 'from_public' | 'from_our_price';
}

const DEFAULT_CATEGORY_COLOR = 'hsl(var(--muted-foreground))';

export function MarginChart({
  products,
  productCategories,
  salesRules,
  calculateProductCost,
  computeChainFromPublicTTC,
  getEffectivePrice,
  editedOurPrices,
  pricingMode,
}: MarginChartProps) {
  const [chartPricingMode, setChartPricingMode] = useState<'from_public' | 'from_our_price'>('from_our_price');
  const [selectedRuleIds, setSelectedRuleIds] = useState<Set<string>>(
    new Set([salesRules[0]?.id].filter(Boolean))
  );
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(
    new Set(productCategories.map(c => c.id))
  );

  const toggleRule = (id: string) => {
    setSelectedRuleIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleCategory = (id: string) => {
    setSelectedCategoryIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredProducts = useMemo(
    () => products.filter(p => {
      if (!p.category_id) return selectedCategoryIds.has('__uncategorized');
      return selectedCategoryIds.has(p.category_id);
    }),
    [products, selectedCategoryIds]
  );

  const chartData = useMemo(() => {
    return filteredProducts.map(prod => {
      const costPrice = calculateProductCost(prod.id, prod.default_volume || 500);
      const cat = productCategories.find(c => c.id === prod.category_id);
      const catColor = cat?.color || DEFAULT_CATEGORY_COLOR;
      const entry: Record<string, any> = {
        name: prod.name.length > 15 ? prod.name.slice(0, 14) + '…' : prod.name,
        fullName: prod.name,
        costPrice,
        catColor,
        categoryName: cat?.name || 'Sans catégorie',
      };

      for (const rule of salesRules) {
        if (!selectedRuleIds.has(rule.id)) continue;

        const effectivePrice = getEffectivePrice(prod);
        const result = computeChainFromPublicTTC(effectivePrice, rule);

        let ourPrice = 0;
        if (chartPricingMode === 'from_public') {
          ourPrice = result?.ourB2BPrice || 0;
        } else {
          ourPrice = editedOurPrices[prod.id] !== undefined
            ? editedOurPrices[prod.id]
            : (result?.ourB2BPrice || 0);
        }

        const marginPct = costPrice > 0 ? ((ourPrice - costPrice) / costPrice) * 100 : 0;
        entry[`margin_${rule.id}`] = parseFloat(marginPct.toFixed(1));
      }

      return entry;
    });
  }, [filteredProducts, selectedRuleIds, salesRules, calculateProductCost, getEffectivePrice, computeChainFromPublicTTC, editedOurPrices, chartPricingMode]);

  const activeRules = salesRules.filter(r => selectedRuleIds.has(r.id));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Analyse des marges par produit</CardTitle>
        <CardDescription>Comparez les marges selon les règles de vente et catégories</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-6 items-start">
          <div className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Règles de vente</span>
            <div className="flex flex-wrap gap-2">
              {salesRules.map(rule => (
                <label key={rule.id} className="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox
                    checked={selectedRuleIds.has(rule.id)}
                    onCheckedChange={() => toggleRule(rule.id)}
                  />
                  <span className="text-sm">{rule.name}</span>
                  <Badge variant="outline" className="text-[10px] px-1 py-0">{rule.type.toUpperCase()}</Badge>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Catégories</span>
            <div className="flex flex-wrap gap-2">
              {productCategories.map(cat => (
                <label key={cat.id} className="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox
                    checked={selectedCategoryIds.has(cat.id)}
                    onCheckedChange={() => toggleCategory(cat.id)}
                  />
                  {cat.color && <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cat.color }} />}
                  <span className="text-sm">{cat.name}</span>
                </label>
              ))}
              {products.some(p => !p.category_id) && (
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox
                    checked={selectedCategoryIds.has('__uncategorized')}
                    onCheckedChange={() => toggleCategory('__uncategorized')}
                  />
                  <span className="text-sm text-muted-foreground">Sans catégorie</span>
                </label>
              )}
            </div>
          </div>
        </div>

        {/* Chart */}
        {chartData.length > 0 && activeRules.length > 0 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  angle={-30}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    const rule = salesRules.find(r => `margin_${r.id}` === name);
                    return [`${value.toFixed(1)}%`, rule?.name || name];
                  }}
                  labelFormatter={(label, payload) => {
                    const item = payload?.[0]?.payload;
                    return item?.fullName || label;
                  }}
                />
                <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="3 3" strokeWidth={1.5} />
                {activeRules.map((rule) => (
                  <Bar
                    key={rule.id}
                    dataKey={`margin_${rule.id}`}
                    name={`margin_${rule.id}`}
                    fill={DEFAULT_CATEGORY_COLOR}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={40}
                  >
                    {chartData.map((entry, idx) => {
                      const val = entry[`margin_${rule.id}`] ?? 0;
                      return (
                        <Cell
                          key={idx}
                          fill={val < 0 ? 'hsl(var(--destructive))' : entry.catColor}
                          fillOpacity={val < 0 ? 0.8 : 1}
                        />
                      );
                    })}
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
            Sélectionnez au moins une règle et une catégorie pour afficher le graphique.
          </div>
        )}

        {/* Legend */}
        {activeRules.length > 0 && (
          <div className="flex flex-wrap gap-4 justify-center text-xs">
            {productCategories.filter(c => selectedCategoryIds.has(c.id)).map(cat => (
              <div key={cat.id} className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: cat.color || DEFAULT_CATEGORY_COLOR }} />
                <span>{cat.name}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-sm bg-destructive opacity-80" />
              <span>Marge négative</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
