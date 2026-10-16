// ============================================
// COMPTE DE RÉSULTAT — configuration manuelle
// Les dotations aux amortissements (et les lignes financières/
// exceptionnelles) sont saisies à la main par l'utilisateur.
// Un champ non rempli vaut 0 ici (saisie manuelle libre), pas une donnée Erplain.
// ============================================

export interface DepreciationLine {
  id: string;
  label: string;
  valuesByYear: Record<number, number>;
}

export interface IncomeStatementConfig {
  depreciationLines: DepreciationLine[];
  financialIncome: Record<number, number>;
  financialExpense: Record<number, number>;
  exceptionalIncome: Record<number, number>;
  exceptionalExpense: Record<number, number>;
  incomeTaxRate: number; // ex: 0.25 pour 25%
}

export function getDefaultIncomeStatementConfig(): IncomeStatementConfig {
  return {
    depreciationLines: [
      { id: 'dotation-1', label: 'Dotations aux amortissements', valuesByYear: {} },
    ],
    financialIncome: {},
    financialExpense: {},
    exceptionalIncome: {},
    exceptionalExpense: {},
    incomeTaxRate: 0.25,
  };
}

export interface IncomeStatementYearInput {
  year: number;
  revenue: number;
  cogs: number;
  grossMargin: number;
  payroll: number;
  opex: number;
  ebitda: number;
}

export interface IncomeStatementYearResult extends IncomeStatementYearInput {
  totalDepreciation: number;
  operatingResult: number;
  financialIncome: number;
  financialExpense: number;
  financialResult: number;
  currentResultBeforeTax: number;
  exceptionalIncome: number;
  exceptionalExpense: number;
  exceptionalResult: number;
  resultBeforeTax: number;
  incomeTax: number;
  netResult: number;
}

export function computeIncomeStatement(
  yearlyData: IncomeStatementYearInput[],
  config: IncomeStatementConfig
): IncomeStatementYearResult[] {
  return yearlyData.map(d => {
    const totalDepreciation = config.depreciationLines.reduce(
      (sum, line) => sum + (line.valuesByYear[d.year] || 0),
      0
    );
    const operatingResult = d.ebitda - totalDepreciation;

    const financialIncome = config.financialIncome[d.year] || 0;
    const financialExpense = config.financialExpense[d.year] || 0;
    const financialResult = financialIncome - financialExpense;

    const currentResultBeforeTax = operatingResult + financialResult;

    const exceptionalIncome = config.exceptionalIncome[d.year] || 0;
    const exceptionalExpense = config.exceptionalExpense[d.year] || 0;
    const exceptionalResult = exceptionalIncome - exceptionalExpense;

    const resultBeforeTax = currentResultBeforeTax + exceptionalResult;
    const incomeTax = resultBeforeTax > 0 ? resultBeforeTax * config.incomeTaxRate : 0;
    const netResult = resultBeforeTax - incomeTax;

    return {
      ...d,
      totalDepreciation,
      operatingResult,
      financialIncome,
      financialExpense,
      financialResult,
      currentResultBeforeTax,
      exceptionalIncome,
      exceptionalExpense,
      exceptionalResult,
      resultBeforeTax,
      incomeTax,
      netResult,
    };
  });
}
