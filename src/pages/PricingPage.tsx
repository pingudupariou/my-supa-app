import { useState, useMemo, useCallback, useEffect } from 'react';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useCostFlowData } from '@/hooks/useCostFlowData';
import { Settings2, Plus, Trash2, Tag, ChevronDown, ChevronRight, Package, Copy, Check, ArrowDown, ArrowUp, ArrowUpDown, Save, Loader2 } from 'lucide-react';
import { MarginChart } from '@/components/pricing/MarginChart';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

type PricingMode = 'from_public' | 'from_our_price';
type MarginSort = 'none' | 'asc' | 'desc';

// Per-rule price maps
type PerRulePrices = Record<string, Record<string, number>>;
type PerRuleCoefs = Record<string, Record<string, number[]>>;

interface SalesRule {
  id: string;
  name: string;
  type: 'b2b' | 'oem' | 'b2c';
  tvaRate: number;
  intermediaries: { label: string; coefficient: number }[];
}

const DEFAULT_TVA = 20;

export function PricingPage() {
  const { products, productCategories, references, bom, calculateProductCost, updateProduct } = useCostFlowData();

  const [pricingMode] = useState<PricingMode>('from_our_price');
  const [distributorCoef, setDistributorCoef] = useState(1.3);
  const [shopCoef, setShopCoef] = useState(1.8);

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
  const [newRuleType, setNewRuleType] = useState<'b2b' | 'oem' | 'b2c'>('b2b');

  // Per-rule edited prices
  const [editedPrices, setEditedPrices] = useState<PerRulePrices>({});
  const [editedOurPrices, setEditedOurPrices] = useState<PerRulePrices>({});
  const [editedFinalPrices, setEditedFinalPrices] = useState<PerRulePrices>({});
  const [editedProductCoefs, setEditedProductCoefs] = useState<PerRuleCoefs>({});

  const [marginSort, setMarginSort] = useState<MarginSort>('none');
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [bulkPrice, setBulkPrice] = useState('');
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);

  // Category bulk price
  const [catBulkTarget, setCatBulkTarget] = useState<{ catId: string; catName: string; field: 'our_price' | 'public_ttc' } | null>(null);
  const [catBulkPrice, setCatBulkPrice] = useState('');

  // Delete confirmation
  const [ruleToDelete, setRuleToDelete] = useState<string | null>(null);

  const activeRule = salesRules.find(r => r.id === activeRuleId) || salesRules[0];

  // Helpers to get per-rule price for current active rule
  const getRuleEditedPrices = () => editedPrices[activeRuleId] || {};
  const getRuleEditedOurPrices = () => editedOurPrices[activeRuleId] || {};
  const getRuleEditedFinalPrices = () => editedFinalPrices[activeRuleId] || {};
  const getRuleEditedCoefs = () => editedProductCoefs[activeRuleId] || {};

  const setRuleEditedPrice = (productId: string, value: number) => {
    setEditedPrices(prev => ({
      ...prev,
      [activeRuleId]: { ...(prev[activeRuleId] || {}), [productId]: value },
    }));
  };

  const setRuleEditedOurPrice = (productId: string, value: number) => {
    setEditedOurPrices(prev => ({
      ...prev,
      [activeRuleId]: { ...(prev[activeRuleId] || {}), [productId]: value },
    }));
    // Reset custom coefs for this product in this rule
    setEditedProductCoefs(prev => {
      const rulePrices = { ...(prev[activeRuleId] || {}) };
      delete rulePrices[productId];
      return { ...prev, [activeRuleId]: rulePrices };
    });
  };

  const setRuleEditedFinalPrice = (productId: string, value: number) => {
    setEditedFinalPrices(prev => ({
      ...prev,
      [activeRuleId]: { ...(prev[activeRuleId] || {}), [productId]: value },
    }));
    setEditedProductCoefs(prev => {
      const rulePrices = { ...(prev[activeRuleId] || {}) };
      delete rulePrices[productId];
      return { ...prev, [activeRuleId]: rulePrices };
    });
  };

  // Build config to save
  const buildConfigData = () => {
    return {
      pricingMode,
      distributorCoef,
      shopCoef,
      salesRules,
      activeRuleId,
      editedPrices,
      editedOurPrices,
      editedFinalPrices,
      editedProductCoefs,
    };
  };

  // Load config
  useEffect(() => {
    const loadConfig = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('pricing_config')
        .select('config_data')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data?.config_data) {
        const cfg = data.config_data as any;
        // pricingMode is now always 'from_our_price'
        if (cfg.distributorCoef !== undefined) setDistributorCoef(cfg.distributorCoef);
        if (cfg.shopCoef !== undefined) setShopCoef(cfg.shopCoef);
        if (cfg.salesRules?.length) setSalesRules(cfg.salesRules);
        if (cfg.activeRuleId) setActiveRuleId(cfg.activeRuleId);

        // Handle both old flat format and new per-rule format
        if (cfg.editedPrices) {
          // Check if it's already per-rule (object of objects) or flat (old format)
          const firstKey = Object.keys(cfg.editedPrices)[0];
          if (firstKey && typeof cfg.editedPrices[firstKey] === 'object' && !Array.isArray(cfg.editedPrices[firstKey])) {
            setEditedPrices(cfg.editedPrices);
          } else if (firstKey && typeof cfg.editedPrices[firstKey] === 'number') {
            // Migrate old flat format to per-rule under the first rule
            const ruleId = cfg.activeRuleId || cfg.salesRules?.[0]?.id || 'default-b2b';
            setEditedPrices({ [ruleId]: cfg.editedPrices });
          }
        }
        if (cfg.editedOurPrices) {
          const firstKey = Object.keys(cfg.editedOurPrices)[0];
          if (firstKey && typeof cfg.editedOurPrices[firstKey] === 'object' && !Array.isArray(cfg.editedOurPrices[firstKey])) {
            setEditedOurPrices(cfg.editedOurPrices);
          } else if (firstKey && typeof cfg.editedOurPrices[firstKey] === 'number') {
            const ruleId = cfg.activeRuleId || cfg.salesRules?.[0]?.id || 'default-b2b';
            setEditedOurPrices({ [ruleId]: cfg.editedOurPrices });
          }
        }
        if (cfg.editedFinalPrices) {
          const firstKey = Object.keys(cfg.editedFinalPrices)[0];
          if (firstKey && typeof cfg.editedFinalPrices[firstKey] === 'object' && !Array.isArray(cfg.editedFinalPrices[firstKey])) {
            setEditedFinalPrices(cfg.editedFinalPrices);
          } else if (firstKey && typeof cfg.editedFinalPrices[firstKey] === 'number') {
            const ruleId = cfg.activeRuleId || cfg.salesRules?.[0]?.id || 'default-b2b';
            setEditedFinalPrices({ [ruleId]: cfg.editedFinalPrices });
          }
        }
        if (cfg.editedProductCoefs) {
          const firstKey = Object.keys(cfg.editedProductCoefs)[0];
          if (firstKey && Array.isArray(cfg.editedProductCoefs[firstKey])) {
            // Old flat format
            const ruleId = cfg.activeRuleId || cfg.salesRules?.[0]?.id || 'default-b2b';
            setEditedProductCoefs({ [ruleId]: cfg.editedProductCoefs });
          } else {
            setEditedProductCoefs(cfg.editedProductCoefs);
          }
        }
      }
      setConfigLoaded(true);
    };
    loadConfig();
  }, []);

  const savePricingConfig = async () => {
    setSavingConfig(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Vous devez être connecté pour sauvegarder');
        return;
      }

      const configData = buildConfigData();

      const { error } = await supabase
        .from('pricing_config')
        .upsert({
          user_id: user.id,
          config_data: configData,
        }, { onConflict: 'user_id' });

      if (error) throw error;
      toast.success('Configuration pricing sauvegardée');
    } catch (err: any) {
      toast.error(`Erreur: ${err.message}`);
    } finally {
      setSavingConfig(false);
    }
  };

  const syncGlobalCoefs = () => {
    setSalesRules(prev => prev.map(rule => {
      if (rule.id !== activeRuleId) return rule;
      const updated = [...rule.intermediaries];
      if (updated.length >= 1) updated[0] = { ...updated[0], coefficient: distributorCoef };
      if (updated.length >= 2) updated[1] = { ...updated[1], coefficient: shopCoef };
      return { ...rule, intermediaries: updated };
    }));
  };

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

  const getEffectivePrice = (prod: typeof products[0]) => {
    const rulePrices = getRuleEditedPrices();
    return rulePrices[prod.id] !== undefined ? rulePrices[prod.id] : prod.price_ttc;
  };

  const computeChainFromPublicTTC = (priceTTC: number, ruleOverride?: typeof activeRule) => {
    const rule = ruleOverride || activeRule;
    if (!rule || priceTTC <= 0) return null;

    const tvaRate = rule?.tvaRate ?? DEFAULT_TVA;
    const prixPublicHT = priceTTC / (1 + tvaRate / 100);

    let currentPrice = prixPublicHT;
    const intermediaries = [...rule.intermediaries].reverse();
    for (const inter of intermediaries) {
      currentPrice = currentPrice / inter.coefficient;
    }

    const ourB2BPrice = currentPrice;

    const chain: { label: string; buyPrice: number; coef: number; sellPrice: number; margin: number; marginPct: number }[] = [];
    let forwardPrice = ourB2BPrice;
    for (const inter of rule.intermediaries) {
      const sellPrice = forwardPrice * inter.coefficient;
      const margin = sellPrice - forwardPrice;
      const marginPct = forwardPrice > 0 ? (margin / forwardPrice) * 100 : 0;
      chain.push({ label: inter.label, buyPrice: forwardPrice, coef: inter.coefficient, sellPrice, margin, marginPct });
      forwardPrice = sellPrice;
    }

    return { chain, ourB2BPrice, prixPublicHT, prixPublicTTC: priceTTC };
  };

  const computeChainBothEnds = (ourPrice: number, finalTTC: number, customCoefs?: number[]) => {
    if (!activeRule || ourPrice <= 0 || finalTTC <= 0) return null;

    const tvaRate = activeRule?.tvaRate ?? DEFAULT_TVA;
    const prixPublicHT = finalTTC / (1 + tvaRate / 100);
    const totalCoef = prixPublicHT / ourPrice;
    const n = activeRule.intermediaries.length;

    if (totalCoef <= 0) return null;

    if (n === 0) {
      return { chain: [], ourB2BPrice: ourPrice, prixPublicHT, prixPublicTTC: finalTTC, totalCoef, coefs: [] };
    }

    let coefs: number[];
    if (customCoefs && customCoefs.length === n) {
      coefs = customCoefs;
    } else {
      const equalCoef = Math.pow(totalCoef, 1 / n);
      coefs = Array(n).fill(equalCoef);
    }

    const chain: { label: string; buyPrice: number; coef: number; sellPrice: number; margin: number; marginPct: number }[] = [];
    let forwardPrice = ourPrice;
    for (let i = 0; i < n; i++) {
      const sellPrice = forwardPrice * coefs[i];
      const margin = sellPrice - forwardPrice;
      const marginPct = forwardPrice > 0 ? (margin / forwardPrice) * 100 : 0;
      chain.push({
        label: activeRule.intermediaries[i].label,
        buyPrice: forwardPrice,
        coef: coefs[i],
        sellPrice,
        margin,
        marginPct,
      });
      forwardPrice = sellPrice;
    }

    return { chain, ourB2BPrice: ourPrice, prixPublicHT, prixPublicTTC: finalTTC, totalCoef, coefs };
  };

  const handleProductCoefChange = (productId: string, index: number, newCoef: number, totalCoef: number) => {
    const n = activeRule?.intermediaries.length || 1;
    if (n <= 1) {
      setEditedProductCoefs(prev => ({
        ...prev,
        [activeRuleId]: { ...(prev[activeRuleId] || {}), [productId]: [totalCoef] },
      }));
      return;
    }
    const clampedCoef = Math.max(1.01, Math.min(newCoef, totalCoef / 1.01));
    const remainingCoef = totalCoef / clampedCoef;
    const newCoefs = index === 0 ? [clampedCoef, remainingCoef] : [remainingCoef, clampedCoef];
    setEditedProductCoefs(prev => ({
      ...prev,
      [activeRuleId]: { ...(prev[activeRuleId] || {}), [productId]: newCoefs },
    }));
  };

  const saveProductPrice = useCallback(async (productId: string, priceTTC: number) => {
    await updateProduct(productId, { price_ttc: priceTTC });
    // Clean up final price edits but keep our price (rule-specific)
    setEditedPrices(prev => {
      const rulePrices = { ...(prev[activeRuleId] || {}) };
      delete rulePrices[productId];
      return { ...prev, [activeRuleId]: rulePrices };
    });
    setEditedFinalPrices(prev => {
      const rulePrices = { ...(prev[activeRuleId] || {}) };
      delete rulePrices[productId];
      return { ...prev, [activeRuleId]: rulePrices };
    });
  }, [updateProduct, activeRuleId]);

  const applyBulkPrice = async () => {
    const price = parseFloat(bulkPrice);
    if (isNaN(price) || price < 0) return;

    const promises = Array.from(selectedProducts).map(id =>
      updateProduct(id, { price_ttc: price })
    );
    await Promise.all(promises);
    toast.success(`Prix ${price.toFixed(2)} € appliqué à ${selectedProducts.size} produit(s)`);

    setSelectedProducts(new Set());
    setBulkPrice('');
    setBulkDialogOpen(false);
    // Clear edits for current rule
    setEditedPrices(prev => ({ ...prev, [activeRuleId]: {} }));
    setEditedOurPrices(prev => ({ ...prev, [activeRuleId]: {} }));
    setEditedFinalPrices(prev => ({ ...prev, [activeRuleId]: {} }));
    setEditedProductCoefs(prev => ({ ...prev, [activeRuleId]: {} }));
  };

  const applyCategoryPrice = () => {
    if (!catBulkTarget) return;
    const price = parseFloat(catBulkPrice);
    if (isNaN(price) || price < 0) return;
    const catProducts = catBulkTarget.catId === '__uncategorized'
      ? productsByCategory.uncategorized
      : (productsByCategory.grouped[catBulkTarget.catId] || []);

    if (catBulkTarget.field === 'our_price') {
      setEditedOurPrices(prev => {
        const rulePrices = { ...(prev[activeRuleId] || {}) };
        catProducts.forEach(p => { rulePrices[p.id] = price; });
        return { ...prev, [activeRuleId]: rulePrices };
      });
    } else {
      setEditedFinalPrices(prev => {
        const rulePrices = { ...(prev[activeRuleId] || {}) };
        catProducts.forEach(p => { rulePrices[p.id] = price; });
        return { ...prev, [activeRuleId]: rulePrices };
      });
    }
    toast.success(`Prix appliqué à ${catProducts.length} produit(s) de "${catBulkTarget.catName}"`);
    setCatBulkTarget(null);
    setCatBulkPrice('');
  };

  const toggleSelect = (productId: string) => {
    setSelectedProducts(prev => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

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

  const addRule = () => {
    if (!newRuleName.trim()) return;
    const intermediaries = newRuleType === 'b2c'
      ? []
      : newRuleType === 'oem'
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

  const confirmDeleteRule = () => {
    if (!ruleToDelete) return;
    setSalesRules(prev => prev.filter(r => r.id !== ruleToDelete));
    // Clean up per-rule data
    setEditedPrices(prev => { const n = { ...prev }; delete n[ruleToDelete]; return n; });
    setEditedOurPrices(prev => { const n = { ...prev }; delete n[ruleToDelete]; return n; });
    setEditedFinalPrices(prev => { const n = { ...prev }; delete n[ruleToDelete]; return n; });
    setEditedProductCoefs(prev => { const n = { ...prev }; delete n[ruleToDelete]; return n; });
    if (activeRuleId === ruleToDelete) {
      const remaining = salesRules.filter(r => r.id !== ruleToDelete);
      setActiveRuleId(remaining[0]?.id || '');
    }
    setRuleToDelete(null);
    toast.success('Règle supprimée');
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
      const max = rule.type === 'b2c' ? 0 : rule.type === 'oem' ? 1 : 2;
      if (rule.intermediaries.length >= max) return rule;
      return { ...rule, intermediaries: [...rule.intermediaries, { label: 'Intermédiaire', coefficient: 1.3 }] };
    }));
  };

  const removeIntermediary = (ruleId: string, index: number) => {
    setSalesRules(prev => prev.map(rule => {
      if (rule.id !== ruleId) return rule;
      if (rule.intermediaries.length <= 0) return rule;
      return { ...rule, intermediaries: rule.intermediaries.filter((_, i) => i !== index) };
    }));
  };

  const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const getProductMarginPct = (prod: typeof products[0]): number | null => {
    const costPrice = calculateProductCost(prod.id, prod.default_volume || 500);
    if (costPrice <= 0) return null;

    if (pricingMode === 'from_public') {
      const effectivePrice = getEffectivePrice(prod);
      const result = computeChainFromPublicTTC(effectivePrice);
      if (!result) return null;
      return ((result.ourB2BPrice - costPrice) / costPrice) * 100;
    } else {
      const effectiveTTC = getEffectivePrice(prod);
      const reverseResult = computeChainFromPublicTTC(effectiveTTC);
      const ruleOurPrices = getRuleEditedOurPrices();
      const currentOurPrice = ruleOurPrices[prod.id] !== undefined
        ? ruleOurPrices[prod.id]
        : (reverseResult?.ourB2BPrice || 0);
      if (currentOurPrice <= 0) return null;
      return ((currentOurPrice - costPrice) / costPrice) * 100;
    }
  };

  const marginColorClass = (marginPct: number) =>
    marginPct < 0 ? 'text-destructive font-semibold' : 'text-muted-foreground';

  const renderProductRow = (prod: typeof products[0]) => {
    const costPrice = calculateProductCost(prod.id, prod.default_volume || 500);
    const isSelected = selectedProducts.has(prod.id);
    const rulePrices = getRuleEditedPrices();
    const ruleOurPrices = getRuleEditedOurPrices();
    const ruleFinalPrices = getRuleEditedFinalPrices();
    const ruleCoefs = getRuleEditedCoefs();

    if (pricingMode === 'from_public') {
      const effectivePrice = getEffectivePrice(prod);
      const result = computeChainFromPublicTTC(effectivePrice);
      const isEdited = rulePrices[prod.id] !== undefined;

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
                  setRuleEditedPrice(prod.id, isNaN(val) ? 0 : val);
                }}
                placeholder="0.00"
              />
              <span className="text-xs text-muted-foreground">€</span>
            </div>
          </TableCell>
          <TableCell className={`text-right font-mono text-sm ${(() => {
            if (!result || costPrice <= 0) return 'text-muted-foreground';
            const m = ((result.ourB2BPrice - costPrice) / costPrice) * 100;
            return marginColorClass(m);
          })()}`}>
            {result && costPrice > 0
              ? `${fmt(((result.ourB2BPrice - costPrice) / costPrice) * 100)}%`
              : '–'}
          </TableCell>
          <TableCell className="w-10">
            {isEdited && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => saveProductPrice(prod.id, rulePrices[prod.id])} title="Enregistrer">
                <Check className="h-3.5 w-3.5" />
              </Button>
            )}
          </TableCell>
        </TableRow>
      );
    } else {
      const effectiveTTC = getEffectivePrice(prod);
      const currentFinalTTC = ruleFinalPrices[prod.id] !== undefined
        ? ruleFinalPrices[prod.id]
        : (effectiveTTC || 0);
      const reverseResult = computeChainFromPublicTTC(effectiveTTC);
      const currentOurPrice = ruleOurPrices[prod.id] !== undefined
        ? ruleOurPrices[prod.id]
        : (reverseResult?.ourB2BPrice || 0);
      const customCoefs = ruleCoefs[prod.id];
      const result = computeChainBothEnds(currentOurPrice, currentFinalTTC, customCoefs);
      const isEdited = ruleOurPrices[prod.id] !== undefined || ruleFinalPrices[prod.id] !== undefined || ruleCoefs[prod.id] !== undefined;

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
                  setRuleEditedOurPrice(prod.id, isNaN(val) ? 0 : val);
                }}
                placeholder="0.00"
              />
              <span className="text-xs text-muted-foreground">€</span>
            </div>
          </TableCell>
          {activeRule?.intermediaries.map((inter, i) => {
            const step = result?.chain[i];
            const coef = result?.coefs[i] || 1;
            return (
              <TableCell key={i} className="font-mono text-sm">
                {step ? (
                  <div className="flex flex-col items-end gap-0.5">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">×</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="1.01"
                        className="h-7 text-xs font-mono w-16 text-right"
                        value={Number(coef.toFixed(4))}
                        onChange={e => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val) && result) {
                            handleProductCoefChange(prod.id, i, val, result.totalCoef);
                          }
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {fmt(step.buyPrice)} → {fmt(step.sellPrice)} €
                    </span>
                  </div>
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
                value={currentFinalTTC || ''}
                onChange={e => {
                  const val = parseFloat(e.target.value);
                  setRuleEditedFinalPrice(prod.id, isNaN(val) ? 0 : val);
                }}
                placeholder="0.00"
              />
              <span className="text-xs text-muted-foreground">€</span>
            </div>
          </TableCell>
          <TableCell className="text-right font-mono text-sm text-muted-foreground">
            {result ? `×${result.totalCoef.toFixed(2)}` : '–'}
          </TableCell>
          <TableCell className={`text-right font-mono text-sm ${(() => {
            if (!result || costPrice <= 0) return 'text-muted-foreground';
            const m = ((currentOurPrice - costPrice) / costPrice) * 100;
            return marginColorClass(m);
          })()}`}>
            {result && costPrice > 0
              ? `${fmt(((currentOurPrice - costPrice) / costPrice) * 100)}%`
              : '–'}
          </TableCell>
          <TableCell className="w-10">
            {isEdited && currentFinalTTC > 0 && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => saveProductPrice(prod.id, currentFinalTTC)} title="Enregistrer">
                <Check className="h-3.5 w-3.5" />
              </Button>
            )}
          </TableCell>
        </TableRow>
      );
    }
  };

  const toggleMarginSort = () => {
    setMarginSort(prev => prev === 'none' ? 'asc' : prev === 'asc' ? 'desc' : 'none');
  };

  const sortByMargin = (prods: typeof products) => {
    if (marginSort === 'none') return prods;
    return [...prods].sort((a, b) => {
      const ma = getProductMarginPct(a) ?? -Infinity;
      const mb = getProductMarginPct(b) ?? -Infinity;
      return marginSort === 'asc' ? ma - mb : mb - ma;
    });
  };

  const renderCategoryTable = (catProducts: typeof products, catId: string) => {
    const allSelected = catProducts.length > 0 && catProducts.every(p => selectedProducts.has(p.id));
    const someSelected = catProducts.some(p => selectedProducts.has(p.id));
    const sortedProducts = sortByMargin(catProducts);

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
                    <TableHead key={i} className="text-right">{inter.label} <span className="text-xs opacity-60">(coef)</span></TableHead>
                  ))}
                  <TableHead className="text-right">Prix Public HT</TableHead>
                  <TableHead className="text-right">
                    <span className="flex items-center justify-end gap-1">
                      <ArrowDown className="h-3 w-3 text-primary" />
                      Prix Public TTC
                    </span>
                  </TableHead>
                  <TableHead className="text-right">Coef total</TableHead>
                </>
              )}
              <TableHead className="text-right">
                <button
                  className="inline-flex items-center gap-1 hover:text-primary transition-colors cursor-pointer"
                  onClick={toggleMarginSort}
                >
                  Notre marge
                  {marginSort === 'none' && <ArrowUpDown className="h-3 w-3 opacity-40" />}
                  {marginSort === 'asc' && <ArrowUp className="h-3 w-3 text-primary" />}
                  {marginSort === 'desc' && <ArrowDown className="h-3 w-3 text-primary" />}
                </button>
              </TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedProducts.map(renderProductRow)}
          </TableBody>
        </Table>
      </div>
    );
  };

  const ruleHasEdits = () => {
    const rp = getRuleEditedPrices();
    const rop = getRuleEditedOurPrices();
    const rfp = getRuleEditedFinalPrices();
    const rpc = getRuleEditedCoefs();
    if (pricingMode === 'from_public') {
      return Object.keys(rp).length > 0;
    }
    return Object.keys(rop).length > 0 || Object.keys(rfp).length > 0 || Object.keys(rpc).length > 0;
  };

  const saveAllEdits = async () => {
    if (pricingMode === 'from_public') {
      const rulePrices = getRuleEditedPrices();
      const promises = Object.entries(rulePrices).map(([id, price]) =>
        updateProduct(id, { price_ttc: price })
      );
      await Promise.all(promises);
      toast.success(`${Object.keys(rulePrices).length} prix mis à jour pour "${activeRule?.name}"`);
      setEditedPrices(prev => ({ ...prev, [activeRuleId]: {} }));
    } else {
      const rop = getRuleEditedOurPrices();
      const rfp = getRuleEditedFinalPrices();
      const rpc = getRuleEditedCoefs();
      const allEditedIds = new Set([
        ...Object.keys(rop),
        ...Object.keys(rfp),
        ...Object.keys(rpc),
      ]);
      const promises = Array.from(allEditedIds).map(id => {
        const finalTTC = rfp[id] !== undefined ? rfp[id] : (products.find(p => p.id === id)?.price_ttc || 0);
        return finalTTC > 0 ? updateProduct(id, { price_ttc: finalTTC }) : Promise.resolve();
      });
      await Promise.all(promises);
      toast.success(`${allEditedIds.size} prix mis à jour pour "${activeRule?.name}"`);
      // Keep editedOurPrices per rule (they are rule-specific, not stored on product)
      setEditedFinalPrices(prev => ({ ...prev, [activeRuleId]: {} }));
      setEditedProductCoefs(prev => ({ ...prev, [activeRuleId]: {} }));
    }
    // Auto-save config to persist per-rule data
    await savePricingConfig();
  };

  // Count total edits across all rules for indicator
  const totalEditsAllRules = useMemo(() => {
    let count = 0;
    for (const ruleId of Object.keys(editedPrices)) {
      count += Object.keys(editedPrices[ruleId] || {}).length;
    }
    for (const ruleId of Object.keys(editedOurPrices)) {
      count += Object.keys(editedOurPrices[ruleId] || {}).length;
    }
    for (const ruleId of Object.keys(editedFinalPrices)) {
      count += Object.keys(editedFinalPrices[ruleId] || {}).length;
    }
    return count;
  }, [editedPrices, editedOurPrices, editedFinalPrices]);

  const ruleEditCount = (ruleId: string) => {
    const ep = Object.keys(editedPrices[ruleId] || {}).length;
    const eop = Object.keys(editedOurPrices[ruleId] || {}).length;
    const efp = Object.keys(editedFinalPrices[ruleId] || {}).length;
    return ep + eop + efp;
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
          <Button onClick={savePricingConfig} disabled={savingConfig} variant="default" size="sm">
            {savingConfig ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Sauvegarder Config
          </Button>
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
        </div>
      </div>

      {/* Pricing Mode Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <ArrowDown className="h-4 w-4 text-primary" />
            Mode de tarification — Prix fixés aux deux extrémités
          </CardTitle>
          <CardDescription>Fixez notre prix HT + le prix client TTC → les coefficients intermédiaires sont calculés et liés</CardDescription>
        </CardHeader>
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
              <CardDescription>Configurez les canaux de distribution et leurs intermédiaires. Chaque règle a ses propres prix par catégorie.</CardDescription>
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
                    <Select value={newRuleType} onValueChange={v => setNewRuleType(v as 'b2b' | 'oem' | 'b2c')}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="b2b">B2B (max 2 intermédiaires)</SelectItem>
                        <SelectItem value="oem">OEM (max 1 intermédiaire)</SelectItem>
                        <SelectItem value="b2c">B2C (vente directe)</SelectItem>
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
            {salesRules.map(rule => {
              const edits = ruleEditCount(rule.id);
              return (
                <Badge
                  key={rule.id}
                  variant={rule.id === activeRuleId ? 'default' : 'outline'}
                  className="cursor-pointer text-sm py-1.5 px-3 relative"
                  onClick={() => setActiveRuleId(rule.id)}
                >
                  {rule.name}
                  <span className="ml-1 text-xs opacity-60">({rule.type.toUpperCase()})</span>
                  {edits > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                      {edits}
                    </span>
                  )}
                </Badge>
              );
            })}
          </div>

          {activeRule && (
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Input
                  value={activeRule.name}
                  onChange={e => setSalesRules(prev => prev.map(r =>
                    r.id === activeRule.id ? { ...r, name: e.target.value } : r
                  ))}
                  className="h-8 text-sm font-semibold w-48"
                />
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{activeRule.type === 'b2c' ? 'Vente directe' : activeRule.type === 'oem' ? 'Max 1 intermédiaire' : 'Max 2 intermédiaires'}</Badge>
                  {salesRules.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setRuleToDelete(activeRule.id)}>
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
                {activeRule.intermediaries.length < (activeRule.type === 'b2c' ? 0 : activeRule.type === 'oem' ? 1 : 2) && (
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

      {/* Margin Analysis Chart */}
      <MarginChart
        products={products}
        productCategories={productCategories}
        salesRules={salesRules}
        calculateProductCost={calculateProductCost}
        computeChainFromPublicTTC={computeChainFromPublicTTC}
        getEffectivePrice={getEffectivePrice}
        editedOurPrices={getRuleEditedOurPrices()}
        pricingMode={pricingMode}
      />

      {/* Pricing table by category */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5" />
                Détail des prix par catégorie — <span className="text-primary">{activeRule?.name}</span>
              </CardTitle>
              <CardDescription>
                {pricingMode === 'from_public'
                  ? `Fixez le prix public TTC → notre prix de vente est calculé via la chaîne "${activeRule?.name}"`
                  : `Fixez notre prix HT et le prix client TTC → les coefficients intermédiaires sont répartis via "${activeRule?.name}"`
                }
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {ruleHasEdits() && (
                <Button onClick={saveAllEdits} size="sm" variant="outline">
                  <Check className="h-4 w-4 mr-1" />
                  Enregistrer les prix ({activeRule?.name})
                </Button>
              )}
              {selectedProducts.size > 0 && (
                <div className="text-sm text-muted-foreground">
                  {selectedProducts.size} produit(s) sélectionné(s)
                </div>
              )}
            </div>
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
                  <div className="flex items-center">
                    <button
                      className="flex-1 flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                      onClick={() => toggleCategory(cat.id)}
                    >
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: cat.color }} />
                      <span className="font-semibold">{cat.name}</span>
                      <Badge variant="secondary" className="ml-auto">{catProducts.length} produit{catProducts.length > 1 ? 's' : ''}</Badge>
                    </button>
                    <div className="flex items-center gap-1 pr-3">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setCatBulkTarget({ catId: cat.id, catName: cat.name, field: 'our_price' }); setCatBulkPrice(''); }}>
                        Appliquer notre prix
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setCatBulkTarget({ catId: cat.id, catName: cat.name, field: 'public_ttc' }); setCatBulkPrice(''); }}>
                        Appliquer prix public
                      </Button>
                    </div>
                  </div>
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

      {/* Delete rule confirmation */}
      <AlertDialog open={!!ruleToDelete} onOpenChange={open => { if (!open) setRuleToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette règle de vente ?</AlertDialogTitle>
            <AlertDialogDescription>
              La règle « {salesRules.find(r => r.id === ruleToDelete)?.name} » et tous ses prix associés seront définitivement supprimés. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteRule} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Category bulk price dialog */}
      <Dialog open={!!catBulkTarget} onOpenChange={open => { if (!open) setCatBulkTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {catBulkTarget?.field === 'our_price' ? 'Appliquer notre prix HT' : 'Appliquer prix public TTC'} — {catBulkTarget?.catName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Ce prix sera appliqué à tous les produits de la catégorie « {catBulkTarget?.catName} » pour la règle « {activeRule?.name} ».
            </p>
            <div>
              <Label>{catBulkTarget?.field === 'our_price' ? 'Notre Prix HT (€)' : 'Prix Public TTC (€)'}</Label>
              <Input
                type="number"
                step="0.01"
                value={catBulkPrice}
                onChange={e => setCatBulkPrice(e.target.value)}
                placeholder="Ex: 299.00"
                className="font-mono"
                autoFocus
              />
            </div>
            <Button onClick={applyCategoryPrice} className="w-full" disabled={!catBulkPrice || isNaN(parseFloat(catBulkPrice))}>
              Appliquer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
