import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useCostFlowData } from '@/hooks/useCostFlowData';
import { Settings2, Plus, Trash2, Tag, ChevronDown, ChevronRight, Package, Copy, Check, ArrowDown, ArrowUp } from 'lucide-react';
import { toast } from 'sonner';

type PricingMode = 'from_public' | 'from_our_price';

interface SalesRule {
  id: string;
  name: string;
  type: 'b2b' | 'oem';
  tvaRate: number;
  intermediaries: { label: string; coefficient: number }[];
}

const DEFAULT_TVA = 20;

export function PricingPage() {
  const { products, productCategories, references, bom, calculateProductCost, updateProduct } = useCostFlowData();

  // Pricing mode
  const [pricingMode, setPricingMode] = useState<PricingMode>('from_public');

  // Global settings
  const [distributorCoef, setDistributorCoef] = useState(1.3);
  const [shopCoef, setShopCoef] = useState(1.8);

  // Sales rules
  const [salesRules, setSalesRules] = useState<SalesRule[]>([
    {
      id: 'default-b2b',
      name: 'B2B Standard',
      type: 'b2b',
      tvaRate: 20,
      intermediaries: [
        { label: 'Distributeur', coefficient: 1.3 },
        { label: 'Shop', coefficient: 1.8 },
      ],
    },
    {
      id: 'default-oem',
      name: 'OEM',
      type: 'oem',
      tvaRate: 0,
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

  // Editable prices (local overrides before save) - for public TTC mode
  const [editedPrices, setEditedPrices] = useState<Record<string, number>>({});
  // Editable our B2B prices - for our_price mode
  const [editedOurPrices, setEditedOurPrices] = useState<Record<string, number>>({});

  // Multi-select
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [bulkPrice, setBulkPrice] = useState('');
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);

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

  // Get the effective price_ttc (edited or from DB)
  const getEffectivePrice = (prod: typeof products[0]) => {
    return editedPrices[prod.id] !== undefined ? editedPrices[prod.id] : prod.price_ttc;
  };

  // OPTION 1: From public TTC price, compute our B2B price (reverse)
  const computeChainFromPublicTTC = (priceTTC: number) => {
    if (!activeRule || priceTTC <= 0) return null;

    const tvaRate = activeRule?.tvaRate ?? DEFAULT_TVA;
    const prixPublicHT = priceTTC / (1 + tvaRate / 100);

    // Reverse the chain to find our B2B selling price
    let currentPrice = prixPublicHT;
    const intermediaries = [...activeRule.intermediaries].reverse();
    for (const inter of intermediaries) {
      currentPrice = currentPrice / inter.coefficient;
    }

    const ourB2BPrice = currentPrice;

    // Forward chain for display
    const chain: { label: string; buyPrice: number; coef: number; sellPrice: number; margin: number; marginPct: number }[] = [];
    let forwardPrice = ourB2BPrice;
    for (const inter of activeRule.intermediaries) {
      const sellPrice = forwardPrice * inter.coefficient;
      const margin = sellPrice - forwardPrice;
      const marginPct = forwardPrice > 0 ? (margin / forwardPrice) * 100 : 0;
      chain.push({ label: inter.label, buyPrice: forwardPrice, coef: inter.coefficient, sellPrice, margin, marginPct });
      forwardPrice = sellPrice;
    }

    return { chain, ourB2BPrice, prixPublicHT, prixPublicTTC: priceTTC };
  };

  // OPTION 2: From our B2B price, compute public TTC price (forward)
  const computeChainFromOurPrice = (ourPrice: number) => {
    if (!activeRule || ourPrice <= 0) return null;

    const tvaRate = activeRule?.tvaRate ?? DEFAULT_TVA;

    const chain: { label: string; buyPrice: number; coef: number; sellPrice: number; margin: number; marginPct: number }[] = [];
    let forwardPrice = ourPrice;
    for (const inter of activeRule.intermediaries) {
      const sellPrice = forwardPrice * inter.coefficient;
      const margin = sellPrice - forwardPrice;
      const marginPct = forwardPrice > 0 ? (margin / forwardPrice) * 100 : 0;
      chain.push({ label: inter.label, buyPrice: forwardPrice, coef: inter.coefficient, sellPrice, margin, marginPct });
      forwardPrice = sellPrice;
    }

    const prixPublicHT = forwardPrice;
    const prixPublicTTC = prixPublicHT * (1 + tvaRate / 100);

    return { chain, ourB2BPrice: ourPrice, prixPublicHT, prixPublicTTC };
  };

  // Save a single product price
  const saveProductPrice = useCallback(async (productId: string, priceTTC: number) => {
    await updateProduct(productId, { price_ttc: priceTTC });
    setEditedPrices(prev => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
    setEditedOurPrices(prev => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  }, [updateProduct]);

  // Bulk apply price
  const applyBulkPrice = async () => {
    const price = parseFloat(bulkPrice);
    if (isNaN(price) || price < 0) return;

    if (pricingMode === 'from_public') {
      const promises = Array.from(selectedProducts).map(id =>
        updateProduct(id, { price_ttc: price })
      );
      await Promise.all(promises);
      toast.success(`Prix ${price.toFixed(2)} € TTC appliqué à ${selectedProducts.size} produit(s)`);
    } else {
      // From our price mode: compute the TTC and save it
      const result = computeChainFromOurPrice(price);
      if (result) {
        const promises = Array.from(selectedProducts).map(id =>
          updateProduct(id, { price_ttc: result.prixPublicTTC })
        );
        await Promise.all(promises);
        toast.success(`Notre prix ${price.toFixed(2)} € HT appliqué → TTC ${result.prixPublicTTC.toFixed(2)} € pour ${selectedProducts.size} produit(s)`);
      }
    }
    setSelectedProducts(new Set());
    setBulkPrice('');
    setBulkDialogOpen(false);
    setEditedPrices({});
    setEditedOurPrices({});
  };

  // Toggle product selection
  const toggleSelect = (productId: string) => {
    setSelectedProducts(prev => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  // Select all in a category
  const toggleSelectCategory = (catId: string) => {
    const catProducts = catId === '__uncategorized'
      ? productsByCategory.uncategorized
      : (productsByCategory.grouped[catId] || []);
    const allSelected = catProducts.every(p => selectedProducts.has(p.id));

    setSelectedProducts(prev => {
      const next = new Set(prev);
      catProducts.forEach(p => {
        if (allSelected) next.delete(p.id);
        else next.add(p.id);
      });
      return next;
    });
  };

  // Sales rule management
  const addRule = () => {
    if (!newRuleName.trim()) return;
    const intermediaries = newRuleType === 'oem'
      ? [{ label: 'Partenaire OEM', coefficient: 1.4 }]
      : [{ label: 'Distributeur', coefficient: distributorCoef }, { label: 'Shop', coefficient: shopCoef }];
    const rule: SalesRule = {
      id: `rule-${Date.now()}`,
      name: newRuleName.trim(),
      type: newRuleType,
      tvaRate: 20,
      intermediaries,
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
      if (field === 'coefficient') updated[index] = { ...updated[index], coefficient: Number(value) || 1 };
      else updated[index] = { ...updated[index], label: String(value) };
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
    const isSelected = selectedProducts.has(prod.id);

    if (pricingMode === 'from_public') {
      // Option 1: fix public TTC → compute our price
      const effectivePrice = getEffectivePrice(prod);
      const result = computeChainFromPublicTTC(effectivePrice);
      const isEdited = editedPrices[prod.id] !== undefined;

      return (
        <TableRow key={prod.id} className={isSelected ? 'bg-primary/5' : ''}>
          <TableCell className="w-10">
            <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(prod.id)} />
          </TableCell>
          <TableCell className="font-medium">{prod.name}</TableCell>
          <TableCell className="text-right font-mono text-sm">{costPrice > 0 ? `${fmt(costPrice)} €` : '–'}</TableCell>
          <TableCell className="text-right font-mono text-sm font-semibold text-primary">
            {result ? `${fmt(result.ourB2BPrice)} €` : '–'}
          </TableCell>
          {activeRule?.intermediaries.map((inter, i) => {
            const step = result?.chain[i];
            return (
              <TableCell key={i} className="text-right font-mono text-sm">
                {step ? (
                  <span className="text-muted-foreground">
                    {fmt(step.buyPrice)} → <span className="text-foreground">{fmt(step.sellPrice)} €</span>
                    <span className="text-xs ml-1 opacity-60">(×{step.coef})</span>
                  </span>
                ) : '–'}
              </TableCell>
            );
          })}
          <TableCell className="text-right font-mono text-sm">{result ? `${fmt(result.prixPublicHT)} €` : '–'}</TableCell>
          <TableCell className="w-36">
            <div className="flex items-center gap-1">
              <Input
                type="number"
                step="0.01"
                className="h-8 text-sm font-mono w-24 text-right border-primary/30 bg-primary/5"
                value={effectivePrice || ''}
                onChange={e => {
                  const val = parseFloat(e.target.value);
                  setEditedPrices(prev => ({ ...prev, [prod.id]: isNaN(val) ? 0 : val }));
                }}
                placeholder="0.00"
              />
              <span className="text-xs text-muted-foreground">€</span>
            </div>
          </TableCell>
          <TableCell className="text-right font-mono text-sm text-muted-foreground">
            {result && costPrice > 0
              ? `${fmt(((result.ourB2BPrice - costPrice) / costPrice) * 100)}%`
              : '–'}
          </TableCell>
          <TableCell className="w-10">
            {isEdited && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => saveProductPrice(prod.id, editedPrices[prod.id])} title="Enregistrer">
                <Check className="h-3.5 w-3.5" />
              </Button>
            )}
          </TableCell>
        </TableRow>
      );
    } else {
      // Option 2: fix our B2B price → compute public TTC
      const effectiveTTC = getEffectivePrice(prod);
      const reverseResult = computeChainFromPublicTTC(effectiveTTC);
      const currentOurPrice = editedOurPrices[prod.id] !== undefined
        ? editedOurPrices[prod.id]
        : (reverseResult?.ourB2BPrice || 0);
      const result = computeChainFromOurPrice(currentOurPrice);
      const isEdited = editedOurPrices[prod.id] !== undefined;

      return (
        <TableRow key={prod.id} className={isSelected ? 'bg-primary/5' : ''}>
          <TableCell className="w-10">
            <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(prod.id)} />
          </TableCell>
          <TableCell className="font-medium">{prod.name}</TableCell>
          <TableCell className="text-right font-mono text-sm">{costPrice > 0 ? `${fmt(costPrice)} €` : '–'}</TableCell>
          <TableCell className="w-36">
            <div className="flex items-center gap-1">
              <Input
                type="number"
                step="0.01"
                className="h-8 text-sm font-mono w-24 text-right border-primary/30 bg-primary/5"
                value={currentOurPrice || ''}
                onChange={e => {
                  const val = parseFloat(e.target.value);
                  setEditedOurPrices(prev => ({ ...prev, [prod.id]: isNaN(val) ? 0 : val }));
                }}
                placeholder="0.00"
              />
              <span className="text-xs text-muted-foreground">€</span>
            </div>
          </TableCell>
          {activeRule?.intermediaries.map((inter, i) => {
            const step = result?.chain[i];
            return (
              <TableCell key={i} className="text-right font-mono text-sm">
                {step ? (
                  <span className="text-muted-foreground">
                    {fmt(step.buyPrice)} → <span className="text-foreground">{fmt(step.sellPrice)} €</span>
                    <span className="text-xs ml-1 opacity-60">(×{step.coef})</span>
                  </span>
                ) : '–'}
              </TableCell>
            );
          })}
          <TableCell className="text-right font-mono text-sm">{result ? `${fmt(result.prixPublicHT)} €` : '–'}</TableCell>
          <TableCell className="text-right font-mono text-sm font-semibold text-primary">
            {result ? `${fmt(result.prixPublicTTC)} €` : '–'}
          </TableCell>
          <TableCell className="text-right font-mono text-sm text-muted-foreground">
            {result && costPrice > 0
              ? `${fmt(((currentOurPrice - costPrice) / costPrice) * 100)}%`
              : '–'}
          </TableCell>
          <TableCell className="w-10">
            {isEdited && result && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => saveProductPrice(prod.id, result.prixPublicTTC)} title="Enregistrer">
                <Check className="h-3.5 w-3.5" />
              </Button>
            )}
          </TableCell>
        </TableRow>
      );
    }
  };

  const renderCategoryTable = (catProducts: typeof products, catId: string) => {
    const allSelected = catProducts.length > 0 && catProducts.every(p => selectedProducts.has(p.id));
    const someSelected = catProducts.some(p => selectedProducts.has(p.id));

    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={() => toggleSelectCategory(catId)}
                  className={someSelected && !allSelected ? 'opacity-50' : ''}
                />
              </TableHead>
              <TableHead>Produit</TableHead>
              <TableHead className="text-right">Coût revient</TableHead>
              {pricingMode === 'from_public' ? (
                <>
                  <TableHead className="text-right">Notre prix HT <span className="text-xs opacity-60">(calculé)</span></TableHead>
                  {activeRule?.intermediaries.map((inter, i) => (
                    <TableHead key={i} className="text-right">{inter.label}</TableHead>
                  ))}
                  <TableHead className="text-right">Prix Public HT</TableHead>
                  <TableHead className="text-right">
                    <span className="flex items-center justify-end gap-1">
                      <ArrowDown className="h-3 w-3 text-primary" />
                      Prix Public TTC
                    </span>
                  </TableHead>
                </>
              ) : (
                <>
                  <TableHead className="text-right">
                    <span className="flex items-center justify-end gap-1">
                      <ArrowDown className="h-3 w-3 text-primary" />
                      Notre prix HT
                    </span>
                  </TableHead>
                  {activeRule?.intermediaries.map((inter, i) => (
                    <TableHead key={i} className="text-right">{inter.label}</TableHead>
                  ))}
                  <TableHead className="text-right">Prix Public HT</TableHead>
                  <TableHead className="text-right">Prix Public TTC <span className="text-xs opacity-60">(calculé)</span></TableHead>
                </>
              )}
              <TableHead className="text-right">Notre marge</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {catProducts.map(renderProductRow)}
          </TableBody>
        </Table>
      </div>
    );
  };

  const hasEdits = pricingMode === 'from_public'
    ? Object.keys(editedPrices).length > 0
    : Object.keys(editedOurPrices).length > 0;

  const saveAllEdits = async () => {
    if (pricingMode === 'from_public') {
      const promises = Object.entries(editedPrices).map(([id, price]) =>
        updateProduct(id, { price_ttc: price })
      );
      await Promise.all(promises);
      toast.success(`${Object.keys(editedPrices).length} prix mis à jour`);
      setEditedPrices({});
    } else {
      const entries = Object.entries(editedOurPrices);
      const promises = entries.map(([id, ourPrice]) => {
        const result = computeChainFromOurPrice(ourPrice);
        return result ? updateProduct(id, { price_ttc: result.prixPublicTTC }) : Promise.resolve();
      });
      await Promise.all(promises);
      toast.success(`${entries.length} prix mis à jour`);
      setEditedOurPrices({});
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pricing</h1>
          <p className="text-muted-foreground">
            Stratégie tarifaire, chaîne de distribution et marges par produit
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedProducts.size > 0 && (
            <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Copy className="h-4 w-4 mr-1" />
                  Appliquer un prix ({selectedProducts.size})
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Appliquer un prix à {selectedProducts.size} produit(s)</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    Produits sélectionnés :
                    <ul className="mt-1 list-disc pl-4">
                      {Array.from(selectedProducts).map(id => {
                        const p = products.find(pr => pr.id === id);
                        return p ? <li key={id}>{p.name}</li> : null;
                      })}
                    </ul>
                  </div>
                  <div>
                    <Label>{pricingMode === 'from_public' ? 'Prix Public TTC (€)' : 'Notre Prix de Vente HT (€)'}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={bulkPrice}
                      onChange={e => setBulkPrice(e.target.value)}
                      placeholder="Ex: 299.00"
                      className="font-mono"
                    />
                  </div>
                  <Button onClick={applyBulkPrice} className="w-full">
                    Appliquer à {selectedProducts.size} produit(s)
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
          {hasEdits && (
            <Button size="sm" onClick={saveAllEdits}>
              <Check className="h-4 w-4 mr-1" />
              Enregistrer tout ({pricingMode === 'from_public' ? Object.keys(editedPrices).length : Object.keys(editedOurPrices).length})
            </Button>
          )}
        </div>
      </div>

      {/* Pricing Mode Selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Mode de tarification</CardTitle>
          <CardDescription>Choisissez votre point de départ pour fixer les prix</CardDescription>
        </CardHeader>
        <CardContent>
          <ToggleGroup
            type="single"
            value={pricingMode}
            onValueChange={v => { if (v) setPricingMode(v as PricingMode); }}
            className="justify-start"
          >
            <ToggleGroupItem value="from_public" className="flex items-center gap-2 px-4 py-3 h-auto data-[state=on]:bg-primary/10 data-[state=on]:border-primary">
              <ArrowUp className="h-4 w-4" />
              <div className="text-left">
                <div className="font-semibold text-sm">Option 1 — Depuis le prix public</div>
                <div className="text-xs text-muted-foreground">Fixer le prix TTC client final → notre prix de vente est calculé en remontant la chaîne</div>
              </div>
            </ToggleGroupItem>
            <ToggleGroupItem value="from_our_price" className="flex items-center gap-2 px-4 py-3 h-auto data-[state=on]:bg-primary/10 data-[state=on]:border-primary">
              <ArrowDown className="h-4 w-4" />
              <div className="text-left">
                <div className="font-semibold text-sm">Option 2 — Depuis notre prix de vente</div>
                <div className="text-xs text-muted-foreground">Fixer notre prix HT B2B/OEM → le prix public client final est calculé en descendant la chaîne</div>
              </div>
            </ToggleGroupItem>
          </ToggleGroup>
        </CardContent>
      </Card>

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
            <Input type="number" step="0.01" value={distributorCoef} onChange={e => setDistributorCoef(Number(e.target.value) || 1)} onBlur={syncGlobalCoefs} className="font-mono" />
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
            <Input type="number" step="0.01" value={shopCoef} onChange={e => setShopCoef(Number(e.target.value) || 1)} onBlur={syncGlobalCoefs} className="font-mono" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Tag className="h-4 w-4" />
              TVA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-mono font-semibold">{activeRule?.tvaRate ?? 20} %</div>
            <p className="text-xs text-muted-foreground mt-1">Défini dans la règle active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Chaîne active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              {pricingMode === 'from_public'
                ? `Client final → ${[...activeRule?.intermediaries || []].reverse().map(i => i.label).join(' → ')} → Nous`
                : `Nous → ${activeRule?.intermediaries.map(i => i.label).join(' → ')} → Client final`
              }
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

              <div className="flex items-end gap-3 mb-2">
                <div className="w-40">
                  <Label className="text-xs">Taux de TVA</Label>
                  <Select
                    value={String(activeRule.tvaRate)}
                    onValueChange={v => setSalesRules(prev => prev.map(r =>
                      r.id === activeRule.id ? { ...r, tvaRate: Number(v) } : r
                    ))}
                  >
                    <SelectTrigger className="h-8 text-sm font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="20">20 %</SelectItem>
                      <SelectItem value="0">0 % (exonéré)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3">
                {activeRule.intermediaries.map((inter, i) => (
                  <div key={i} className="flex items-end gap-3">
                    <div className="flex-1">
                      <Label className="text-xs">Nom intermédiaire {i + 1}</Label>
                      <Input value={inter.label} onChange={e => updateIntermediary(activeRule.id, i, 'label', e.target.value)} className="h-8 text-sm" />
                    </div>
                    <div className="w-28">
                      <Label className="text-xs">Coefficient</Label>
                      <Input type="number" step="0.01" value={inter.coefficient} onChange={e => updateIntermediary(activeRule.id, i, 'coefficient', e.target.value)} className="h-8 text-sm font-mono" />
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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5" />
                Détail des prix par catégorie
              </CardTitle>
              <CardDescription>
                {pricingMode === 'from_public'
                  ? `Fixez le prix public TTC → notre prix de vente est calculé via la chaîne "${activeRule?.name}"`
                  : `Fixez notre prix de vente HT → le prix public TTC est calculé via la chaîne "${activeRule?.name}"`
                }
              </CardDescription>
            </div>
            {selectedProducts.size > 0 && (
              <div className="text-sm text-muted-foreground">
                {selectedProducts.size} produit(s) sélectionné(s)
              </div>
            )}
          </div>
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
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: cat.color }} />
                    <span className="font-semibold">{cat.name}</span>
                    <Badge variant="secondary" className="ml-auto">{catProducts.length} produit{catProducts.length > 1 ? 's' : ''}</Badge>
                  </button>
                  {isExpanded && renderCategoryTable(catProducts, cat.id)}
                </div>
              );
            })}

            {productsByCategory.uncategorized.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                  onClick={() => toggleCategory('__uncategorized')}
                >
                  {expandedCategories.has('__uncategorized') ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <span className="font-semibold text-muted-foreground">Sans catégorie</span>
                  <Badge variant="secondary" className="ml-auto">{productsByCategory.uncategorized.length}</Badge>
                </button>
                {expandedCategories.has('__uncategorized') && renderCategoryTable(productsByCategory.uncategorized, '__uncategorized')}
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