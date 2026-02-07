// ============================================
// FONCTIONS PURES DE CALCUL FINANCIER
// Toutes testables indépendamment de React
// ============================================

import {
  Product,
  ProductCategory,
  Role,
  Department,
  Expense,
  ExpenseCategory,
  GlobalAssumptions,
  Scenario,
  FinancialYear,
  FinancialSummary,
  FundingRound,
  ValidationAlert,
} from './types';

// ==================
// CALCULS DE REVENUS (SOURCE: PLAN PRODUIT)
// ==================

/**
 * Calcule le CA pour un produit donné sur une année
 */
export function calculateProductRevenue(
  product: Product,
  year: number,
  volumeMultiplier: number = 1,
  priceMultiplier: number = 1
): number {
  const volumes = product.volumesByYear[year] || 0;
  return volumes * volumeMultiplier * product.priceHT * priceMultiplier;
}

/**
 * Calcule le CA total par catégorie pour une année
 */
export function calculateRevenueByCategory(
  products: Product[],
  year: number,
  volumeMultiplier: number = 1,
  priceMultiplier: number = 1
): Record<ProductCategory, number> {
  const result: Record<ProductCategory, number> = { B2C: 0, B2B: 0, OEM: 0 };
  
  products.forEach(product => {
    if (product.launchYear <= year) {
      const revenue = calculateProductRevenue(product, year, volumeMultiplier, priceMultiplier);
      result[product.category] += revenue;
    }
  });
  
  return result;
}

/**
 * Calcule le CA total pour une année
 */
export function calculateTotalRevenue(
  products: Product[],
  year: number,
  volumeMultiplier: number = 1,
  priceMultiplier: number = 1
): number {
  const byCategory = calculateRevenueByCategory(products, year, volumeMultiplier, priceMultiplier);
  return byCategory.B2C + byCategory.B2B + byCategory.OEM;
}

/**
 * Calcule le coût des ventes (COGS)
 */
export function calculateCOGS(
  products: Product[],
  year: number,
  volumeMultiplier: number = 1
): number {
  return products.reduce((total, product) => {
    if (product.launchYear <= year) {
      const volumes = (product.volumesByYear[year] || 0) * volumeMultiplier;
      return total + volumes * product.unitCost;
    }
    return total;
  }, 0);
}

/**
 * Calcule les volumes totaux pour une année
 */
export function calculateTotalVolumes(
  products: Product[],
  year: number,
  volumeMultiplier: number = 1
): number {
  return products.reduce((total, product) => {
    if (product.launchYear <= year) {
      return total + (product.volumesByYear[year] || 0) * volumeMultiplier;
    }
    return total;
  }, 0);
}

// ==================
// CALCULS MASSE SALARIALE
// ==================

/**
 * Calcule la masse salariale totale pour une année
 */
export function calculatePayroll(
  roles: Role[],
  year: number,
  hiringDelayYears: number = 0
): number {
  return roles.reduce((total, role) => {
    const effectiveStartYear = role.startYear + hiringDelayYears;
    if (effectiveStartYear <= year) {
      return total + role.annualCostLoaded;
    }
    return total;
  }, 0);
}

/**
 * Calcule la masse salariale par département
 */
export function calculatePayrollByDepartment(
  roles: Role[],
  year: number,
  hiringDelayYears: number = 0
): Record<Department, number> {
  const result: Record<Department, number> = {
    'R&D': 0,
    'Production': 0,
    'Sales': 0,
    'Support': 0,
    'Admin': 0,
  };
  
  roles.forEach(role => {
    const effectiveStartYear = role.startYear + hiringDelayYears;
    if (effectiveStartYear <= year) {
      result[role.department] += role.annualCostLoaded;
    }
  });
  
  return result;
}

/**
 * Calcule les effectifs pour une année
 */
export function calculateHeadcount(
  roles: Role[],
  year: number,
  hiringDelayYears: number = 0
): number {
  return roles.filter(role => (role.startYear + hiringDelayYears) <= year).length;
}

/**
 * Calcule les effectifs par département
 */
export function calculateHeadcountByDepartment(
  roles: Role[],
  year: number,
  hiringDelayYears: number = 0
): Record<Department, number> {
  const result: Record<Department, number> = {
    'R&D': 0,
    'Production': 0,
    'Sales': 0,
    'Support': 0,
    'Admin': 0,
  };
  
  roles.forEach(role => {
    const effectiveStartYear = role.startYear + hiringDelayYears;
    if (effectiveStartYear <= year) {
      result[role.department] += 1;
    }
  });
  
  return result;
}

// ==================
// CALCULS CHARGES OPEX
// ==================

/**
 * Calcule le coût d'une charge pour une année donnée
 */
export function calculateExpenseCost(
  expense: Expense,
  year: number,
  revenue: number,
  volumes: number,
  modifiers?: {
    inflationMultiplier?: number;
    marketingMultiplier?: number;
    delayStepExpensesByYears?: number;
  }
): number {
  if (year < expense.startYear) return 0;
  
  const yearsElapsed = year - expense.startYear;
  let cost = expense.baseAnnualCost;
  const inflationMult = modifiers?.inflationMultiplier || 1;
  
  switch (expense.evolutionType) {
    case 'fixed':
      // Coût fixe avec inflation
      cost = expense.baseAnnualCost * Math.pow(1 + (0.02 * inflationMult), yearsElapsed);
      break;
      
    case 'growth_rate':
      // Croissance annuelle définie
      const rate = expense.growthRate || 0;
      cost = expense.baseAnnualCost * Math.pow(1 + rate, yearsElapsed);
      break;
      
    case 'linked_to_revenue':
      // Ratio du CA
      cost = revenue * (expense.revenueRatio || 0);
      break;
      
    case 'linked_to_volume':
      // Coût par unité
      cost = volumes * (expense.volumeRatio || 0);
      break;
      
    case 'step':
      // Paliers définis
      if (expense.steps) {
        const delayYears = modifiers?.delayStepExpensesByYears || 0;
        const steps = expense.steps
          .filter(s => (s.year + delayYears) <= year)
          .sort((a, b) => b.year - a.year);
        cost = steps.length > 0 ? steps[0].newAnnualCost : expense.baseAnnualCost;
      }
      break;
  }
  
  // Multiplicateur marketing si applicable
  if (expense.category === 'Sales & Marketing' && modifiers?.marketingMultiplier) {
    cost *= modifiers.marketingMultiplier;
  }
  
  return cost;
}

/**
 * Calcule les charges totales par catégorie
 */
export function calculateOpexByCategory(
  expenses: Expense[],
  year: number,
  revenue: number,
  volumes: number,
  modifiers?: {
    inflationMultiplier?: number;
    marketingMultiplier?: number;
    delayStepExpensesByYears?: number;
  }
): Record<ExpenseCategory, number> {
  const result: Record<ExpenseCategory, number> = {
    'R&D': 0,
    'Production': 0,
    'Sales & Marketing': 0,
    'G&A': 0,
    'Logistics': 0,
    'IT & Tools': 0,
  };
  
  expenses.forEach(expense => {
    const cost = calculateExpenseCost(expense, year, revenue, volumes, modifiers);
    result[expense.category] += cost;
  });
  
  return result;
}

/**
 * Calcule les charges totales OPEX
 */
export function calculateTotalOpex(
  expenses: Expense[],
  year: number,
  revenue: number,
  volumes: number,
  modifiers?: {
    inflationMultiplier?: number;
    marketingMultiplier?: number;
    delayStepExpensesByYears?: number;
  }
): number {
  const byCategory = calculateOpexByCategory(expenses, year, revenue, volumes, modifiers);
  return Object.values(byCategory).reduce((a, b) => a + b, 0);
}

/**
 * Calcule l'amortissement des développements produits
 */
export function calculateDepreciation(
  products: Product[],
  year: number
): number {
  return products.reduce((total, product) => {
    const amortYears = product.devAmortizationYears || 5;
    const startYear = product.launchYear;
    const endYear = startYear + amortYears;
    
    if (year >= startYear && year < endYear) {
      return total + product.devCost / amortYears;
    }
    return total;
  }, 0);
}

// ==================
// CALCULS P&L COMPLET
// ==================

/**
 * Calcule tous les indicateurs financiers pour une année
 */
export function calculateFinancialYear(
  products: Product[],
  roles: Role[],
  expenses: Expense[],
  year: number,
  previousCashPosition: number,
  scenario?: Scenario
): FinancialYear {
  const modifiers = scenario?.modifiers || {};
  const volumeMult = modifiers.volumeMultiplier || 1;
  const priceMult = modifiers.priceMultiplier || 1;
  const hiringDelay = modifiers.hiringDelayYears || 0;
  
  // Revenus
  const revenueByCategory = calculateRevenueByCategory(products, year, volumeMult, priceMult);
  const revenue = revenueByCategory.B2C + revenueByCategory.B2B + revenueByCategory.OEM;
  
  // COGS et marge brute
  const cogs = calculateCOGS(products, year, volumeMult);
  const grossMargin = revenue - cogs;
  const grossMarginRate = revenue > 0 ? grossMargin / revenue : 0;
  
  // Masse salariale
  const payroll = calculatePayroll(roles, year, hiringDelay);
  const headcount = calculateHeadcount(roles, year, hiringDelay);
  const headcountByDept = calculateHeadcountByDepartment(roles, year, hiringDelay);
  
  // Volumes pour calcul OPEX
  const volumes = calculateTotalVolumes(products, year, volumeMult);
  
  // OPEX
  const opexByCategory = calculateOpexByCategory(expenses, year, revenue, volumes, modifiers.expenseModifiers);
  const opex = Object.values(opexByCategory).reduce((a, b) => a + b, 0);
  
  // EBITDA
  const ebitda = grossMargin - payroll - opex;
  const ebitdaMargin = revenue > 0 ? ebitda / revenue : 0;
  
  // Amortissements et résultat opérationnel
  const depreciation = calculateDepreciation(products, year);
  const operatingResult = ebitda - depreciation;
  
  // Cash flow simplifié (EBITDA - variation BFR approximée)
  const cashFlow = ebitda * 0.7; // Approximation: 30% immobilisé en BFR
  const cashPosition = previousCashPosition + cashFlow;
  
  return {
    year,
    revenue,
    revenueByCategory,
    cogs,
    grossMargin,
    grossMarginRate,
    payroll,
    opex,
    opexByCategory,
    ebitda,
    ebitdaMargin,
    depreciation,
    operatingResult,
    cashFlow,
    cashPosition,
    headcount,
    headcountByDept,
  };
}

// ==================
// PROJECTIONS MULTI-ANNÉES
// ==================

/**
 * Génère les projections financières sur plusieurs années
 */
export function generateFinancialProjections(
  products: Product[],
  roles: Role[],
  expenses: Expense[],
  assumptions: GlobalAssumptions,
  scenario?: Scenario,
  fundingRounds: FundingRound[] = [],
  numberOfYears: number = 5
): FinancialSummary {
  const startYear = assumptions.baseYear;
  const years: FinancialYear[] = [];
  let cashPosition = 0;
  let maxBurn = 0;
  let minCash = Infinity;
  let breakEvenYear: number | null = null;
  
  // Ajouter le financement initial
  fundingRounds.forEach(round => {
    if (round.year <= startYear) {
      cashPosition += round.amount;
    }
  });
  
  for (let i = 0; i <= numberOfYears; i++) {
    const year = startYear + i;
    
    // Ajouter les levées de l'année
    fundingRounds.forEach(round => {
      if (round.year === year) {
        cashPosition += round.amount;
      }
    });
    
    const financialYear = calculateFinancialYear(
      products,
      roles,
      expenses,
      year,
      cashPosition,
      scenario
    );
    
    years.push(financialYear);
    cashPosition = financialYear.cashPosition;
    
    // Tracking du burn maximum
    if (financialYear.cashFlow < 0) {
      const burn = Math.abs(financialYear.cashFlow);
      if (burn > maxBurn) maxBurn = burn;
    }
    
    // Tracking du cash minimum
    if (cashPosition < minCash) minCash = cashPosition;
    
    // Détecter le break-even
    if (breakEvenYear === null && financialYear.ebitda > 0) {
      breakEvenYear = year;
    }
  }
  
  // Calcul du CAGR
  const startRevenue = years[0]?.revenue || 1;
  const endRevenue = years[years.length - 1]?.revenue || startRevenue;
  const cagr = Math.pow(endRevenue / startRevenue, 1 / numberOfYears) - 1;
  
  // Runway simplifié
  const avgMonthlyBurn = maxBurn / 12;
  const runway = avgMonthlyBurn > 0 ? Math.floor(cashPosition / avgMonthlyBurn) : Infinity;
  
  // Besoin de financement
  const fundingNeed = minCash < 0 ? Math.abs(minCash) * 1.2 : 0;
  
  return {
    years,
    cagr,
    maxBurn,
    runway: runway === Infinity ? 999 : runway,
    breakEvenYear,
    fundingNeed,
  };
}

// ==================
// VALIDATION ET ALERTES
// ==================

/**
 * Valide la cohérence du modèle financier
 */
export function validateFinancialModel(
  products: Product[],
  roles: Role[],
  expenses: Expense[],
  projections: FinancialSummary
): ValidationAlert[] {
  const alerts: ValidationAlert[] = [];
  
  // Vérifier que les produits génèrent du CA
  const hasRevenue = products.some(p => 
    Object.values(p.volumesByYear).some(v => v > 0)
  );
  if (!hasRevenue) {
    alerts.push({
      type: 'error',
      category: 'revenue',
      message: 'Aucun volume de vente défini',
      details: 'Le Plan Produit ne génère aucun chiffre d\'affaires. Définissez des volumes par année.',
    });
  }
  
  // Vérifier le ratio CA/employé
  projections.years.forEach(year => {
    if (year.headcount > 0) {
      const revenuePerEmployee = year.revenue / year.headcount;
      if (revenuePerEmployee < 80000) {
        alerts.push({
          type: 'warning',
          category: 'payroll',
          message: `CA/employé faible en ${year.year}: ${Math.round(revenuePerEmployee/1000)}k€`,
          details: 'Le ratio CA par employé est inférieur à 80k€. Vérifiez l\'adéquation recrutements/croissance.',
        });
      }
    }
  });
  
  // Vérifier le ratio masse salariale/CA
  projections.years.forEach(year => {
    if (year.revenue > 0) {
      const payrollRatio = year.payroll / year.revenue;
      if (payrollRatio > 0.5) {
        alerts.push({
          type: 'warning',
          category: 'payroll',
          message: `Masse salariale élevée en ${year.year}: ${Math.round(payrollRatio * 100)}% du CA`,
          details: 'La masse salariale dépasse 50% du CA. Cela peut impacter la rentabilité.',
        });
      }
    }
  });
  
  // Vérifier le cash négatif
  projections.years.forEach(year => {
    if (year.cashPosition < 0) {
      alerts.push({
        type: 'error',
        category: 'funding',
        message: `Trésorerie négative en ${year.year}`,
        details: `Besoin de financement de ${Math.round(Math.abs(year.cashPosition)/1000)}k€ pour couvrir ce déficit.`,
      });
    }
  });
  
  // Vérifier les charges sans justification
  const unjustifiedExpenses = expenses.filter(e => !e.description);
  if (unjustifiedExpenses.length > 0) {
    alerts.push({
      type: 'info',
      category: 'expense',
      message: `${unjustifiedExpenses.length} charge(s) sans description`,
      details: 'Pour un dossier investisseur complet, chaque charge doit être justifiée.',
    });
  }
  
  return alerts;
}

// ==================
// UTILITAIRES DE FORMATAGE
// ==================

export function formatCurrency(amount: number, compact = false): string {
  if (compact) {
    if (Math.abs(amount) >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M€`;
    }
    if (Math.abs(amount) >= 1000) {
      return `${(amount / 1000).toFixed(0)}k€`;
    }
  }
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatPercent(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('fr-FR').format(value);
}

// ==================
// GÉNÉRATION DE TEXTES INVESTISSEURS
// ==================

/**
 * Génère une phrase de synthèse automatique
 */
export function generateExecutiveSummary(
  summary: FinancialSummary,
  scenario?: Scenario
): string {
  const lastYear = summary.years[summary.years.length - 1];
  const firstYear = summary.years[0];
  
  if (!lastYear || !firstYear) {
    return 'Données insuffisantes pour générer le résumé.';
  }
  
  const revenueGrowth = formatPercent(summary.cagr);
  const finalRevenue = formatCurrency(lastYear.revenue, true);
  const finalEbitda = formatCurrency(lastYear.ebitda, true);
  const ebitdaMargin = formatPercent(lastYear.ebitdaMargin);
  
  let text = `Trajectoire de croissance de ${revenueGrowth} par an pour atteindre ${finalRevenue} de CA`;
  
  if (lastYear.ebitda > 0) {
    text += ` avec un EBITDA de ${finalEbitda} (${ebitdaMargin} de marge).`;
  } else {
    text += `. L'EBITDA sera positif à partir de ${summary.breakEvenYear || 'N/A'}.`;
  }
  
  if (scenario) {
    text += ` — Scénario "${scenario.name}": ${scenario.description}`;
  }
  
  return text;
}

/**
 * Génère la description d'un scénario
 */
export function generateScenarioDescription(scenario: Scenario): string {
  const parts: string[] = [];
  const m = scenario.modifiers;
  
  if (m.volumeMultiplier && m.volumeMultiplier !== 1) {
    const pct = Math.round((m.volumeMultiplier - 1) * 100);
    parts.push(`volumes ${pct > 0 ? '+' : ''}${pct}%`);
  }
  
  if (m.priceMultiplier && m.priceMultiplier !== 1) {
    const pct = Math.round((m.priceMultiplier - 1) * 100);
    parts.push(`prix ${pct > 0 ? '+' : ''}${pct}%`);
  }
  
  if (m.hiringDelayYears && m.hiringDelayYears > 0) {
    parts.push(`recrutements décalés de ${m.hiringDelayYears} an(s)`);
  }
  
  if (m.expenseModifiers?.marketingMultiplier && m.expenseModifiers.marketingMultiplier !== 1) {
    const pct = Math.round((m.expenseModifiers.marketingMultiplier - 1) * 100);
    parts.push(`marketing ${pct > 0 ? '+' : ''}${pct}%`);
  }
  
  return parts.length > 0 ? parts.join(', ') : 'Aucune modification';
}
