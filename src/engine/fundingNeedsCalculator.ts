// ============================================
// CALCUL AUTOMATIQUE DES BESOINS DE FINANCEMENT
// Basé sur Plan Produit, Masse Salariale, CAPEX, OPEX
// ============================================

import { Product, Role, Expense, GlobalAssumptions } from './types';
import { calculatePayroll, calculateTotalOpex, calculateTotalRevenue, calculateCOGS, calculateTotalVolumes } from './calculations';

// ==================
// TYPES SPÉCIFIQUES AU FUNDING
// ==================

export interface YearlyFundingNeed {
  year: number;
  // Revenus
  revenue: number;
  // Charges
  payroll: number;
  opex: number;
  capex: number; // Coûts de développement produits
  cogs: number;
  // Résultats
  ebitda: number;
  cashFlow: number;
  cumulativeCashFlow: number;
  fundingNeed: number; // Besoin si négatif
}

export interface FundingNeedsSummary {
  yearlyNeeds: YearlyFundingNeed[];
  totalPayroll: number;
  totalOpex: number;
  totalCapex: number;
  totalCogs: number;
  totalRevenue: number;
  maxBurn: number;
  totalFundingNeed: number;
  breakEvenYear: number | null;
}

export interface OpexItem {
  id: string;
  name: string;
  category: string;
  baseAmount: number;
  yearlyAmounts: Record<number, number>;
  evolutionType: 'fixed' | 'growth_rate' | 'linked_to_revenue' | 'manual';
  growthRate?: number;
  revenueRatio?: number;
}

// ==================
// CALCUL DES CAPEX (Coûts développement produits)
// ==================

export function calculateCapexByYear(
  products: Product[],
  startYear: number,
  endYear: number
): Record<number, number> {
  const capexByYear: Record<number, number> = {};
  
  for (let year = startYear; year <= endYear; year++) {
    capexByYear[year] = 0;
  }
  
  products.forEach(product => {
    // Le coût de développement est réparti sur l'année avant le lancement
    // ou l'année de lancement selon la config
    const devYear = product.launchYear;
    if (devYear >= startYear && devYear <= endYear) {
      capexByYear[devYear] = (capexByYear[devYear] || 0) + product.devCost;
    }
  });
  
  return capexByYear;
}

export function calculateTotalCapex(products: Product[]): number {
  return products.reduce((total, p) => total + p.devCost, 0);
}

// ==================
// CALCUL DES BESOINS DE FINANCEMENT
// ==================

export function calculateFundingNeeds(
  products: Product[],
  roles: Role[],
  expenses: Expense[],
  assumptions: GlobalAssumptions,
  startYear: number = 2025,
  numberOfYears: number = 5,
  initialCash: number = 0
): FundingNeedsSummary {
  const yearlyNeeds: YearlyFundingNeed[] = [];
  let cumulativeCashFlow = initialCash;
  let maxBurn = 0;
  
  let totalPayroll = 0;
  let totalOpex = 0;
  let totalCapex = 0;
  let totalCogs = 0;
  let totalRevenue = 0;
  let breakEvenYear: number | null = null;
  
  const capexByYear = calculateCapexByYear(products, startYear, startYear + numberOfYears);
  
  for (let i = 0; i <= numberOfYears; i++) {
    const year = startYear + i;
    
    // Revenus
    const revenue = calculateTotalRevenue(products, year);
    totalRevenue += revenue;
    
    // COGS
    const cogs = calculateCOGS(products, year);
    totalCogs += cogs;
    
    // Masse salariale
    const payroll = calculatePayroll(roles, year);
    totalPayroll += payroll;
    
    // OPEX
    const volumes = calculateTotalVolumes(products, year);
    const opex = calculateTotalOpex(expenses, year, revenue, volumes);
    totalOpex += opex;
    
    // CAPEX
    const capex = capexByYear[year] || 0;
    totalCapex += capex;
    
    // Calculs
    const grossMargin = revenue - cogs;
    const ebitda = grossMargin - payroll - opex;
    const cashFlow = ebitda - capex;
    
    cumulativeCashFlow += cashFlow;
    
    if (cashFlow < 0 && Math.abs(cashFlow) > maxBurn) {
      maxBurn = Math.abs(cashFlow);
    }
    
    // Besoin = valeur absolue si cumulatif négatif
    const fundingNeed = cumulativeCashFlow < 0 ? Math.abs(cumulativeCashFlow) : 0;
    
    // Break-even
    if (breakEvenYear === null && ebitda > 0) {
      breakEvenYear = year;
    }
    
    yearlyNeeds.push({
      year,
      revenue,
      payroll,
      opex,
      capex,
      cogs,
      ebitda,
      cashFlow,
      cumulativeCashFlow,
      fundingNeed,
    });
  }
  
  // Total funding need = max du besoin cumulatif négatif
  const totalFundingNeed = Math.max(0, ...yearlyNeeds.map(y => y.fundingNeed));
  
  return {
    yearlyNeeds,
    totalPayroll,
    totalOpex,
    totalCapex,
    totalCogs,
    totalRevenue,
    maxBurn,
    totalFundingNeed,
    breakEvenYear,
  };
}

// ==================
// OPEX MANAGEMENT
// ==================

export function createDefaultOpexItems(expenses: Expense[]): OpexItem[] {
  return expenses.map(expense => ({
    id: expense.id,
    name: expense.name,
    category: expense.category,
    baseAmount: expense.baseAnnualCost,
    yearlyAmounts: {},
    evolutionType: expense.evolutionType === 'fixed' ? 'fixed' : 
                   expense.evolutionType === 'growth_rate' ? 'growth_rate' :
                   expense.evolutionType === 'linked_to_revenue' ? 'linked_to_revenue' : 'manual',
    growthRate: expense.growthRate,
    revenueRatio: expense.revenueRatio,
  }));
}

export function calculateOpexItemForYear(
  item: OpexItem,
  year: number,
  baseYear: number,
  revenue: number
): number {
  // Si montant manuel défini pour cette année, l'utiliser
  if (item.yearlyAmounts[year] !== undefined) {
    return item.yearlyAmounts[year];
  }
  
  const yearsElapsed = year - baseYear;
  
  switch (item.evolutionType) {
    case 'fixed':
      return item.baseAmount;
    case 'growth_rate':
      return item.baseAmount * Math.pow(1 + (item.growthRate || 0), yearsElapsed);
    case 'linked_to_revenue':
      return revenue * (item.revenueRatio || 0);
    case 'manual':
    default:
      return item.baseAmount;
  }
}
