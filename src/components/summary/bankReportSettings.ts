import { useSyncExternalStore } from 'react';

export type BankCommentKey = 'revenue' | 'treasury' | 'netResult';
export interface BankReportSettings {
  logoDataUrl?: string;
  projectName?: string;
  comments: Partial<Record<BankCommentKey, string>>;
}

const KEY = 'bank-report-settings:v1';
const listeners = new Set<() => void>();
let cache: BankReportSettings | null = null;

function read(): BankReportSettings {
  if (cache) return cache;
  try { cache = { comments: {}, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { cache = { comments: {} }; }
  return cache!;
}

export function saveBankReportSettings(next: BankReportSettings) {
  cache = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* quota: kept in memory */ }
  listeners.forEach(l => l());
}

export function useBankReportSettings(): BankReportSettings {
  return useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb); }, read, read);
}

/** Texte personnalisé non vide, sinon commentaire calculé. */
export function pickComment(custom: string | undefined, auto: string) {
  return custom && custom.trim() ? custom.trim() : auto;
}
