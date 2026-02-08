import { createContext, useContext, useState, useMemo, ReactNode, useCallback, useEffect, useRef } from 'react';
import { Product, Role, Expense, FundingRound } from '@/engine/types';
import { defaultProducts, defaultRoles, defaultExpenses, defaultFundingRounds } from '@/engine/defaults';
import { calculateTotalRevenue, calculateCOGS, calculatePayroll, calculateHeadcount, calculateTotalOpex, calculateTotalVolumes, calculateDepreciation } from '@/engine/calculations';
import { calculateTreasuryProjection, TreasuryProjection } from '@/engine/treasuryEngine';
import { calculateMonthlyTreasuryProjection, MonthlyTreasuryProjection, getDefaultMonthlyTreasuryConfig, MonthlyTreasuryConfig } from '@/engine/monthlyTreasuryEngine';
import { calculateCapexByYear } from '@/engine/fundingNeedsCalculator';
import { GlobalRevenueConfig } from '@/components/product/GlobalRevenueEditor';
import { HistoricalYearData } from '@/components/valuation/EditableHistoricalFinancials';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

export type RevenueMode = 'by-product' | 'by-channel-global';

export interface ScenarioConfig {
  volumeAdjustment: number;
  priceAdjustment: number;
  opexAdjustment: number;
}

export interface SimpleOpexConfig {
  baseAmount: number;
  growthRate: number;
}

interface ScenarioSettings {
  startYear: number;
  durationYears: number;
  initialCash: number;
}

interface FinancialState {
  products: Product[];
  roles: Role[];
  expenses: Expense[];
  fundingRounds: FundingRound[];
  scenarioSettings: ScenarioSettings;
  scenarioConfigs: Record<string, ScenarioConfig>;
  activeScenarioId: 'conservative' | 'base' | 'ambitious';
  revenueMode: RevenueMode;
  globalRevenueConfig: GlobalRevenueConfig;
  opexMode: 'detailed' | 'simple';
  simpleOpexConfig: SimpleOpexConfig;
  hasUnsavedChanges: boolean;
  lastSaved: string | null;
  historicalData: HistoricalYearData[];
  excludeFundingFromTreasury: boolean;
  monthlyTreasuryConfig: MonthlyTreasuryConfig;
}

interface ComputedValues {
  totalDevCost: number;
  revenueByYear: { year: number; revenue: number; cogs: number }[];
  payrollByYear: { year: number; payroll: number; headcount: number }[];
  opexByYear: { year: number; opex: number; byCategory: Record<string, number> }[];
  capexByYear: { year: number; capex: number; depreciation: number }[];
  totalHeadcount: number;
  currentPayroll: number;
  treasuryProjection: TreasuryProjection;
  monthlyTreasuryProjection: MonthlyTreasuryProjection;
}

interface FinancialContextType {
  state: FinancialState;
  computed: ComputedValues;
  updateProducts: (products: Product[]) => void;
  addProduct: (product: Product) => void;
  removeProduct: (id: string) => void;
  updateRoles: (roles: Role[]) => void;
  addRole: (role: Role) => void;
  removeRole: (id: string) => void;
  updateExpenses: (expenses: Expense[]) => void;
  addExpense: (expense: Expense) => void;
  removeExpense: (id: string) => void;
  updateFundingRounds: (rounds: FundingRound[]) => void;
  updateScenarioSettings: (settings: Partial<ScenarioSettings>) => void;
  setActiveScenario: (id: 'conservative' | 'base' | 'ambitious') => void;
  updateScenarioConfig: (id: string, config: Partial<ScenarioConfig>) => void;
  setRevenueMode: (mode: RevenueMode) => void;
  updateGlobalRevenueConfig: (config: GlobalRevenueConfig) => void;
  setOpexMode: (mode: 'detailed' | 'simple') => void;
  updateSimpleOpexConfig: (config: Partial<SimpleOpexConfig>) => void;
  setExcludeFundingFromTreasury: (exclude: boolean) => void;
  updateHistoricalData: (data: HistoricalYearData[]) => void;
  updateMonthlyTreasuryConfig: (config: MonthlyTreasuryConfig) => void;
  saveAll: () => void;
}

const STATE_KEY = 'novaride_financial_state_v5';

function loadState(): FinancialState {
  try {
    const stored = localStorage.getItem(STATE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return getDefaultState();
}

function getDefaultState(): FinancialState {
  return {
    products: defaultProducts,
    roles: defaultRoles,
    expenses: defaultExpenses,
    fundingRounds: defaultFundingRounds,
    scenarioSettings: { startYear: 2025, durationYears: 6, initialCash: 50000 },
    scenarioConfigs: {
      conservative: { volumeAdjustment: -0.2, priceAdjustment: 0, opexAdjustment: -0.1 },
      base: { volumeAdjustment: 0, priceAdjustment: 0, opexAdjustment: 0 },
      ambitious: { volumeAdjustment: 0.3, priceAdjustment: 0.05, opexAdjustment: 0.1 },
    },
    activeScenarioId: 'base',
    revenueMode: 'by-product',
    globalRevenueConfig: { b2c: {}, b2b: {}, oem: {} },
    opexMode: 'detailed',
    simpleOpexConfig: { baseAmount: 200000, growthRate: 0.05 },
    hasUnsavedChanges: false,
    lastSaved: null,
    historicalData: [
      { year: 2023, revenue: 200000, grossMargin: 0.65, payroll: 150000, externalCosts: 80000, depreciation: 20000 },
      { year: 2024, revenue: 450000, grossMargin: 0.68, payroll: 280000, externalCosts: 120000, depreciation: 35000 },
    ],
    excludeFundingFromTreasury: false,
    monthlyTreasuryConfig: getDefaultMonthlyTreasuryConfig(),
  };
}

const FinancialContext = createContext<FinancialContextType | undefined>(undefined);

export function FinancialProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<FinancialState>(loadState);
  const [cloudLoaded, setCloudLoaded] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load from Supabase on login
  useEffect(() => {
    if (!user || cloudLoaded) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('financial_scenarios')
          .select('state_data')
          .eq('user_id', user.id)
          .maybeSingle();
        if (data?.state_data) {
          const cloudState = data.state_data as unknown as FinancialState;
          setState({ ...cloudState, hasUnsavedChanges: false });
          localStorage.setItem(STATE_KEY, JSON.stringify(cloudState));
        }
      } catch (e) {
        console.warn('Failed to load from cloud:', e);
      } finally {
        setCloudLoaded(true);
      }
    })();
  }, [user, cloudLoaded]);

  const markChanged = useCallback(() => {
    setState(prev => ({ ...prev, hasUnsavedChanges: true }));
  }, []);

  const updateProducts = useCallback((products: Product[]) => { setState(prev => ({ ...prev, products, hasUnsavedChanges: true })); }, []);
  const addProduct = useCallback((product: Product) => { setState(prev => ({ ...prev, products: [...prev.products, product], hasUnsavedChanges: true })); }, []);
  const removeProduct = useCallback((id: string) => { setState(prev => ({ ...prev, products: prev.products.filter(p => p.id !== id), hasUnsavedChanges: true })); }, []);
  const updateRoles = useCallback((roles: Role[]) => { setState(prev => ({ ...prev, roles, hasUnsavedChanges: true })); }, []);
  const addRole = useCallback((role: Role) => { setState(prev => ({ ...prev, roles: [...prev.roles, role], hasUnsavedChanges: true })); }, []);
  const removeRole = useCallback((id: string) => { setState(prev => ({ ...prev, roles: prev.roles.filter(r => r.id !== id), hasUnsavedChanges: true })); }, []);
  const updateExpenses = useCallback((expenses: Expense[]) => { setState(prev => ({ ...prev, expenses, hasUnsavedChanges: true })); }, []);
  const addExpense = useCallback((expense: Expense) => { setState(prev => ({ ...prev, expenses: [...prev.expenses, expense], hasUnsavedChanges: true })); }, []);
  const removeExpense = useCallback((id: string) => { setState(prev => ({ ...prev, expenses: prev.expenses.filter(e => e.id !== id), hasUnsavedChanges: true })); }, []);
  const updateFundingRounds = useCallback((fundingRounds: FundingRound[]) => { setState(prev => ({ ...prev, fundingRounds, hasUnsavedChanges: true })); }, []);
  const updateScenarioSettings = useCallback((settings: Partial<ScenarioSettings>) => { setState(prev => ({ ...prev, scenarioSettings: { ...prev.scenarioSettings, ...settings }, hasUnsavedChanges: true })); }, []);
  const setActiveScenario = useCallback((id: 'conservative' | 'base' | 'ambitious') => { setState(prev => ({ ...prev, activeScenarioId: id })); }, []);
  const updateScenarioConfig = useCallback((id: string, config: Partial<ScenarioConfig>) => {
    setState(prev => ({ ...prev, scenarioConfigs: { ...prev.scenarioConfigs, [id]: { ...prev.scenarioConfigs[id], ...config } }, hasUnsavedChanges: true }));
  }, []);
  const setRevenueMode = useCallback((revenueMode: RevenueMode) => { setState(prev => ({ ...prev, revenueMode, hasUnsavedChanges: true })); }, []);
  const updateGlobalRevenueConfig = useCallback((globalRevenueConfig: GlobalRevenueConfig) => { setState(prev => ({ ...prev, globalRevenueConfig, hasUnsavedChanges: true })); }, []);
  const setOpexMode = useCallback((opexMode: 'detailed' | 'simple') => { setState(prev => ({ ...prev, opexMode, hasUnsavedChanges: true })); }, []);
  const updateSimpleOpexConfig = useCallback((config: Partial<SimpleOpexConfig>) => { setState(prev => ({ ...prev, simpleOpexConfig: { ...prev.simpleOpexConfig, ...config }, hasUnsavedChanges: true })); }, []);
  const setExcludeFundingFromTreasury = useCallback((excludeFundingFromTreasury: boolean) => { setState(prev => ({ ...prev, excludeFundingFromTreasury, hasUnsavedChanges: true })); }, []);
  const updateHistoricalData = useCallback((historicalData: HistoricalYearData[]) => { setState(prev => ({ ...prev, historicalData, hasUnsavedChanges: true })); }, []);
  const updateMonthlyTreasuryConfig = useCallback((monthlyTreasuryConfig: MonthlyTreasuryConfig) => { setState(prev => ({ ...prev, monthlyTreasuryConfig, hasUnsavedChanges: true })); }, []);

  const saveAll = useCallback(async () => {
    try {
      const toSave = { ...state, hasUnsavedChanges: false, lastSaved: new Date().toISOString() };
      localStorage.setItem(STATE_KEY, JSON.stringify(toSave));
      setState(toSave);

      // Save to Supabase if logged in
      if (user) {
        const { hasUnsavedChanges: _, ...stateForCloud } = toSave;
        await supabase
          .from('financial_scenarios')
          .upsert({ user_id: user.id, state_data: stateForCloud as any }, { onConflict: 'user_id' });
      }

      toast({ title: 'Données sauvegardées', description: user ? 'Sauvegardé en local et dans le cloud.' : 'Sauvegardé en local.' });
    } catch {
      toast({ title: 'Erreur de sauvegarde', variant: 'destructive' });
    }
  }, [state, user]);

  const computed = useMemo<ComputedValues>(() => {
    const { products, roles, expenses, fundingRounds, scenarioSettings, scenarioConfigs, activeScenarioId, opexMode, simpleOpexConfig, excludeFundingFromTreasury, monthlyTreasuryConfig } = state;
    const { startYear, durationYears, initialCash } = scenarioSettings;
    const config = scenarioConfigs[activeScenarioId];
    const years = Array.from({ length: durationYears }, (_, i) => startYear + i);

    const totalDevCost = products.reduce((sum, p) => sum + p.devCost, 0);

    const revenueByYear = years.map(year => {
      let revenue = 0, cogs = 0;
      products.forEach(p => {
        const vol = Math.round((p.volumesByYear[year] || 0) * (1 + config.volumeAdjustment));
        revenue += vol * p.priceHT * (1 + config.priceAdjustment);
        cogs += vol * p.unitCost;
      });
      return { year, revenue, cogs };
    });

    const payrollByYear = years.map(year => {
      const active = roles.filter(r => r.startYear <= year);
      return { year, payroll: active.reduce((s, r) => s + r.annualCostLoaded, 0), headcount: active.length };
    });

    const opexByYear = years.map((year, i) => {
      let opex = 0;
      const byCategory: Record<string, number> = {};
      if (opexMode === 'simple') {
        opex = simpleOpexConfig.baseAmount * Math.pow(1 + simpleOpexConfig.growthRate, i);
      } else {
        expenses.forEach(e => {
          if (e.startYear > year) return;
          let cost = e.baseAnnualCost;
          const elapsed = year - e.startYear;
          if (e.evolutionType === 'growth_rate') cost *= Math.pow(1 + (e.growthRate || 0), elapsed);
          else if (e.evolutionType === 'linked_to_revenue') cost = (revenueByYear[i]?.revenue || 0) * (e.revenueRatio || 0);
          else if (e.evolutionType === 'step') { const s = e.steps?.filter(s => s.year <= year).pop(); if (s) cost = s.newAnnualCost; }
          cost *= (1 + config.opexAdjustment);
          opex += cost;
          byCategory[e.category] = (byCategory[e.category] || 0) + cost;
        });
      }
      return { year, opex, byCategory };
    });

    const capexByYear = years.map(year => ({
      year,
      capex: products.filter(p => p.launchYear === year).reduce((s, p) => s + p.devCost, 0),
      depreciation: calculateDepreciation(products, year),
    }));

    const currentYear = startYear;
    const totalHeadcount = roles.filter(r => r.startYear <= currentYear).length;
    const currentPayroll = roles.filter(r => r.startYear <= currentYear).reduce((s, r) => s + r.annualCostLoaded, 0);

    const roundsWithQuarter = fundingRounds.map(r => ({ ...r, quarter: r.quarter || 'Q1' as const }));
    const treasuryProjection = calculateTreasuryProjection(
      products, roles, expenses, roundsWithQuarter, initialCash, startYear, durationYears, config, opexMode, simpleOpexConfig
    );

    // Monthly treasury
    const annualRevenue: Record<number, number> = {};
    const annualCogs: Record<number, number> = {};
    const annualPayroll: Record<number, number> = {};
    const annualOpex: Record<number, number> = {};
    revenueByYear.forEach(r => { annualRevenue[r.year] = r.revenue; annualCogs[r.year] = r.cogs; });
    payrollByYear.forEach(p => { annualPayroll[p.year] = p.payroll; });
    opexByYear.forEach(o => { annualOpex[o.year] = o.opex; });

    const monthlyTreasuryProjection = calculateMonthlyTreasuryProjection(
      monthlyTreasuryConfig,
      { annualRevenue, annualCogs, annualPayroll, annualOpex },
      fundingRounds,
      initialCash,
      startYear,
      durationYears,
      excludeFundingFromTreasury
    );

    return { totalDevCost, revenueByYear, payrollByYear, opexByYear, capexByYear, totalHeadcount, currentPayroll, treasuryProjection, monthlyTreasuryProjection };
  }, [state]);

  return (
    <FinancialContext.Provider value={{
      state, computed,
      updateProducts, addProduct, removeProduct,
      updateRoles, addRole, removeRole,
      updateExpenses, addExpense, removeExpense,
      updateFundingRounds, updateScenarioSettings,
      setActiveScenario, updateScenarioConfig,
      setRevenueMode, updateGlobalRevenueConfig,
      setOpexMode, updateSimpleOpexConfig,
      setExcludeFundingFromTreasury, updateHistoricalData,
      updateMonthlyTreasuryConfig,
      saveAll,
    }}>
      {children}
    </FinancialContext.Provider>
  );
}

export function useFinancial() {
  const context = useContext(FinancialContext);
  if (!context) throw new Error('useFinancial must be used within FinancialProvider');
  return context;
}
