import { supabase } from '@/integrations/supabase/client';

// === TABLES PAR CATÉGORIE ===

// Tables financières (scénarios de travail)
const SCENARIO_TABLES = [
  'financial_scenarios',
  'pricing_config',
] as const;

// Tables système complètes (toute la base)
const SYSTEM_INDEPENDENT_TABLES = [
  'b2b_client_categories',
  'b2b_delivery_fee_tiers',
  'b2b_delivery_methods',
  'b2b_payment_terms_options',
  'costflow_product_categories',
  'costflow_planning_colors',
  'costflow_suppliers',
  'timetracking_categories',
  'pricing_config',
  'financial_scenarios',
] as const;

const SYSTEM_MID_TABLES = [
  'b2b_clients',
  'costflow_products',
  'costflow_references',
  'customers',
  'costflow_planning_rows',
  'costflow_meetings',
] as const;

const SYSTEM_DEPENDENT_TABLES = [
  'b2b_client_projections',
  'costflow_bom',
  'costflow_product_channels',
  'costflow_reference_files',
  'costflow_meeting_tasks',
  'costflow_planning_blocks',
  'customer_interactions',
  'customer_opportunities',
  'customer_orders',
  'crm_meetings',
  'crm_reminders',
  'timetracking_entries',
] as const;

const SYSTEM_LEAF_TABLES = [
  'costflow_planning_notes',
] as const;

const ALL_SYSTEM_TABLES = [...SYSTEM_INDEPENDENT_TABLES, ...SYSTEM_MID_TABLES, ...SYSTEM_DEPENDENT_TABLES, ...SYSTEM_LEAF_TABLES];

export type SupabaseSnapshotData = Record<string, any[]>;
export type SnapshotType = 'system' | 'scenario';

/**
 * Collecte les données selon le type de snapshot
 */
export async function collectSnapshotData(userId: string, type: SnapshotType): Promise<SupabaseSnapshotData> {
  const tables = type === 'system' ? ALL_SYSTEM_TABLES : [...SCENARIO_TABLES];
  const result: SupabaseSnapshotData = {};

  const promises = tables.map(async (table) => {
    try {
      const { data, error } = await supabase.from(table as any).select('*');
      if (error) {
        console.warn(`Snapshot: failed to read ${table}:`, error.message);
        return { table, data: [] };
      }
      return { table, data: data || [] };
    } catch (e) {
      console.warn(`Snapshot: exception reading ${table}:`, e);
      return { table, data: [] };
    }
  });

  const results = await Promise.all(promises);
  for (const { table, data } of results) {
    result[table] = data;
  }
  return result;
}

/**
 * Restaure les données Supabase depuis un snapshot
 */
export async function restoreSnapshotData(
  userId: string,
  snapshotData: SupabaseSnapshotData,
  type: SnapshotType
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];

  // Déterminer l'ordre de suppression et insertion selon le type
  let deletionOrder: readonly string[];
  let insertionOrder: readonly string[];

  if (type === 'system') {
    deletionOrder = [...SYSTEM_LEAF_TABLES, ...SYSTEM_DEPENDENT_TABLES, ...SYSTEM_MID_TABLES, ...SYSTEM_INDEPENDENT_TABLES];
    insertionOrder = [...SYSTEM_INDEPENDENT_TABLES, ...SYSTEM_MID_TABLES, ...SYSTEM_DEPENDENT_TABLES, ...SYSTEM_LEAF_TABLES];
  } else {
    deletionOrder = [...SCENARIO_TABLES];
    insertionOrder = [...SCENARIO_TABLES];
  }

  // 1. Supprimer
  for (const table of deletionOrder) {
    try {
      const { error } = await supabase.from(table as any).delete().eq('user_id', userId);
      if (error) {
        console.warn(`Snapshot restore: failed to delete ${table}:`, error.message);
        errors.push(`Suppression ${table}: ${error.message}`);
      }
    } catch (e: any) {
      errors.push(`Suppression ${table}: ${e.message}`);
    }
  }

  // 2. Insérer
  for (const table of insertionOrder) {
    const rows = snapshotData[table];
    if (!rows || rows.length === 0) continue;

    const userRows = rows.filter((row: any) => row.user_id === userId);
    if (userRows.length === 0) continue;

    try {
      for (let i = 0; i < userRows.length; i += 100) {
        const batch = userRows.slice(i, i + 100);
        const { error } = await supabase.from(table as any).insert(batch as any);
        if (error) {
          console.warn(`Snapshot restore: failed to insert ${table}:`, error.message);
          errors.push(`Insertion ${table}: ${error.message}`);
        }
      }
    } catch (e: any) {
      errors.push(`Insertion ${table}: ${e.message}`);
    }
  }

  return { success: errors.length === 0, errors };
}

// Backward compat
export const collectAllSupabaseData = (userId: string) => collectSnapshotData(userId, 'system');
export const restoreAllSupabaseData = (userId: string, data: SupabaseSnapshotData) => restoreSnapshotData(userId, data, 'system');
