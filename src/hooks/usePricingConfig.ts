import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SalesRule {
  id: string;
  name: string;
  type: 'b2b' | 'oem' | 'b2c';
  tvaRate: number;
  intermediaries: { label: string; coefficient: number }[];
}

const DEFAULT_RULES: SalesRule[] = [
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
];

export function usePricingConfig() {
  const [salesRules, setSalesRules] = useState<SalesRule[]>(DEFAULT_RULES);
  const [pricingMode, setPricingMode] = useState<'from_public' | 'from_our_price'>('from_public');
  const [editedPrices, setEditedPrices] = useState<Record<string, number>>({});
  const [editedOurPrices, setEditedOurPrices] = useState<Record<string, number>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoaded(true); return; }

      const { data } = await supabase
        .from('pricing_config')
        .select('config_data')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data?.config_data) {
        const cfg = data.config_data as any;
        if (cfg.salesRules?.length) setSalesRules(cfg.salesRules);
        if (cfg.pricingMode) setPricingMode(cfg.pricingMode);
        if (cfg.editedPrices) setEditedPrices(cfg.editedPrices);
        if (cfg.editedOurPrices) setEditedOurPrices(cfg.editedOurPrices);
      }
      setLoaded(true);
    };
    load();
  }, []);

  const getEffectivePrice = useCallback((prod: { id: string; price_ttc: number | null }) => {
    return editedPrices[prod.id] !== undefined ? editedPrices[prod.id] : prod.price_ttc;
  }, [editedPrices]);

  const computeChainFromPublicTTC = useCallback((priceTTC: number, rule: SalesRule) => {
    if (!rule || priceTTC <= 0) return null;
    const tvaRate = rule.tvaRate ?? 20;
    const prixPublicHT = priceTTC / (1 + tvaRate / 100);
    let currentPrice = prixPublicHT;
    const intermediaries = [...rule.intermediaries].reverse();
    for (const inter of intermediaries) {
      currentPrice = currentPrice / inter.coefficient;
    }
    return { ourB2BPrice: currentPrice };
  }, []);

  return {
    salesRules,
    pricingMode,
    editedPrices,
    editedOurPrices,
    loaded,
    getEffectivePrice,
    computeChainFromPublicTTC,
  };
}
