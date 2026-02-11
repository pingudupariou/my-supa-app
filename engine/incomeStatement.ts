// Re-export from src/engine for backwards compatibility
export { 
  type ManualAdjustments,
  type IncomeStatementYear,
  type ProductDevAmortization,
  type UnifiedFinancialData,
  defaultManualAdjustments,
  calculateProductAmortizations,
  getProductAmortizationForYear,
  generateIncomeStatement
} from '../src/engine/incomeStatement';
