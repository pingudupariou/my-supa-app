import { useState, useMemo } from 'react';
import { CostFlowReference, CostFlowProduct, CostFlowBomEntry } from '@/hooks/useCostFlowData';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Search, ChevronRight, ChevronDown, ChevronUp, Package, Layers, AlertTriangle, BarChart3 } from 'lucide-react';

interface Props {
  references: CostFlowReference[];
  products: CostFlowProduct[];
  bom: CostFlowBomEntry[];
}

type ChartMode = 'refs-by-product' | 'products-by-ref' | 'qty-by-ref' | 'qty-by-product';
type ChartDirection = 'horizontal' | 'vertical';

const CHART_OPTIONS: { value: ChartMode; label: string }[] = [
  { value: 'refs-by-product', label: 'Nb références par produit' },
  { value: 'products-by-ref', label: 'Nb produits par référence' },
  { value: 'qty-by-ref', label: 'Quantité totale par référence' },
  { value: 'qty-by-product', label: 'Quantité totale par produit' },
];

export function ReferenceUsageMap({ references, products, bom }: Props) {
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'used' | 'unused'>('all');
  const [showChart, setShowChart] = useState(true);
  const [chartMode, setChartMode] = useState<ChartMode>('refs-by-product');
  const [chartDirection, setChartDirection] = useState<ChartDirection>('vertical');
  const [chartLimit, setChartLimit] = useState(15);

  const activeRefs = useMemo(() => references.filter(r => !r.deleted_at), [references]);
  const activeProducts = useMemo(() => products.filter(p => !p.deleted_at), [products]);

  const usageMap = useMemo(() => {
    return activeRefs
      .map(ref => {
        const entries = bom.filter(b => b.reference_id === ref.id);
        const usages = entries
          .map(e => {
            const product = activeProducts.find(p => p.id === e.product_id);
            return product ? { product, quantity: e.quantity } : null;
          })
          .filter(Boolean) as { product: CostFlowProduct; quantity: number }[];
        return { reference: ref, usages };
      })
      .sort((a, b) => b.usages.length - a.usages.length);
  }, [activeRefs, activeProducts, bom]);

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

  // Chart data
  const chartData = useMemo(() => {
    switch (chartMode) {
      case 'refs-by-product': {
        return activeProducts
          .map(p => ({
            name: p.name.length > 20 ? p.name.slice(0, 18) + '…' : p.name,
            fullName: p.name,
            value: bom.filter(b => b.product_id === p.id).length,
          }))
          .filter(d => d.value > 0)
          .sort((a, b) => b.value - a.value)
          .slice(0, chartLimit);
      }
      case 'products-by-ref': {
        return usageMap
          .filter(r => r.usages.length > 0)
          .map(r => ({
            name: r.reference.code,
            fullName: `${r.reference.code} — ${r.reference.name}`,
            value: r.usages.length,
          }))
          .slice(0, chartLimit);
      }
      case 'qty-by-ref': {
        return usageMap
          .map(r => ({
            name: r.reference.code,
            fullName: `${r.reference.code} — ${r.reference.name}`,
            value: r.usages.reduce((s, u) => s + u.quantity, 0),
          }))
          .filter(d => d.value > 0)
          .sort((a, b) => b.value - a.value)
          .slice(0, chartLimit);
      }
      case 'qty-by-product': {
        return activeProducts
          .map(p => {
            const total = bom
              .filter(b => b.product_id === p.id)
              .reduce((s, b) => s + b.quantity, 0);
            return {
              name: p.name.length > 20 ? p.name.slice(0, 18) + '…' : p.name,
              fullName: p.name,
              value: total,
            };
          })
          .filter(d => d.value > 0)
          .sort((a, b) => b.value - a.value)
          .slice(0, chartLimit);
      }
    }
  }, [chartMode, chartLimit, usageMap, activeProducts, bom]);

  const chartLabel = CHART_OPTIONS.find(o => o.value === chartMode)?.label || '';

  const totalRefs = usageMap.length;
  const usedRefs = usageMap.filter(r => r.usages.length > 0).length;
  const unusedRefs = totalRefs - usedRefs;

  const isHorizontal = chartDirection === 'horizontal';

  return (
    <div className="space-y-4">
      {/* Chart section */}
      <Card>
        <div
          className="flex items-center justify-between p-4 cursor-pointer select-none"
          onClick={() => setShowChart(!showChart)}
        >
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm">Graphique — Cas d'usage</span>
          </div>
          <Button variant="ghost" size="sm" className="h-7 px-2">
            {showChart ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>

        {showChart && (
          <CardContent className="pt-0 space-y-3">
            {/* Chart controls */}
            <div className="flex flex-wrap items-center gap-3">
              <Select value={chartMode} onValueChange={(v) => setChartMode(v as ChartMode)}>
                <SelectTrigger className="w-[240px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHART_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-1 border rounded-md">
                <Button
                  variant={chartDirection === 'vertical' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-8 px-2 text-xs rounded-r-none"
                  onClick={() => setChartDirection('vertical')}
                >
                  Vertical
                </Button>
                <Button
                  variant={chartDirection === 'horizontal' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-8 px-2 text-xs rounded-l-none"
                  onClick={() => setChartDirection('horizontal')}
                >
                  Horizontal
                </Button>
              </div>

              <Select value={String(chartLimit)} onValueChange={(v) => setChartLimit(Number(v))}>
                <SelectTrigger className="w-[100px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 15, 20, 30, 50].map(n => (
                    <SelectItem key={n} value={String(n)}>Top {n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Chart */}
            <div style={{ height: isHorizontal ? Math.max(300, chartData.length * 32) : 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                {isHorizontal ? (
                  <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value: number) => [value, chartLabel]}
                      labelFormatter={(label) => {
                        const item = chartData.find(d => d.name === label);
                        return item?.fullName || label;
                      }}
                    />
                    <Bar dataKey="value" name={chartLabel} fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                ) : (
                  <BarChart data={chartData} margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, angle: -35, textAnchor: 'end' }} height={70} />
                    <YAxis />
                    <Tooltip
                      formatter={(value: number) => [value, chartLabel]}
                      labelFormatter={(label) => {
                        const item = chartData.find(d => d.name === label);
                        return item?.fullName || label;
                      }}
                    />
                    <Bar dataKey="value" name={chartLabel} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </CardContent>
        )}
      </Card>

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
            <Package className="h-8 w-8 text-accent-foreground" />
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
