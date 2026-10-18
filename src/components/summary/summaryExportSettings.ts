import { useSyncExternalStore } from 'react';

export type ExportMode = 'standard' | 'bank';
export const STANDARD_SECTIONS = {
  cash: 'Approche Cash', evolution: 'Graphiques d’évolution', clientDeck: 'Chiffre d’affaires par produit / canal',
  loans: 'Financement bancaire', fundingPlan: 'Plan de financement', needs: 'Justification des besoins',
  payroll: 'Masse salariale', projection: 'Projection détaillée', incomeStatement: 'Compte de résultat',
  roadmap: 'Roadmap et investissements produits', valuation: 'Valorisation et tours',
};
export const BANK_SECTIONS = { cover: 'Couverture', toc: 'Sommaire', executive: 'Résumé exécutif', revenue: 'CA et rentabilité', treasury: 'Trésorerie et financement', income: 'Compte de résultat synthétique', variations: 'Variations annuelles' };
export const EXPORT_METRICS = {
  revenue: 'Chiffre d’affaires', grossMargin: 'Marge brute', ebitda: 'EBITDA', netResult: 'Résultat net',
  treasuryEnd: 'Trésorerie', netCashFlow: 'Flux de trésorerie', grossMarginRate: 'Taux de marge brute',
  cogs: 'Coûts produits', payroll: 'Masse salariale', opex: 'Charges d’exploitation', headcount: 'Effectif',
  loanDisbursement: 'Déblocage prêts', loanPayments: 'Échéances prêts', loanInterest: 'Intérêts prêts',
};
export interface ExportOptions {
  sections: Record<string, boolean>;
  metrics: Record<string, boolean>;
  graphs: boolean; tables: boolean; kpis: boolean; comments: boolean; legend: boolean; labels: boolean;
}
const all = (items: Record<string, string>) => Object.fromEntries(Object.keys(items).map(key => [key, true]));
export function defaultExportOptions(mode: ExportMode): ExportOptions {
  return { sections: all(mode === 'bank' ? BANK_SECTIONS : STANDARD_SECTIONS), metrics: all(EXPORT_METRICS), graphs: true, tables: true, kpis: true, comments: true, legend: true, labels: true };
}
const KEY = 'summary-export-options:v1';
const listeners = new Set<() => void>();
let activeMode: ExportMode | null = null;
let cache: Record<ExportMode, ExportOptions> | undefined;
function read() {
  if (cache) return cache;
  let saved: Partial<Record<ExportMode, ExportOptions>> = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { /* defaults */ }
  const merge = (mode: ExportMode) => {
    const defaults = defaultExportOptions(mode);
    return { ...defaults, ...saved[mode], sections: { ...defaults.sections, ...saved[mode]?.sections }, metrics: { ...defaults.metrics, ...saved[mode]?.metrics } };
  };
  cache = { standard: merge('standard'), bank: merge('bank') };
  return cache;
}
export function saveExportOptions(mode: ExportMode, options: ExportOptions) {
  cache = { ...read(), [mode]: options };
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* memory fallback */ }
  listeners.forEach(listener => listener());
}
export function setActiveExport(mode: ExportMode | null) {
  activeMode = mode;
  listeners.forEach(listener => listener());
}
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function useSummaryExport(mode: ExportMode) {
  const settings = useSyncExternalStore(subscribe, read, read);
  const active = useSyncExternalStore(subscribe, () => activeMode, () => null);
  return { options: settings[mode], exporting: active === mode };
}
export function selectedBankPages(options: ExportOptions) {
  return Object.entries(BANK_SECTIONS).filter(([key]) => options.sections[key] &&
    (key !== 'executive' || options.kpis || options.comments) &&
    (!['revenue', 'treasury'].includes(key) || options.graphs || options.comments) &&
    (!['income', 'variations'].includes(key) || options.tables));
}