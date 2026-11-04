// ============================================
// TYPES FONDAMENTAUX DU MOTEUR FINANCIER
// ============================================

// ==================
// CATÉGORIES PRODUIT (PLAN PRODUIT)
// ==================

export interface ProductPlanCategory {
  id: string;
  name: string;
  color: string;       // Couleur HEX pour le visuel
  sortOrder: number;   // Priorité / ordre d'affichage
}

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
  priceHT: number;            // Prix public HT B2C (calculé depuis priceTTC_B2C)
  priceTTC_B2C: number;       // Prix public TTC B2C (saisie manuelle)
  priceHT_B2B: number;        // Prix de vente HT canal B2B
  priceHT_OEM: number;        // Prix de vente HT canal OEM
  vatRate: number;            // Taux de TVA (ex: 0.20)
  coef_shop: number;          // Coefficient shop B2B (> 1)
  coef_dist: number;          // Coefficient distributeur B2B (> 1)
  coef_oem: number;           // Coefficient OEM (> 1)
  volumesByYear: Record<number, number>;           // Legacy: volumes totaux (rétrocompatibilité)
  volumesByChannel?: VolumesByChannel;             // Nouveau: volumes par canal
  opexRD?: number;            // OPEX R&D one-shot (année de lancement)
  opexMarketing?: number;     // OPEX Marketing one-shot (année de lancement)
  productCategoryId?: string; // Catégorie produit (pour classement/couleur)
  productComment?: string;    // Commentaire libre sur le produit
  productStatus?: 'standby' | 'validated'; // Statut du produit
  erplainMembers?: string[];  // Variantes Erplain regroupées dans cette catégorie
  erplainMemberProducts?: Product[]; // Copies des membres pour leurs noms et calculs après sauvegarde
  b2bClients?: B2BClientSplit; // Répartition facultative du B2B par client (lignes liées à Erplain)
}

// Client B2B d'une ligne du plan : volumes de base, croissance et ajustement propres.
export interface PlanB2BClient {
  id: string;
  name: string;
  customerId?: string;               // Identifiant client Erplain si importé
  volumes: Record<number, number>;   // Volumes de base par année
  growthRate: number;                // % par an, appliqué à partir de startYear
  startYear?: number;                // Année de départ de la croissance et de l'ajustement
  adjustment: number;                // % appliqué aux volumes à partir de startYear
  remainder?: boolean;               // Ligne « Autres clients (non répartis) »
}

export interface B2BClientSplit {
  enabled: boolean;                  // Si actif, le volume B2B de la ligne = somme des clients
  clients: PlanB2BClient[];
  historyYears: number[];            // Années remplies avec le réalisé Erplain
  importedAt?: string;
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
  personName?: string;        // Nom de la personne occupant le poste (facultatif)
  photo?: string;             // Photo recadrée (data URL JPEG compacte)
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
