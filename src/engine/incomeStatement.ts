// ============================================
// COMPTE DE RÉSULTAT COMPLET
// Inclut les éléments ajustables manuellement
// ============================================

import { Product, Role, Expense } from './types';
import { calculateTotalRevenue, calculateCOGS, calculatePayroll, calculateTotalOpex, calculateTotalVolumes, calculateDepreciation } from './calculations';

// ==================
// TYPES POUR LE COMPTE DE RÉSULTAT
// ==================

export interface ManualAdjustments {
  cir: Record<number, number>; // Crédit Impôt Recherche par année
  financialIncome: Record<number, number>; // Produits financiers
  financialExpense: Record<number, number>; // Charges financières
  exceptionalIncome: Record<number, number>; // Produits exceptionnels
  exceptionalExpense: Record<number, number>; // Charges exceptionnelles
  incomeTaxRate: number; // Taux d'IS (0.25 par défaut)
  parentCompanyTaxIntegration: boolean; // Intégration fiscale
}

export interface IncomeStatementYear {
  year: number;
  
  // Chiffre d'affaires
  revenue: number;
  otherOperatingIncome: number;
  totalOperatingIncome: number;
  
  // Charges d'exploitation
  purchasesAndVariation: number; // COGS
  externalServices: number; // OPEX hors masse salariale
  personnelExpenses: number; // Masse salariale
  otherOperatingExpenses: number;
  totalOperatingExpenses: number;
  
  // EBITDA
  ebitda: number;
  ebitdaMargin: number;
  
  // Amortissements & Provisions
  depreciationProductDev: number; // Amortissement dev produits
  depreciationOther: number;
  provisions: number;
  totalDepreciationProvisions: number;
  
  // Résultat d'exploitation
  operatingResult: number;
  operatingMargin: number;
  
  // Résultat financier
  financialIncome: number;
  financialExpense: number;
  financialResult: number;
  
  // Résultat courant avant impôts
  currentResultBeforeTax: number;
  
  // Résultat exceptionnel
  exceptionalIncome: number;
  exceptionalExpense: number;
  exceptionalResult: number;
  
  // Participation et Intéressement
  participation: number;
  
  // Impôts
  cir: number; // Crédit Impôt Recherche
  incomeTax: number;
  
  // Résultat net
  netResult: number;
  netMargin: number;
}

export interface ProductDevAmortization {
  productId: string;
  productName: string;
  devCost: number;
  startYear: number;
  amortizationYears: number;
  yearlyAmortization: number;
  remainingValue: Record<number, number>;
}

// ==================
// VALEURS PAR DÉFAUT
// ==================

export const defaultManualAdjustments: ManualAdjustments = {
  cir: { 2025: 30000, 2026: 45000, 2027: 55000, 2028: 60000, 2029: 65000, 2030: 70000 },
  financialIncome: { 2025: 2000, 2026: 5000, 2027: 8000, 2028: 12000, 2029: 15000, 2030: 20000 },
  financialExpense: { 2025: 5000, 2026: 8000, 2027: 10000, 2028: 10000, 2029: 10000, 2030: 8000 },
  exceptionalIncome: {},
  exceptionalExpense: {},
  incomeTaxRate: 0.25,
  parentCompanyTaxIntegration: false,
};

// ==================
// CALCUL DES AMORTISSEMENTS DÉTAILLÉS
// ==================

export function calculateProductAmortizations(
  products: Product[],
  startYear: number,
  endYear: number
): ProductDevAmortization[] {
  return products.map(product => {
    const amortYears = product.devAmortizationYears || 5;
    const yearlyAmort = product.devCost / amortYears;
    
    const remainingValue: Record<number, number> = {};
    for (let year = startYear; year <= endYear; year++) {
      const yearsElapsed = year - product.launchYear;
      if (yearsElapsed < 0) {
        remainingValue[year] = product.devCost;
      } else if (yearsElapsed >= amortYears) {
        remainingValue[year] = 0;
      } else {
        remainingValue[year] = product.devCost - (yearlyAmort * (yearsElapsed + 1));
      }
    }
    
    return {
      productId: product.id,
      productName: product.name,
      devCost: product.devCost,
      startYear: product.launchYear,
      amortizationYears: amortYears,
      yearlyAmortization: yearlyAmort,
      remainingValue,
    };
  });
}

export function getProductAmortizationForYear(
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
// GÉNÉRATION DU COMPTE DE RÉSULTAT
// ==================

export function generateIncomeStatement(
  products: Product[],
  roles: Role[],
  expenses: Expense[],
  adjustments: ManualAdjustments,
  startYear: number = 2025,
  numberOfYears: number = 5
): IncomeStatementYear[] {
  const statements: IncomeStatementYear[] = [];
  
  for (let i = 0; i <= numberOfYears; i++) {
    const year = startYear + i;
    
    // Revenus
    const revenue = calculateTotalRevenue(products, year);
    const otherOperatingIncome = 0;
    const totalOperatingIncome = revenue + otherOperatingIncome;
    
    // COGS
    const purchasesAndVariation = calculateCOGS(products, year);
    
    // Masse salariale
    const personnelExpenses = calculatePayroll(roles, year);
    
    // OPEX
    const volumes = calculateTotalVolumes(products, year);
    const externalServices = calculateTotalOpex(expenses, year, revenue, volumes);
    
    const otherOperatingExpenses = 0;
    const totalOperatingExpenses = purchasesAndVariation + externalServices + personnelExpenses + otherOperatingExpenses;
    
    // EBITDA
    const ebitda = totalOperatingIncome - totalOperatingExpenses;
    const ebitdaMargin = revenue > 0 ? ebitda / revenue : 0;
    
    // Amortissements
    const depreciationProductDev = getProductAmortizationForYear(products, year);
    const depreciationOther = revenue * 0.02; // 2% du CA pour autres immobilisations
    const provisions = 0;
    const totalDepreciationProvisions = depreciationProductDev + depreciationOther + provisions;
    
    // Résultat d'exploitation
    const operatingResult = ebitda - totalDepreciationProvisions;
    const operatingMargin = revenue > 0 ? operatingResult / revenue : 0;
    
    // Résultat financier
    const financialIncome = adjustments.financialIncome[year] || 0;
    const financialExpense = adjustments.financialExpense[year] || 0;
    const financialResult = financialIncome - financialExpense;
    
    // Résultat courant avant impôts
    const currentResultBeforeTax = operatingResult + financialResult;
    
    // Résultat exceptionnel
    const exceptionalIncome = adjustments.exceptionalIncome[year] || 0;
    const exceptionalExpense = adjustments.exceptionalExpense[year] || 0;
    const exceptionalResult = exceptionalIncome - exceptionalExpense;
    
    // Participation (si bénéfice > seuil)
    const participation = currentResultBeforeTax > 100000 ? currentResultBeforeTax * 0.05 : 0;
    
    // Impôts
    const cir = adjustments.cir[year] || 0;
    const taxableResult = currentResultBeforeTax + exceptionalResult - participation;
    const incomeTax = taxableResult > 0 ? Math.max(0, taxableResult * adjustments.incomeTaxRate - cir) : 0;
    
    // Résultat net
    const netResult = currentResultBeforeTax + exceptionalResult - participation - incomeTax;
    const netMargin = revenue > 0 ? netResult / revenue : 0;
    
    statements.push({
      year,
      revenue,
      otherOperatingIncome,
      totalOperatingIncome,
      purchasesAndVariation,
      externalServices,
      personnelExpenses,
      otherOperatingExpenses,
      totalOperatingExpenses,
      ebitda,
      ebitdaMargin,
      depreciationProductDev,
      depreciationOther,
      provisions,
      totalDepreciationProvisions,
      operatingResult,
      operatingMargin,
      financialIncome,
      financialExpense,
      financialResult,
      currentResultBeforeTax,
      exceptionalIncome,
      exceptionalExpense,
      exceptionalResult,
      participation,
      cir,
      incomeTax,
      netResult,
      netMargin,
    });
  }
  
  return statements;
}
