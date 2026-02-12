// ============================================
// MOTEUR DE TRÉSORERIE MENSUELLE
// Source unique pour tous les calculs de cash-flow mensuels
// ============================================

import { Product, FundingRound, Quarter } from './types';
import { ScenarioConfig } from '@/context/FinancialContext';

// ==================
// TYPES
// ==================

export const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
] as const;

export type MonthName = typeof MONTHS[number];
export type MonthIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

// Saisonnalité: variation relative par rapport à la moyenne
// valeur = 0 signifie exactement la moyenne
// valeur = 0.20 signifie +20% par rapport à la moyenne
export type SeasonalityConfig = Record<MonthIndex, number>;

// Configuration des charges variables (% du CA)
export interface VariableChargeConfig {
  id: string;
  name: string;
  rateOfRevenue: number; // % du CA (ex: 0.03 = 3%)
  description?: string;
}

// Mode de saisie du prêt
export type LoanInputMode = 'calculated' | 'fixed';

// Configuration d'un prêt
export interface LoanConfig {
  id: string;
  name: string;
  inputMode: LoanInputMode;
  // Mode "calculated": on calcule l'échéance à partir du capital + taux
  principalAmount: number;
  interestRate: number; // Taux annuel (ex: 0.05 = 5%)
  // Mode "fixed": on saisit directement le montant de l'échéance
  fixedPaymentAmount?: number;
  // Commun
  startDate: { year: number; month: MonthIndex };
  endDate: { year: number; month: MonthIndex };
  frequency: 'monthly' | 'quarterly' | 'annual';
  // Échéances modifiées manuellement (optionnel)
  manualPayments?: Record<string, number>; // key = "YYYY-MM"
}

// Échéance de prêt calculée
export interface LoanPayment {
  loanId: string;
  loanName: string;
  year: number;
  month: MonthIndex;
  principal: number;
  interest: number;
  total: number;
  isManuallyModified: boolean;
}

// Configuration d'un paiement CAPEX (lié à un produit)
export interface CapexPaymentConfig {
  id: string;
  productId: string;
  productName: string;
  year: number;
  month: MonthIndex;
  percentageOfTotal: number; // % du devCost total (ex: 25 = 25%)
  amount: number; // Montant calculé
}

// Conditions de paiement fournisseur (achats matière)
export interface PaymentTermLine {
  delayMonths: number; // Décalage en mois (0 = mois courant, 1 = M+1, etc.)
  percentage: number;  // % du paiement total (ex: 30 = 30%)
}

export type PaymentTermsConfig = PaymentTermLine[];

export function getDefaultPaymentTerms(): PaymentTermsConfig {
  return [{ delayMonths: 0, percentage: 100 }]; // Paiement comptant par défaut
}

// Configuration complète du plan de trésorerie mensuel
export interface MonthlyTreasuryConfig {
  // Saisonnalité du CA (variations relatives)
  revenueSeasonality: SeasonalityConfig;
  // Saisonnalité des achats/COGS
  cogsSeasonality: SeasonalityConfig;
  // Conditions de paiement fournisseur
  cogsPaymentTerms: PaymentTermsConfig;
  // Charges variables (% du CA)
  variableCharges: VariableChargeConfig[];
  // Prêts
  loans: LoanConfig[];
  // CAPEX (paiements liés aux produits)
  capexPayments: CapexPaymentConfig[];
  // Autres entrées ponctuelles { "YYYY-MM": amount }
  otherInflows: Record<string, { amount: number; label: string }>;
  // Autres sorties ponctuelles
  otherOutflows: Record<string, { amount: number; label: string }>;
}

// Données mensuelles calculées
export interface MonthlyData {
  year: number;
  month: MonthIndex;
  monthName: MonthName;
  
  // Entrées
  revenue: number; // CA encaissé
  fundingInjection: number; // Levée de fonds
  otherInflows: number;
  totalInflows: number;
  
  // Sorties
  cogs: number; // Achats
  payroll: number; // Masse salariale
  opex: number; // Charges fixes
  variableCharges: number; // Charges variables (% CA)
  loanPayments: number; // Échéances de prêts
  capexPayments: number; // CAPEX (investissements produits)
  otherOutflows: number;
  totalOutflows: number;
  
  // Trésorerie
  treasuryStart: number;
  netCashFlow: number;
  treasuryEnd: number;
  
  // Détails
  loanPaymentDetails: LoanPayment[];
  variableChargeDetails: { name: string; amount: number }[];
  capexPaymentDetails: CapexPaymentConfig[];
}

// Projection mensuelle complète
export interface MonthlyTreasuryProjection {
  months: MonthlyData[];
  initialCash: number;
  totalFundingRaised: number;
  minTreasury: number;
  minTreasuryMonth: { year: number; month: MonthIndex } | null;
  breakEvenMonth: { year: number; month: MonthIndex } | null;
  totalVariableCharges: number;
  totalLoanPayments: number;
  totalCapexPayments: number;
}

// ==================
// VALEURS PAR DÉFAUT
// ==================

export function getDefaultSeasonality(): SeasonalityConfig {
  return {
    0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0,
    6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0,
  };
}

export function getDefaultMonthlyTreasuryConfig(): MonthlyTreasuryConfig {
  return {
    revenueSeasonality: getDefaultSeasonality(),
    cogsSeasonality: getDefaultSeasonality(),
    cogsPaymentTerms: getDefaultPaymentTerms(),
    variableCharges: [],
    loans: [],
    capexPayments: [],
    otherInflows: {},
    otherOutflows: {},
  };
}

// ==================
// CALCULS AUXILIAIRES
// ==================

/**
 * Normalise la saisonnalité pour que la somme des mois = 12x la moyenne
 * Retourne les coefficients multiplicateurs normalisés
 */
function normalizeSeasonality(seasonality: SeasonalityConfig): number[] {
  // Calculer les coefficients bruts (1 + variation)
  const rawCoefs = Object.values(seasonality).map(v => 1 + v);
  
  // Somme des coefficients bruts
  const sumRaw = rawCoefs.reduce((a, b) => a + b, 0);
  
  // Normaliser pour que la somme = 12 (moyenne = 1)
  if (sumRaw === 0) {
    return Array(12).fill(1);
  }
  
  return rawCoefs.map(c => (c / sumRaw) * 12);
}

/**
 * Calcule les échéances d'un prêt (automatique ou manuel)
 */
function getLoanPayments(loan: LoanConfig, startYear: number, durationYears: number): LoanPayment[] {
  const payments: LoanPayment[] = [];
  const periodEnd = startYear + durationYears;

  // Si des échéances manuelles existent, les utiliser
  if (loan.manualPayments && Object.keys(loan.manualPayments).length > 0) {
    Object.entries(loan.manualPayments).forEach(([key, amount]) => {
      const parsed = parseMonthKey(key);
      if (!parsed) return;
      const { year, month } = parsed;
      if (year >= startYear && year < periodEnd) {
        payments.push({
          loanId: loan.id, loanName: loan.name, year, month,
          principal: amount, interest: 0, total: amount, isManuallyModified: true,
        });
      }
    });
    payments.sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
    return payments;
  }

  const startMonth = loan.startDate.year * 12 + loan.startDate.month;
  const endMonth = loan.endDate.year * 12 + loan.endDate.month;

  // Mode "fixed": échéances fixes saisies par l'utilisateur
  if (loan.inputMode === 'fixed') {
    const fixedAmount = loan.fixedPaymentAmount || 0;
    if (fixedAmount <= 0) return payments;

    if (loan.frequency === 'monthly') {
      for (let absMonth = startMonth; absMonth < endMonth; absMonth++) {
        const year = Math.floor(absMonth / 12);
        const month = (absMonth % 12) as MonthIndex;
        if (year < startYear || year >= periodEnd) continue;
        payments.push({
          loanId: loan.id, loanName: loan.name, year, month,
          principal: fixedAmount, interest: 0, total: fixedAmount, isManuallyModified: false,
        });
      }
    } else if (loan.frequency === 'quarterly') {
      for (let absMonth = startMonth; absMonth < endMonth; absMonth++) {
        const year = Math.floor(absMonth / 12);
        const month = (absMonth % 12) as MonthIndex;
        if (year < startYear || year >= periodEnd) continue;
        if ((absMonth - startMonth) % 3 !== 0) continue;
        payments.push({
          loanId: loan.id, loanName: loan.name, year, month,
          principal: fixedAmount, interest: 0, total: fixedAmount, isManuallyModified: false,
        });
      }
    } else {
      // annual
      for (let i = 0; i < Math.max(1, Math.round((endMonth - startMonth) / 12)); i++) {
        const year = loan.startDate.year + i;
        if (year < startYear || year >= periodEnd) continue;
        payments.push({
          loanId: loan.id, loanName: loan.name, year, month: loan.startDate.month,
          principal: fixedAmount, interest: 0, total: fixedAmount, isManuallyModified: false,
        });
      }
    }
    return payments;
  }

  // Mode "calculated": calcul automatique des échéances
  if (endMonth <= startMonth) return payments;

  if (loan.frequency === 'monthly') {
    const numPayments = endMonth - startMonth;
    if (numPayments <= 0) return payments;
    
    const monthlyRate = loan.interestRate / 12;
    let monthlyPayment: number;
    if (monthlyRate === 0) {
      monthlyPayment = loan.principalAmount / numPayments;
    } else {
      monthlyPayment = loan.principalAmount * monthlyRate * Math.pow(1 + monthlyRate, numPayments) / (Math.pow(1 + monthlyRate, numPayments) - 1);
    }

    let remainingPrincipal = loan.principalAmount;
    for (let i = 0; i < numPayments; i++) {
      const absMonth = startMonth + i;
      const year = Math.floor(absMonth / 12);
      const month = (absMonth % 12) as MonthIndex;
      
      if (year < startYear || year >= periodEnd) continue;
      
      const interest = remainingPrincipal * monthlyRate;
      const principal = monthlyPayment - interest;
      remainingPrincipal -= principal;

      payments.push({
        loanId: loan.id, loanName: loan.name, year, month,
        principal: Math.max(0, principal), interest, total: monthlyPayment,
        isManuallyModified: false,
      });
    }
  } else if (loan.frequency === 'quarterly') {
    const numQuarters = Math.max(1, Math.round((endMonth - startMonth) / 3));
    const quarterlyRate = loan.interestRate / 4;
    let quarterlyPayment: number;
    if (quarterlyRate === 0) {
      quarterlyPayment = loan.principalAmount / numQuarters;
    } else {
      quarterlyPayment = loan.principalAmount * quarterlyRate * Math.pow(1 + quarterlyRate, numQuarters) / (Math.pow(1 + quarterlyRate, numQuarters) - 1);
    }

    let remainingPrincipal = loan.principalAmount;
    for (let i = 0; i < numQuarters; i++) {
      const absMonth = startMonth + i * 3;
      const year = Math.floor(absMonth / 12);
      const month = (absMonth % 12) as MonthIndex;
      
      if (year < startYear || year >= periodEnd) continue;
      
      const interest = remainingPrincipal * quarterlyRate;
      const principal = quarterlyPayment - interest;
      remainingPrincipal -= principal;

      payments.push({
        loanId: loan.id, loanName: loan.name, year, month,
        principal: Math.max(0, principal), interest, total: quarterlyPayment,
        isManuallyModified: false,
      });
    }
  } else {
    // Fréquence annuelle
    const numYears = Math.max(1, Math.round((endMonth - startMonth) / 12));
    const annualRate = loan.interestRate;
    let annualPayment: number;
    if (annualRate === 0) {
      annualPayment = loan.principalAmount / numYears;
    } else {
      annualPayment = loan.principalAmount * annualRate * Math.pow(1 + annualRate, numYears) / (Math.pow(1 + annualRate, numYears) - 1);
    }

    let remainingPrincipal = loan.principalAmount;
    for (let i = 0; i < numYears; i++) {
      const year = loan.startDate.year + i;
      const month = loan.startDate.month;
      
      if (year < startYear || year >= periodEnd) continue;
      
      const interest = remainingPrincipal * annualRate;
      const principal = annualPayment - interest;
      remainingPrincipal -= principal;

      payments.push({
        loanId: loan.id, loanName: loan.name, year, month,
        principal: Math.max(0, principal), interest, total: annualPayment,
        isManuallyModified: false,
      });
    }
  }

  return payments;
}

/**
 * Détermine le trimestre d'un mois
 */
function getQuarterFromMonth(month: MonthIndex): Quarter {
  if (month <= 2) return 'Q1';
  if (month <= 5) return 'Q2';
  if (month <= 8) return 'Q3';
  return 'Q4';
}

// ==================
// MOTEUR PRINCIPAL
// ==================

export interface MonthlyInputData {
  // Données annuelles depuis les autres modules
  annualRevenue: Record<number, number>;
  annualCogs: Record<number, number>;
  annualPayroll: Record<number, number>;
  annualOpex: Record<number, number>;
}

export function calculateMonthlyTreasuryProjection(
  config: MonthlyTreasuryConfig,
  inputData: MonthlyInputData,
  fundingRounds: FundingRound[],
  initialCash: number,
  startYear: number,
  durationYears: number,
  excludeFunding: boolean = false
): MonthlyTreasuryProjection {
  const months: MonthlyData[] = [];
  let currentTreasury = initialCash;
  let minTreasury = initialCash;
  let minTreasuryMonth: { year: number; month: MonthIndex } | null = null;
  let breakEvenMonth: { year: number; month: MonthIndex } | null = null;
  let totalFundingRaised = 0;
  let totalVariableCharges = 0;
  let totalLoanPayments = 0;
  let totalCapexPayments = 0;

  // Normaliser les saisonnalités
  const revenueCoefs = normalizeSeasonality(config.revenueSeasonality);
  const cogsCoefs = normalizeSeasonality(config.cogsSeasonality);
  
  // Conditions de paiement fournisseur
  const paymentTerms = config.cogsPaymentTerms && config.cogsPaymentTerms.length > 0
    ? config.cogsPaymentTerms
    : [{ delayMonths: 0, percentage: 100 }];
  
  // Normaliser les % pour qu'ils totalisent 100
  const termsTotalPct = paymentTerms.reduce((s, t) => s + t.percentage, 0);
  const normalizedTerms = termsTotalPct > 0
    ? paymentTerms.map(t => ({ ...t, percentage: t.percentage / termsTotalPct }))
    : [{ delayMonths: 0, percentage: 1 }];

  // Récupérer toutes les échéances de prêts (mode manuel)
  const allLoanPayments: LoanPayment[] = [];
  config.loans.forEach(loan => {
    allLoanPayments.push(...getLoanPayments(loan, startYear, durationYears));
  });
  
  // Récupérer tous les paiements CAPEX
  const allCapexPayments = config.capexPayments || [];

  // Pré-calculer les COGS par mois (avant délais de paiement)
  const totalMonths = durationYears * 12;
  const rawMonthlyCogs: number[] = [];
  for (let yearOffset = 0; yearOffset < durationYears; yearOffset++) {
    const year = startYear + yearOffset;
    const yearCogs = inputData.annualCogs[year] || 0;
    const avgMonthlyCogs = yearCogs / 12;
    for (let month = 0; month < 12; month++) {
      rawMonthlyCogs.push(avgMonthlyCogs * cogsCoefs[month]);
    }
  }
  
  // Appliquer les conditions de paiement (décaler les COGS)
  const paidMonthlyCogs = new Array(totalMonths + 24).fill(0); // buffer pour les délais
  rawMonthlyCogs.forEach((cogsAmount, absMonth) => {
    normalizedTerms.forEach(term => {
      const targetMonth = absMonth + term.delayMonths;
      if (targetMonth < paidMonthlyCogs.length) {
        paidMonthlyCogs[targetMonth] += cogsAmount * term.percentage;
      }
    });
  });

  // Boucle sur chaque mois
  for (let yearOffset = 0; yearOffset < durationYears; yearOffset++) {
    const year = startYear + yearOffset;
    
    // Données annuelles
    const yearRevenue = inputData.annualRevenue[year] || 0;
    const yearPayroll = inputData.annualPayroll[year] || 0;
    const yearOpex = inputData.annualOpex[year] || 0;
    
    // Moyennes mensuelles
    const avgMonthlyRevenue = yearRevenue / 12;
    const monthlyPayroll = yearPayroll / 12;
    const monthlyOpex = yearOpex / 12;

    for (let month = 0; month < 12; month++) {
      const monthIndex = month as MonthIndex;
      const treasuryStart = currentTreasury;

      // === ENTRÉES ===
      
      // CA avec saisonnalité
      const revenue = avgMonthlyRevenue * revenueCoefs[month];
      
      // Levée de fonds
      let fundingInjection = 0;
      if (!excludeFunding) {
        const monthQuarter = getQuarterFromMonth(monthIndex);
        // Injection au premier mois du trimestre
        const isFirstMonthOfQuarter = month % 3 === 0;
        if (isFirstMonthOfQuarter) {
          fundingRounds.forEach(round => {
            if (round.year === year && round.quarter === monthQuarter) {
              fundingInjection += round.amount;
              totalFundingRaised += round.amount;
            }
          });
        }
      }
      
      // Autres entrées
      const monthKey = `${year}-${monthIndex.toString().padStart(2, '0')}`;
      const otherInflow = config.otherInflows[monthKey]?.amount || 0;
      
      const totalInflows = revenue + fundingInjection + otherInflow;

      // === SORTIES ===
      
      // COGS avec saisonnalité ET conditions de paiement
      const absMonthIdx = yearOffset * 12 + month;
      const cogs = paidMonthlyCogs[absMonthIdx] || 0;
      
      // Charges variables
      let variableChargesAmount = 0;
      const variableChargeDetails: { name: string; amount: number }[] = [];
      config.variableCharges.forEach(vc => {
        const amount = revenue * vc.rateOfRevenue;
        variableChargesAmount += amount;
        variableChargeDetails.push({ name: vc.name, amount });
      });
      totalVariableCharges += variableChargesAmount;
      
      // Échéances de prêts
      const monthLoanPayments = allLoanPayments.filter(
        p => p.year === year && p.month === monthIndex
      );
      const loanPaymentsAmount = monthLoanPayments.reduce((sum, p) => sum + p.total, 0);
      totalLoanPayments += loanPaymentsAmount;
      
      // Paiements CAPEX
      const monthCapexPayments = allCapexPayments.filter(
        p => p.year === year && p.month === monthIndex
      );
      const capexPaymentsAmount = monthCapexPayments.reduce((sum, p) => sum + p.amount, 0);
      totalCapexPayments += capexPaymentsAmount;
      
      // Autres sorties
      const otherOutflow = config.otherOutflows[monthKey]?.amount || 0;
      
      const totalOutflows = cogs + monthlyPayroll + monthlyOpex + variableChargesAmount + loanPaymentsAmount + capexPaymentsAmount + otherOutflow;

      // === TRÉSORERIE ===
      const netCashFlow = totalInflows - totalOutflows;
      const treasuryEnd = treasuryStart + netCashFlow;
      
      // Tracking minimum
      if (treasuryEnd < minTreasury) {
        minTreasury = treasuryEnd;
        minTreasuryMonth = { year, month: monthIndex };
      }
      
      // Tracking break-even (premier mois avec cash flow positif après période négative)
      if (breakEvenMonth === null && netCashFlow > 0 && months.length > 0) {
        const prevMonthsNegative = months.slice(-3).some(m => m.netCashFlow < 0);
        if (prevMonthsNegative) {
          breakEvenMonth = { year, month: monthIndex };
        }
      }

      months.push({
        year,
        month: monthIndex,
        monthName: MONTHS[month],
        revenue,
        fundingInjection,
        otherInflows: otherInflow,
        totalInflows,
        cogs,
        payroll: monthlyPayroll,
        opex: monthlyOpex,
        variableCharges: variableChargesAmount,
        loanPayments: loanPaymentsAmount,
        capexPayments: capexPaymentsAmount,
        otherOutflows: otherOutflow,
        totalOutflows,
        treasuryStart,
        netCashFlow,
        treasuryEnd,
        loanPaymentDetails: monthLoanPayments,
        variableChargeDetails,
        capexPaymentDetails: monthCapexPayments,
      });

      currentTreasury = treasuryEnd;
    }
  }

  return {
    months,
    initialCash,
    totalFundingRaised,
    minTreasury,
    minTreasuryMonth,
    breakEvenMonth,
    totalVariableCharges,
    totalLoanPayments,
    totalCapexPayments,
  };
}

// ==================
// HELPERS
// ==================

export function formatMonthYear(year: number, month: MonthIndex): string {
  return `${MONTHS[month]} ${year}`;
}

export function getMonthKey(year: number, month: MonthIndex): string {
  return `${year}-${month.toString().padStart(2, '0')}`;
}

export function parseMonthKey(key: string): { year: number; month: MonthIndex } | null {
  const match = key.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  return {
    year: parseInt(match[1], 10),
    month: parseInt(match[2], 10) as MonthIndex,
  };
}

/**
 * Agrège les données mensuelles par année
 */
export interface YearlyAggregatedData {
  year: number;
  revenue: number;
  cogs: number;
  grossMargin: number;
  payroll: number;
  opex: number;
  variableCharges: number;
  loanPayments: number;
  fundingInjection: number;
  netCashFlow: number;
  treasuryStart: number;
  treasuryEnd: number;
  ebitda: number;
}

export function aggregateByYear(months: MonthlyData[]): Map<number, YearlyAggregatedData> {
  const byYear = new Map<number, YearlyAggregatedData>();

  months.forEach((m, idx) => {
    let existing = byYear.get(m.year);
    
    if (!existing) {
      existing = {
        year: m.year,
        revenue: 0,
        cogs: 0,
        grossMargin: 0,
        payroll: 0,
        opex: 0,
        variableCharges: 0,
        loanPayments: 0,
        fundingInjection: 0,
        netCashFlow: 0,
        treasuryStart: m.treasuryStart, // Premier mois de l'année
        treasuryEnd: 0,
        ebitda: 0,
      };
    }
    
    existing.revenue += m.revenue;
    existing.cogs += m.cogs;
    existing.payroll += m.payroll;
    existing.opex += m.opex;
    existing.variableCharges += m.variableCharges;
    existing.loanPayments += m.loanPayments;
    existing.fundingInjection += m.fundingInjection;
    existing.netCashFlow += m.netCashFlow;
    existing.treasuryEnd = m.treasuryEnd; // Prendre la dernière valeur
    
    byYear.set(m.year, existing);
  });

  // Calculer les marges après agrégation
  byYear.forEach((data, year) => {
    data.grossMargin = data.revenue - data.cogs;
    data.ebitda = data.grossMargin - data.payroll - data.opex - data.variableCharges;
  });

  return byYear;
}
