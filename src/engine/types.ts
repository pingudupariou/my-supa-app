// ============================================
// TYPES FONDAMENTAUX DU MOTEUR FINANCIER
// ============================================

// ==================
// PLAN PRODUIT (SOURCE UNIQUE DU CA)
// ==================

export type ProductCategory = 'B2C' | 'B2B' | 'OEM';

// Structure des volumes par canal et par année
export interface VolumesByChannel {
  B2C: Record<number, number>;
  B2B: Record<number, number>;
  OEM: Record<number, number>;
}

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  launchYear: number;
  devCost: number;
  devAmortizationYears?: number;
  unitCost: number;           // Coût de production unique
  priceHT: number;            // Prix public HT (calculé depuis priceTTC_B2C)
  priceTTC_B2C: number;       // Prix public TTC B2C (saisie manuelle)
  vatRate: number;            // Taux de TVA (ex: 0.20)
  coef_shop: number;          // Coefficient shop B2B (> 1)
  coef_dist: number;          // Coefficient distributeur B2B (> 1)
  coef_oem: number;           // Coefficient OEM (> 1)
  volumesByYear: Record<number, number>;           // Legacy: volumes totaux (rétrocompatibilité)
  volumesByChannel?: VolumesByChannel;             // Nouveau: volumes par canal
}

// ==================
// MASSE SALARIALE / ORGANISATION
// ==================

export type Department = 'R&D' | 'Production' | 'Sales' | 'Support' | 'Admin';

export interface Role {
  id: string;
  title: string;
  department: Department;
  startYear: number;
  annualCostLoaded: number;
  linkedToProduct?: string;
}

// ==================
// STRUCTURE DES CHARGES (OPEX)
// ==================

export type ExpenseCategory = 'R&D' | 'Production' | 'Sales & Marketing' | 'G&A' | 'Logistics' | 'IT & Tools';
export type EvolutionType = 'fixed' | 'growth_rate' | 'linked_to_revenue' | 'linked_to_volume' | 'step';

export interface Expense {
  id: string;
  name: string;
  category: ExpenseCategory;
  startYear: number;
  baseAnnualCost: number;
  evolutionType: EvolutionType;
  growthRate?: number;
  revenueRatio?: number;
  volumeRatio?: number;
  steps?: { year: number; newAnnualCost: number }[];
  description?: string;
}

// ==================
// HYPOTHÈSES GLOBALES
// ==================

export interface GlobalAssumptions {
  inflationRate: number;
  priceIncreaseRate: number;
  paymentDelayDays: number;
  vatRate: number;
  baseYear: number;
}

// ==================
// SCÉNARIOS (MODULATEURS)
// ==================

export interface ScenarioModifiers {
  volumeMultiplier?: number;
  priceMultiplier?: number;
  expenseModifiers?: {
    inflationMultiplier?: number;
    marketingMultiplier?: number;
    delayStepExpensesByYears?: number;
  };
  hiringDelayYears?: number;
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  modifiers: ScenarioModifiers;
}

// ==================
// SORTIES DU MOTEUR FINANCIER
// ==================

export interface FinancialYear {
  year: number;
  revenue: number;
  revenueByCategory: Record<ProductCategory, number>;
  cogs: number;
  grossMargin: number;
  grossMarginRate: number;
  payroll: number;
  opex: number;
  opexByCategory: Record<ExpenseCategory, number>;
  ebitda: number;
  ebitdaMargin: number;
  depreciation: number;
  operatingResult: number;
  cashFlow: number;
  cashPosition: number;
  headcount: number;
  headcountByDept: Record<Department, number>;
}

export interface FinancialSummary {
  years: FinancialYear[];
  cagr: number;
  maxBurn: number;
  runway: number;
  breakEvenYear: number | null;
  fundingNeed: number;
}

// ==================
// LEVÉE DE FONDS
// ==================

export type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';

export interface FundingRound {
  id: string;
  name: string;
  amount: number;
  preMoneyValuation: number;
  year: number;
  quarter: Quarter;
}

export interface UseOfFunds {
  hiring: number;
  inventory: number;
  rd: number;
  marketing: number;
  buffer: number;
}

export interface CapTableEntry {
  shareholder: string;
  sharesPercentage: number;
  type: 'founder' | 'investor' | 'employee';
}

// ==================
// ÉTAT COMPLET DU MODÈLE
// ==================

export interface FinancialModel {
  products: Product[];
  roles: Role[];
  expenses: Expense[];
  assumptions: GlobalAssumptions;
  scenarios: Scenario[];
  fundingRounds: FundingRound[];
  useOfFunds: UseOfFunds;
  capTable: CapTableEntry[];
}

// ==================
// ALERTES ET VALIDATION
// ==================

export interface ValidationAlert {
  type: 'error' | 'warning' | 'info';
  category: 'revenue' | 'payroll' | 'expense' | 'funding' | 'general';
  message: string;
  details?: string;
}
