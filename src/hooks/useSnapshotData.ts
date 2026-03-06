import { supabase } from '@/integrations/supabase/client';

// Tables dans l'ordre de dépendance (indépendantes → dépendantes)
const INDEPENDENT_TABLES = [
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

const MID_TABLES = [
  'b2b_clients',
  'costflow_products',
  'costflow_references',
  'customers',
  'costflow_planning_rows',
  'costflow_meetings',
] as const;

const DEPENDENT_TABLES = [
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

const LEAF_TABLES = [
  'costflow_planning_notes',
] as const;

const ALL_TABLES = [...INDEPENDENT_TABLES, ...MID_TABLES, ...DEPENDENT_TABLES, ...LEAF_TABLES];

export type SupabaseSnapshotData = Record<string, any[]>;

/**
 * Collecte toutes les données de l'utilisateur depuis Supabase
 */
export async function collectAllSupabaseData(userId: string): Promise<SupabaseSnapshotData> {
  const result: SupabaseSnapshotData = {};

  // Charger toutes les tables en parallèle
  const promises = ALL_TABLES.map(async (table) => {
    try {
      const { data, error } = await supabase
        .from(table as any)
        .select('*');

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
 * Restaure toutes les données Supabase depuis un snapshot.
 * Supprime les données existantes de l'utilisateur puis réinsère celles du snapshot.
 */
export async function restoreAllSupabaseData(
  userId: string,
  snapshotData: SupabaseSnapshotData
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];

  // 1. Supprimer dans l'ordre inverse de dépendance
  const deletionOrder = [...LEAF_TABLES, ...DEPENDENT_TABLES, ...MID_TABLES, ...INDEPENDENT_TABLES];

  for (const table of deletionOrder) {
    try {
      // Certaines tables n'ont pas de user_id (page_images, tab_permissions)
      // On ne supprime que les données de l'utilisateur courant
      const { error } = await supabase
        .from(table as any)
        .delete()
        .eq('user_id', userId);

      if (error) {
        console.warn(`Snapshot restore: failed to delete ${table}:`, error.message);
        errors.push(`Suppression ${table}: ${error.message}`);
      }
    } catch (e: any) {
      errors.push(`Suppression ${table}: ${e.message}`);
    }
  }

  // 2. Insérer dans l'ordre de dépendance
  const insertionOrder = [...INDEPENDENT_TABLES, ...MID_TABLES, ...DEPENDENT_TABLES, ...LEAF_TABLES];

  for (const table of insertionOrder) {
    const rows = snapshotData[table];
    if (!rows || rows.length === 0) continue;

    // Filtrer uniquement les lignes de l'utilisateur courant
    const userRows = rows.filter((row: any) => row.user_id === userId);
    if (userRows.length === 0) continue;

    try {
      // Insérer par lots de 100
      for (let i = 0; i < userRows.length; i += 100) {
        const batch = userRows.slice(i, i + 100);
        const { error } = await supabase
          .from(table as any)
          .insert(batch as any);

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
