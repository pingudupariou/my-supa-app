import { describe, expect, it } from 'vitest';
import { defaultExportOptions, selectedBankPages } from './summaryExportSettings';

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
    options.sections.treasury = false;
    expect(selectedBankPages(options).map(([key], index) => [key, index + 1])).toEqual([
      ['toc', 1], ['executive', 2], ['revenue', 3], ['income', 4], ['variations', 5],
    ]);
  });
  it('omits pages without selected content', () => {
    const options = defaultExportOptions('bank');
    options.graphs = false;
    options.comments = false;
    options.tables = false;
    options.kpis = false;
    expect(selectedBankPages(options).map(([key]) => key)).toEqual(['cover', 'toc']);
  });
});