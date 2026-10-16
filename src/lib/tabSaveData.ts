export const TAB_FIELDS = {
  'product-plan': ['products', 'productCategories', 'revenueMode', 'globalRevenueConfig', 'clientRevenueConfig', 'roadmapBlocks'],
  charges: ['expenses', 'opexMode', 'simpleOpexConfig'],
  organisation: ['roles', 'hiringSimulation'],
  previsionnel: ['monthlyTreasuryConfig', 'incomeStatementConfig'],
  funding: ['fundingRounds'],
  scenarios: ['scenarioSettings', 'scenarioConfigs', 'activeScenarioId', 'excludeFundingFromTreasury', 'fundingPlan'],
} as const;

export type SavedTabKey = keyof typeof TAB_FIELDS;
export interface ActiveTabSave { id: string; name: string }
export type ActiveTabSaves = Partial<Record<SavedTabKey, ActiveTabSave>>;

export function pickTabData(state: object, tabKey: SavedTabKey): Record<string, unknown> {
  const source = state as Record<string, unknown>;
  return Object.fromEntries(TAB_FIELDS[tabKey].map(field => [field, source[field]]));
}