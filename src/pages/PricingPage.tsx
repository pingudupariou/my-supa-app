import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useCostFlowData } from '@/hooks/useCostFlowData';
import { Settings2, Plus, Trash2, Tag, ChevronDown, ChevronRight, Package } from 'lucide-react';

interface SalesRule {
  id: string;
  name: string;
  type: 'b2b' | 'oem';
  intermediaries: { label: string; coefficient: number }[];
}

const DEFAULT_TVA = 20;

export function PricingPage() {
  const { products, productCategories, references, bom, calculateProductCost } = useCostFlowData();

  // Global settings
  const [distributorCoef, setDistributorCoef] = useState(1.3);
  const [shopCoef, setShopCoef] = useState(1.8);
  const [tvaRate, setTvaRate] = useState(DEFAULT_TVA);

  // Sales rules
  const [salesRules, setSalesRules] = useState<SalesRule[]>([
    {
      id: 'default-b2b',
      name: 'B2B Standard',
      type: 'b2b',
      intermediaries: [
        { label: 'Distributeur', coefficient: 1.3 },
        { label: 'Shop', coefficient: 1.8 },
      ],
    },
    {
      id: 'default-oem',
      name: 'OEM',
      type: 'oem',
      intermediaries: [
        { label: 'Partenaire OEM', coefficient: 1.4 },
      ],
    },
  ]);

  const [activeRuleId, setActiveRuleId] = useState('default-b2b');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleType, setNewRuleType] = useState<'b2b' | 'oem'>('b2b');

  const activeRule = salesRules.find(r => r.id === activeRuleId) || salesRules[0];

  // Update global coefficients in active rule
  const syncGlobalCoefs = () => {
    setSalesRules(prev => prev.map(rule => {
      if (rule.id !== activeRuleId) return rule;
      const updated = [...rule.intermediaries];
      if (updated.length >= 1) updated[0] = { ...updated[0], coefficient: distributorCoef };
      if (updated.length >= 2) updated[1] = { ...updated[1], coefficient: shopCoef };
      return { ...rule, intermediaries: updated };
    }));
  };

  // Products grouped by category
  const productsByCategory = useMemo(() => {
    const grouped: Record<string, typeof products> = {};
    const uncategorized: typeof products = [];

    for (const prod of products) {
      if (prod.category_id) {
        if (!grouped[prod.category_id]) grouped[prod.category_id] = [];
        grouped[prod.category_id].push(prod);
      } else {
        uncategorized.push(prod);
      }
    }
    return { grouped, uncategorized };
  }, [products]);

  const toggleCategory = (catId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  };

  // Calculate chain pricing for a product
  const computeChain = (costHT: number) => {
    if (!activeRule || costHT <= 0) return null;

    const chain: { label: string; buyPrice: number; coef: number; sellPrice: number; margin: number; marginPct: number }[] = [];
    let currentPrice = costHT; // Our selling price = cost for first intermediary

    // We sell to the first intermediary at costHT (our B2B price)
    // Each intermediary applies their coefficient
    for (const inter of activeRule.intermediaries) {
      const sellPrice = currentPrice * inter.coefficient;
      const margin = sellPrice - currentPrice;
      const marginPct = currentPrice > 0 ? (margin / currentPrice) * 100 : 0;
      chain.push({
        label: inter.label,
        buyPrice: currentPrice,
        coef: inter.coefficient,
        sellPrice,
        margin,
        marginPct,
      });
      currentPrice = sellPrice;
    }

    const prixPublicHT = currentPrice;
    const prixPublicTTC = prixPublicHT * (1 + tvaRate / 100);

    return { chain, prixPublicHT, prixPublicTTC };
  };

  // Add a new rule
  const addRule = () => {
    if (!newRuleName.trim()) return;
    const maxIntermediaries = newRuleType === 'oem' ? 1 : 2;
    const intermediaries = newRuleType === 'oem'
      ? [{ label: 'Partenaire OEM', coefficient: 1.4 }]
      : [{ label: 'Distributeur', coefficient: distributorCoef }, { label: 'Shop', coefficient: shopCoef }];

    const rule: SalesRule = {
      id: `rule-${Date.now()}`,
      name: newRuleName.trim(),
      type: newRuleType,
      intermediaries: intermediaries.slice(0, maxIntermediaries),
    };
    setSalesRules(prev => [...prev, rule]);
    setActiveRuleId(rule.id);
    setRuleDialogOpen(false);
    setNewRuleName('');
  };

  const deleteRule = (ruleId: string) => {
    setSalesRules(prev => prev.filter(r => r.id !== ruleId));
    if (activeRuleId === ruleId) setActiveRuleId(salesRules[0]?.id || '');
  };

  const updateIntermediary = (ruleId: string, index: number, field: 'label' | 'coefficient', value: string | number) => {
    setSalesRules(prev => prev.map(rule => {
      if (rule.id !== ruleId) return rule;
      const updated = [...rule.intermediaries];
      if (field === 'coefficient') {
        updated[index] = { ...updated[index], coefficient: Number(value) || 1 };
      } else {
        updated[index] = { ...updated[index], label: String(value) };
      }
      return { ...rule, intermediaries: updated };
    }));
  };

  const addIntermediary = (ruleId: string) => {
    setSalesRules(prev => prev.map(rule => {
      if (rule.id !== ruleId) return rule;
      const max = rule.type === 'oem' ? 1 : 2;
      if (rule.intermediaries.length >= max) return rule;
      return { ...rule, intermediaries: [...rule.intermediaries, { label: 'Intermédiaire', coefficient: 1.3 }] };
    }));
  };

  const removeIntermediary = (ruleId: string, index: number) => {
    setSalesRules(prev => prev.map(rule => {
      if (rule.id !== ruleId) return rule;
      if (rule.intermediaries.length <= 1) return rule;
      return { ...rule, intermediaries: rule.intermediaries.filter((_, i) => i !== index) };
    }));
  };

  const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const renderProductRow = (prod: typeof products[0]) => {
    const costPrice = calculateProductCost(prod.id, prod.default_volume || 500);
    const result = computeChain(costPrice);

    return (
      <TableRow key={prod.id}>
        <TableCell className="font-medium">{prod.name}</TableCell>
        <TableCell className="text-right font-mono">{fmt(costPrice)} €</TableCell>
        {activeRule?.intermediaries.map((inter, i) => {
          const step = result?.chain[i];
          return (
            <TableCell key={i} className="text-right font-mono">
              {step ? `${fmt(step.sellPrice)} €` : '–'}
            </TableCell>
          );
        })}
        <TableCell className="text-right font-mono font-semibold">
          {result ? `${fmt(result.prixPublicHT)} €` : '–'}
        </TableCell>
        <TableCell className="text-right font-mono font-semibold text-primary">
          {result ? `${fmt(result.prixPublicTTC)} €` : '–'}
        </TableCell>
        <TableCell className="text-right font-mono text-muted-foreground">
          {result && costPrice > 0 ? `${fmt(((result.prixPublicHT - costPrice) / costPrice) * 100)}%` : '–'}
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Pricing</h1>
        <p className="text-muted-foreground">
          Stratégie tarifaire B2B, chaîne de distribution et marges par produit
        </p>
      </div>

      {/* Global coefficients & TVA */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              Coef. Distributeur
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              type="number"
              step="0.01"
              value={distributorCoef}
              onChange={e => setDistributorCoef(Number(e.target.value) || 1)}
              onBlur={syncGlobalCoefs}
              className="font-mono"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              Coef. Shop
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              type="number"
              step="0.01"
              value={shopCoef}
              onChange={e => setShopCoef(Number(e.target.value) || 1)}
              onBlur={syncGlobalCoefs}
              className="font-mono"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Tag className="h-4 w-4" />
              TVA (%)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              type="number"
              step="0.1"
              value={tvaRate}
              onChange={e => setTvaRate(Number(e.target.value) || 0)}
              className="font-mono"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Chaîne active</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-xs text-muted-foreground">
              Nous → {activeRule?.intermediaries.map(i => i.label).join(' → ')} → Client final
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales Rules */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Règles de vente</CardTitle>
              <CardDescription>Configurez les canaux de distribution et leurs intermédiaires</CardDescription>
            </div>
            <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-1" />
                  Nouvelle règle
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nouvelle règle de vente</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Nom</Label>
                    <Input value={newRuleName} onChange={e => setNewRuleName(e.target.value)} placeholder="Ex: B2B Europe" />
                  </div>
                  <div>
                    <Label>Type</Label>
                    <Select value={newRuleType} onValueChange={v => setNewRuleType(v as 'b2b' | 'oem')}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="b2b">B2B (max 2 intermédiaires)</SelectItem>
                        <SelectItem value="oem">OEM (max 1 intermédiaire)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={addRule} className="w-full">Créer</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {salesRules.map(rule => (
              <Badge
                key={rule.id}
                variant={rule.id === activeRuleId ? 'default' : 'outline'}
                className="cursor-pointer text-sm py-1.5 px-3"
                onClick={() => setActiveRuleId(rule.id)}
              >
                {rule.name}
                <span className="ml-1 text-xs opacity-60">({rule.type.toUpperCase()})</span>
              </Badge>
            ))}
          </div>

          {activeRule && (
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">{activeRule.name}</h4>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{activeRule.type === 'oem' ? 'Max 1 intermédiaire' : 'Max 2 intermédiaires'}</Badge>
                  {salesRules.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteRule(activeRule.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline" className="bg-primary/5">Nous</Badge>
                {activeRule.intermediaries.map((inter, i) => (
                  <span key={i} className="flex items-center gap-2">
                    <span>→</span>
                    <Badge variant="outline">{inter.label} (×{inter.coefficient})</Badge>
                  </span>
                ))}
                <span>→</span>
                <Badge variant="outline" className="bg-primary/5">Client final</Badge>
              </div>

              <Separator />

              <div className="space-y-3">
                {activeRule.intermediaries.map((inter, i) => (
                  <div key={i} className="flex items-end gap-3">
                    <div className="flex-1">
                      <Label className="text-xs">Nom intermédiaire {i + 1}</Label>
                      <Input
                        value={inter.label}
                        onChange={e => updateIntermediary(activeRule.id, i, 'label', e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="w-28">
                      <Label className="text-xs">Coefficient</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={inter.coefficient}
                        onChange={e => updateIntermediary(activeRule.id, i, 'coefficient', e.target.value)}
                        className="h-8 text-sm font-mono"
                      />
                    </div>
                    {activeRule.intermediaries.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeIntermediary(activeRule.id, i)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}

                {activeRule.intermediaries.length < (activeRule.type === 'oem' ? 1 : 2) && (
                  <Button variant="outline" size="sm" onClick={() => addIntermediary(activeRule.id)}>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Ajouter intermédiaire
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pricing table by category */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5" />
            Détail des prix par catégorie
          </CardTitle>
          <CardDescription>
            Prix de revient → prix de vente B2B (1er maillon) → prix public HT/TTC via la chaîne "{activeRule?.name}"
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {productCategories.map(cat => {
              const catProducts = productsByCategory.grouped[cat.id] || [];
              if (catProducts.length === 0) return null;
              const isExpanded = expandedCategories.has(cat.id);

              return (
                <div key={cat.id} className="border rounded-lg overflow-hidden">
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                    onClick={() => toggleCategory(cat.id)}
                  >
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="font-semibold">{cat.name}</span>
                    <Badge variant="secondary" className="ml-auto">{catProducts.length} produit{catProducts.length > 1 ? 's' : ''}</Badge>
                  </button>

                  {isExpanded && (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Produit</TableHead>
                            <TableHead className="text-right">Coût revient HT</TableHead>
                            {activeRule?.intermediaries.map((inter, i) => (
                              <TableHead key={i} className="text-right">
                                Sortie {inter.label}
                              </TableHead>
                            ))}
                            <TableHead className="text-right">Prix Public HT</TableHead>
                            <TableHead className="text-right">Prix Public TTC</TableHead>
                            <TableHead className="text-right">Marge totale</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {catProducts.map(renderProductRow)}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Uncategorized products */}
            {productsByCategory.uncategorized.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                  onClick={() => toggleCategory('__uncategorized')}
                >
                  {expandedCategories.has('__uncategorized') ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <span className="font-semibold text-muted-foreground">Sans catégorie</span>
                  <Badge variant="secondary" className="ml-auto">{productsByCategory.uncategorized.length} produit{productsByCategory.uncategorized.length > 1 ? 's' : ''}</Badge>
                </button>

                {expandedCategories.has('__uncategorized') && (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produit</TableHead>
                          <TableHead className="text-right">Coût revient HT</TableHead>
                          {activeRule?.intermediaries.map((inter, i) => (
                            <TableHead key={i} className="text-right">
                              Sortie {inter.label}
                            </TableHead>
                          ))}
                          <TableHead className="text-right">Prix Public HT</TableHead>
                          <TableHead className="text-right">Prix Public TTC</TableHead>
                          <TableHead className="text-right">Marge totale</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {productsByCategory.uncategorized.map(renderProductRow)}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}

            {products.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>Aucun produit configuré. Ajoutez des produits dans le module Production et BE.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
