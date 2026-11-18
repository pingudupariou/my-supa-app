import type { ClassifiedCustomer } from './classificationModel';

export type CrmRecord = { id: string; company_name: string; erplain_customer_id: string | null; sales_channel: string };
export type LinkStatus = 'linked' | 'suggested' | 'new';
export type CrmLinkRow = CrmRecord & { status: LinkStatus; suggestion?: ClassifiedCustomer; duplicateOf: string[] };

const LEGAL = /\b(sas|sasu|sarl|sa|eurl|sci|gmbh|ltd|llc|inc|srl|bv|ag|co|company|societe|ste)\b/g;
/** Nom comparable : minuscules, sans accents, ponctuation ni forme juridique. */
export function normalizeName(name: string | null | undefined): string {
  return (name ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').replace(LEGAL, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Statut de chaque fiche CRM. Une suggestion = nom normalisé identique à UN seul client
 * Erplain non encore rattaché. Jamais appliquée sans confirmation.
 */
export function buildCrmLinkRows(crm: CrmRecord[], customers: ClassifiedCustomer[]): CrmLinkRow[] {
  const linked = new Set(crm.map(c => c.erplain_customer_id).filter(Boolean) as string[]);
  const byName = new Map<string, ClassifiedCustomer[]>();
  for (const c of customers) {
    if (linked.has(c.customer_id)) continue;
    const k = normalizeName(c.customer_name); if (!k) continue;
    byName.set(k, [...(byName.get(k) ?? []), c]);
  }
  const crmByName = new Map<string, string[]>();
  for (const c of crm) { const k = normalizeName(c.company_name); if (k) crmByName.set(k, [...(crmByName.get(k) ?? []), c.id]); }
  const claimed = new Map<string, number>();
  const rows: CrmLinkRow[] = crm.map(c => {
    const k = normalizeName(c.company_name);
    const duplicateOf = (crmByName.get(k) ?? []).filter(id => id !== c.id);
    if (c.erplain_customer_id) return { ...c, status: 'linked' as const, duplicateOf };
    const matches = byName.get(k) ?? [];
    if (matches.length === 1) { claimed.set(matches[0].customer_id, (claimed.get(matches[0].customer_id) ?? 0) + 1); return { ...c, status: 'suggested' as const, suggestion: matches[0], duplicateOf }; }
    return { ...c, status: 'new' as const, duplicateOf };
  });
  // Un client Erplain proposé à plusieurs fiches : pas de suggestion automatique (choix manuel).
  return rows.map((r): CrmLinkRow => r.suggestion && (claimed.get(r.suggestion.customer_id) ?? 0) > 1 ? { ...r, status: 'new', suggestion: undefined } : r);
}

/** Vérifie qu'un client Erplain n'est pas déjà rattaché à une autre fiche. */
export function linkConflict(crm: CrmRecord[], crmId: string, erplainId: string | null): CrmRecord | undefined {
  if (!erplainId) return undefined;
  return crm.find(c => c.id !== crmId && c.erplain_customer_id === erplainId);
}
