import { describe, expect, it } from 'vitest';
import { calculateMonthlyTreasuryProjection, getDefaultMonthlyTreasuryConfig } from '@/engine/monthlyTreasuryEngine';
import { buildLoanSchedule } from './loanSchedule';
import { computeIncomeStatement, getDefaultIncomeStatementConfig } from '@/engine/incomeStatementConfig';

const run = (loan: object) => calculateMonthlyTreasuryProjection(
  { ...getDefaultMonthlyTreasuryConfig(), loans: [loan as never] },
  { annualRevenue: {}, annualCogs: {}, annualPayroll: {}, annualOpex: {} }, [], 0, 2025, 3,
);
const loan = { id: 'b1', name: 'Prêt', inputMode: 'calculated', principalAmount: 120000, interestRate: 0.05,
  startDate: { year: 2025, month: 0 }, endDate: { year: 2027, month: 0 }, frequency: 'monthly', disbursedInPlan: true };

describe('bank loan', () => {
  it('disburses the principal into treasury in the start month', () => {
    expect(run(loan).months[0].loanDisbursement).toBe(120000);
  });
  it('repays the full principal over its duration and charges interest', () => {
    const s = buildLoanSchedule(run(loan).months, ['b1'], [2025, 2026, 2027]);
    expect(s.reduce((t, r) => t + r.principal, 0)).toBeCloseTo(120000, 0);
    expect(s[0].interest).toBeGreaterThan(0);
    expect(s[2].outstanding).toBeCloseTo(0, 0);
  });
  it('loans without disbursedInPlan do not add cash', () => {
    expect(run({ ...loan, disbursedInPlan: false }).months[0].loanDisbursement).toBe(0);
  });
  it('loan interest is added to financial expenses', () => {
    const [r] = computeIncomeStatement([{ year: 2025, revenue: 0, cogs: 0, grossMargin: 0, payroll: 0, opex: 0, ebitda: 0, loanInterest: 1000 }], getDefaultIncomeStatementConfig());
    expect(r.financialExpense).toBe(1000);
    expect(r.netResult).toBe(-1000);
  });
});
