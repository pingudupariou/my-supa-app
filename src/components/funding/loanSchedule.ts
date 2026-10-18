import type { MonthlyData } from '@/engine/monthlyTreasuryEngine';

export interface LoanScheduleYear { year: number; disbursed: number; principal: number; interest: number; outstanding: number }

/** Yearly schedule for a subset of loans, read from the monthly projection (single source). */
export function buildLoanSchedule(months: Pick<MonthlyData, 'year' | 'loanDisbursement' | 'loanPaymentDetails'>[], loanIds: string[], years: number[], disbursementsByMonthIsOnlyThese = true): LoanScheduleYear[] {
  const ids = new Set(loanIds);
  let outstanding = 0;
  return years.map(year => {
    const ms = months.filter(m => m.year === year);
    const disbursed = disbursementsByMonthIsOnlyThese ? ms.reduce((s, m) => s + (m.loanDisbursement || 0), 0) : 0;
    let principal = 0, interest = 0;
    ms.forEach(m => m.loanPaymentDetails.forEach(p => {
      if (ids.has(p.loanId)) { principal += p.principal; interest += p.interest; }
    }));
    outstanding = Math.max(0, outstanding + disbursed - principal);
    return { year, disbursed, principal, interest, outstanding };
  });
}
