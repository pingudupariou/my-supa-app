import { describe, expect, it } from 'vitest';
import { defaultExportOptions, selectedBankPages, STANDARD_SECTIONS } from './summaryExportSettings';

describe('export selections', () => {
  it('keeps formats independent', () => {
    const standard = defaultExportOptions('standard');
    const bank = defaultExportOptions('bank');
    standard.metrics.revenue = false;
    expect(bank.metrics.revenue).toBe(true);
    expect(bank.sections.executive).toBe(true);
  });
  it('numbers only selected pages', () => {
    const options = defaultExportOptions('bank');
    options.sections.cover = false;
    options.sections.cash = false;
    expect(selectedBankPages(options).map(([key]) => key)).toEqual([
      'toc', 'executive', 'evolution', 'clientDeck', 'loans', 'fundingPlan', 'needs',
      'orgChart', 'payroll', 'projection', 'incomeStatement', 'roadmap', 'valuation', 'variations',
    ]);
  });
  it('omits pages without selected content', () => {
    const options = defaultExportOptions('bank');
    options.graphs = false;
    options.comments = false;
    options.tables = false;
    options.kpis = false;
    // General section explanations remain available even without graphs/tables/comments.
    expect(selectedBankPages(options).map(([key]) => key)).toEqual(['cover', 'toc', ...Object.keys(STANDARD_SECTIONS)]);
  });
});