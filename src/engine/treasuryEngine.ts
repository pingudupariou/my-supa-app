// ============================================
// MOTEUR DE TRÉSORERIE UNIFIÉ
// Source unique pour tous les calculs de cash-flow, EBITDA, CAPEX
// ============================================

import { Product, Role, Expense, FundingRound } from './types';
import { ScenarioConfig, SimpleOpexConfig } from '@/context/FinancialContext';

// ==================
// TYPES
// ==================

export type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';

export interface FundingRoundWithQuarter extends FundingRound {
  quarter: Quarter;
}

export interface ProductAmortization {
  productId: string;
  productName: string;
  devCost: number;
  launchYear: number;
  amortizationYears: number;
  yearlyAmortization: number;
}

export interface YearlyProjection {
  year: number;
  // Entrées
  revenue: number;
  fundingInjection: number;
  // Sorties
  cogs: number;
  payroll: number;
  opex: number;
  capex: number;
  // Marge et EBITDA
  grossMargin: number;
  grossMarginRate: number;
  ebitda: number;
  ebitdaMargin: number;
  // Amortissements
  depreciation: number;
  depreciationByProduct: Record<string, number>;
  // Résultat
  operatingResult: number;
  // Cash Flow = CA - COGS - OPEX - Salaires - CAPEX (pas d'amortissement car non cash)
  totalCosts: number;
  cashFlow: number;
  // Trésorerie
  treasuryStart: number;
  treasuryEnd: number;
  // Détail trimestriel pour calcul intra-année
  quarterlyTreasury: Record<Quarter, number>;
  minTreasuryInYear: number;
  // Headcount
  headcount: number;
}

export interface TreasuryProjection {
  years: YearlyProjection[];
  initialCash: number;
  totalFundingRaised: number;
  fundingNeed: number; // max(0, -trésorerie minimale projetée)
  minTreasury: number;
  breakEvenYear: number | null;
  maxBurn: number;
  runway: number; // en mois
  // Détails CAPEX/Amortissements
  productAmortizations: ProductAmortization[];
  totalCapex: number;
  totalDepreciation: number;
}

// ==================
// CALCULS AUXILIAIRES
// ==================

function calculateRevenueForYear(
  products: Product[],
  year: number,
  scenarioConfig: ScenarioConfig
): { revenue: number; cogs: number } {
  let revenue = 0;
  let cogs = 0;

  products.forEach(product => {
    const volumesByChannel = product.volumesByChannel;

    if (volumesByChannel) {
      const priceHT_B2C = product.priceHT || (product.priceTTC_B2C / (1 + (product.vatRate || 0.20)));
      const coef_shop = product.coef_shop || 1.6;
      const coef_dist = product.coef_dist || 1.3;
      const coef_oem = product.coef_oem || 1.4;

      const priceMarqueB2B_HT = priceHT_B2C / coef_shop / coef_dist;
      const priceOEM_HT = product.unitCost * coef_oem;

      // B2C
      const volB2C = Math.round((volumesByChannel.B2C[year] || 0) * (1 + scenarioConfig.volumeAdjustment));
      revenue += volB2C * priceHT_B2C * (1 + scenarioConfig.priceAdjustment);
      cogs += volB2C * product.unitCost;

      // B2B
      const volB2B = Math.round((volumesByChannel.B2B[year] || 0) * (1 + scenarioConfig.volumeAdjustment));
      revenue += volB2B * priceMarqueB2B_HT * (1 + scenarioConfig.priceAdjustment);
      cogs += volB2B * product.unitCost;

      // OEM
      const volOEM = Math.round((volumesByChannel.OEM[year] || 0) * (1 + scenarioConfig.volumeAdjustment));
      revenue += volOEM * priceOEM_HT * (1 + scenarioConfig.priceAdjustment);
      cogs += volOEM * product.unitCost;
    } else if (product.volumesByYear[year]) {
      const volume = Math.round(product.volumesByYear[year] * (1 + scenarioConfig.volumeAdjustment));
      revenue += volume * product.priceHT * (1 + scenarioConfig.priceAdjustment);
      cogs += volume * product.unitCost;
    }
  });

  return { revenue, cogs };
}

function calculatePayrollForYear(roles: Role[], year: number): { payroll: number; headcount: number } {
  let payroll = 0;
  let headcount = 0;
  
  roles.forEach(role => {
    if (role.startYear <= year) {
      payroll += role.annualCostLoaded;
      headcount += 1;
    }
  });
  
  return { payroll, headcount };
}

function calculateOpexForYear(
  expenses: Expense[],
  year: number,
  startYear: number,
  revenue: number,
  volumes: number,
  scenarioConfig: ScenarioConfig,
  opexMode: 'detailed' | 'simple' = 'detailed',
  simpleOpexConfig?: SimpleOpexConfig
): number {
  // Mode simplifié : un montant de base avec taux d'évolution
  if (opexMode === 'simple' && simpleOpexConfig) {
    const yearIndex = year - startYear;
    const opex = simpleOpexConfig.baseAmount * Math.pow(1 + simpleOpexConfig.growthRate, yearIndex);
    return opex * (1 + scenarioConfig.opexAdjustment);
  }

  // Mode détaillé : calcul par poste
  let opex = 0;

  expenses.forEach(expense => {
    if (expense.startYear > year) return;

    let cost = expense.baseAnnualCost;
    const yearsSinceStart = year - expense.startYear;

    switch (expense.evolutionType) {
      case 'fixed':
        break;
      case 'growth_rate':
        cost = expense.baseAnnualCost * Math.pow(1 + (expense.growthRate || 0), yearsSinceStart);
        break;
      case 'linked_to_revenue':
        cost = revenue * (expense.revenueRatio || 0);
        break;
      case 'linked_to_volume':
        cost = volumes * (expense.volumeRatio || 0);
        break;
      case 'step':
        const applicableStep = expense.steps?.filter(s => s.year <= year).pop();
        if (applicableStep) cost = applicableStep.newAnnualCost;
        break;
    }

    cost = cost * (1 + scenarioConfig.opexAdjustment);
    opex += cost;
  });

  return opex;
}

/**
 * Calcule le CAPEX de l'année = coûts de développement des produits lancés cette année
 */
function calculateCapexForYear(products: Product[], year: number): number {
  return products.reduce((total, product) => {
    if (product.launchYear === year) {
      return total + product.devCost;
    }
    return total;
  }, 0);
}

/**
 * Calcule l'amortissement total pour une année avec détail par produit
 * Chaque produit utilise sa propre durée d'amortissement (devAmortizationYears)
 */
function calculateDepreciationForYear(
  products: Product[],
  year: number
): { total: number; byProduct: Record<string, number> } {
  let total = 0;
  const byProduct: Record<string, number> = {};

  products.forEach(product => {
    const amortYears = product.devAmortizationYears || 5;
    const startYear = product.launchYear;
    const endYear = startYear + amortYears;
    
    if (year >= startYear && year < endYear) {
      const yearlyAmort = product.devCost / amortYears;
      total += yearlyAmort;
      byProduct[product.id] = yearlyAmort;
    } else {
      byProduct[product.id] = 0;
    }
  });

  return { total, byProduct };
}

function calculateTotalVolumes(products: Product[], year: number, scenarioConfig: ScenarioConfig): number {
  return products.reduce((total, product) => {
    if (product.volumesByChannel) {
      const b2c = Math.round((product.volumesByChannel.B2C[year] || 0) * (1 + scenarioConfig.volumeAdjustment));
      const b2b = Math.round((product.volumesByChannel.B2B[year] || 0) * (1 + scenarioConfig.volumeAdjustment));
      const oem = Math.round((product.volumesByChannel.OEM[year] || 0) * (1 + scenarioConfig.volumeAdjustment));
      return total + b2c + b2b + oem;
    }
    return total + Math.round((product.volumesByYear[year] || 0) * (1 + scenarioConfig.volumeAdjustment));
  }, 0);
}

/**
 * Génère la liste des amortissements par produit pour affichage
 */
function buildProductAmortizations(products: Product[]): ProductAmortization[] {
  return products.map(product => {
    const amortYears = product.devAmortizationYears || 5;
    return {
      productId: product.id,
      productName: product.name,
      devCost: product.devCost,
      launchYear: product.launchYear,
      amortizationYears: amortYears,
      yearlyAmortization: product.devCost / amortYears,
    };
  });
}

// ==================
// MOTEUR PRINCIPAL
// ==================

export function calculateTreasuryProjection(
  products: Product[],
  roles: Role[],
  expenses: Expense[],
  fundingRounds: FundingRoundWithQuarter[],
  initialCash: number,
  startYear: number,
  durationYears: number,
  scenarioConfig: ScenarioConfig,
  opexMode: 'detailed' | 'simple' = 'detailed',
  simpleOpexConfig?: SimpleOpexConfig
): TreasuryProjection {
  const years: YearlyProjection[] = [];
  let currentTreasury = initialCash;
  let globalMinTreasury = initialCash;
  let globalMinTreasuryWithoutFunding = initialCash; // Pour calcul besoin de financement
  let maxBurn = 0;
  let breakEvenYear: number | null = null;
  let totalFundingRaised = 0;
  let accumulatedCapex = 0;
  let accumulatedDepreciation = 0;

  // Pré-calculer les amortissements par produit
  const productAmortizations = buildProductAmortizations(products);

  for (let i = 0; i < durationYears; i++) {
    const year = startYear + i;
    const treasuryStart = currentTreasury;

    // Calculs annuels
    const { revenue, cogs } = calculateRevenueForYear(products, year, scenarioConfig);
    const { payroll, headcount } = calculatePayrollForYear(roles, year);
    const volumes = calculateTotalVolumes(products, year, scenarioConfig);
    const opex = calculateOpexForYear(expenses, year, startYear, revenue, volumes, scenarioConfig, opexMode, simpleOpexConfig);
    const capex = calculateCapexForYear(products, year);
    const { total: depreciation, byProduct: depreciationByProduct } = calculateDepreciationForYear(products, year);

    accumulatedCapex += capex;
    accumulatedDepreciation += depreciation;

    // Marge brute
    const grossMargin = revenue - cogs;
    const grossMarginRate = revenue > 0 ? grossMargin / revenue : 0;

    // EBITDA = Marge Brute - Salaires - OPEX
    const ebitda = grossMargin - payroll - opex;
    const ebitdaMargin = revenue > 0 ? ebitda / revenue : 0;

    // Résultat d'exploitation = EBITDA - Amortissements
    const operatingResult = ebitda - depreciation;

    // Cash-flow annuel = CA - COGS - OPEX - Salaires - CAPEX
    // Note: Amortissement n'est PAS dans le cash-flow car c'est non-cash
    const totalCosts = cogs + payroll + opex + capex;
    const cashFlow = revenue - totalCosts;

    // Levées de l'année
    const yearRounds = fundingRounds.filter(r => r.year === year);
    const fundingInjection = yearRounds.reduce((sum, r) => sum + r.amount, 0);
    totalFundingRaised += fundingInjection;

    // Calcul trimestriel pour trouver le min intra-année
    const quarterlyCashFlow = cashFlow / 4;
    const quarterlyTreasury: Record<Quarter, number> = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
    let minTreasuryInYear = treasuryStart;
    let runningTreasury = treasuryStart;

    const quarters: Quarter[] = ['Q1', 'Q2', 'Q3', 'Q4'];
    quarters.forEach((q) => {
      const quarterRounds = yearRounds.filter(r => r.quarter === q);
      const quarterFunding = quarterRounds.reduce((sum, r) => sum + r.amount, 0);

      runningTreasury += quarterlyCashFlow + quarterFunding;
      quarterlyTreasury[q] = runningTreasury;

      if (runningTreasury < minTreasuryInYear) {
        minTreasuryInYear = runningTreasury;
      }
    });

    // Trésorerie fin d'année
    const treasuryEnd = treasuryStart + cashFlow + fundingInjection;
    currentTreasury = treasuryEnd;

    // Track global minimum (avec levées - pour affichage)
    if (minTreasuryInYear < globalMinTreasury) {
      globalMinTreasury = minTreasuryInYear;
    }
    
    // Calcul trésorerie SANS levée pour déterminer le besoin réel de financement
    // = tréso initiale + somme des cash flows (sans injection de fonds)
    const treasuryWithoutFunding = initialCash + years.reduce((sum, y) => sum + y.cashFlow, 0) + cashFlow;
    if (treasuryWithoutFunding < globalMinTreasuryWithoutFunding) {
      globalMinTreasuryWithoutFunding = treasuryWithoutFunding;
    }

    // Track max burn
    if (cashFlow < 0 && Math.abs(cashFlow) > maxBurn) {
      maxBurn = Math.abs(cashFlow);
    }

    // Break-even (premier cash-flow positif)
    if (breakEvenYear === null && cashFlow > 0) {
      breakEvenYear = year;
    }

    years.push({
      year,
      revenue,
      fundingInjection,
      cogs,
      payroll,
      opex,
      capex,
      grossMargin,
      grossMarginRate,
      ebitda,
      ebitdaMargin,
      depreciation,
      depreciationByProduct,
      operatingResult,
      totalCosts,
      cashFlow,
      treasuryStart,
      treasuryEnd,
      quarterlyTreasury,
      minTreasuryInYear,
      headcount,
    });
  }

  // Besoin de financement = max(0, -trésorerie minimale projetée SANS levée)
  // C'est le montant nécessaire pour couvrir le point bas si on n'avait pas de financement
  const fundingNeed = Math.max(0, -globalMinTreasuryWithoutFunding);

  // Runway en mois
  const avgMonthlyBurn = maxBurn / 12;
  const runway = avgMonthlyBurn > 0 ? Math.floor(initialCash / avgMonthlyBurn) : 999;

  return {
    years,
    initialCash,
    totalFundingRaised,
    fundingNeed,
    minTreasury: globalMinTreasury,
    breakEvenYear,
    maxBurn,
    runway,
    productAmortizations,
    totalCapex: accumulatedCapex,
    totalDepreciation: accumulatedDepreciation,
  };
}

// ==================
// HELPERS
// ==================

export function createFundingRoundWithQuarter(
  round: FundingRound,
  quarter: Quarter = 'Q1'
): FundingRoundWithQuarter {
  return { ...round, quarter };
}

export function getDefaultQuarter(): Quarter {
  return 'Q1';
}

export const QUARTERS: Quarter[] = ['Q1', 'Q2', 'Q3', 'Q4'];
