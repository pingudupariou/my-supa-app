import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ErplainVariantRow {
  id: string; sku: string | null; label: string | null;
  on_hand: number; available: number; reserved: number; incoming: number;
  locations: { label: string | null; on_hand: number | null; available: number | null; reserved: number | null; incoming: number | null }[];
  bomCount: number; bom: { id: string; label: string | null; components: number } | null; usedIn: number;
}

export interface BomStatus { complete: boolean; runStatus: string | null; finishedAt: string | null; ambiguousParents: number }

/** Erplain-only catalog (last sync of stock + BOMs). No dependency on manual CostFlow tables. */
export function useErplainCatalog() {
  const [variants, setVariants] = useState<ErplainVariantRow[]>([]);
  const [synced, setSynced] = useState<{ stock: string | null; bom: string | null }>({ stock: null, bom: null });
  const [edges, setEdges] = useState<[string, string, number][]>([]);
  const [bomStatus, setBomStatus] = useState<BomStatus | null>(null);
  const [readAt, setReadAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const { data, error } = await supabase.functions.invoke('erplain-sync', { body: { action: 'costflow_catalog' } });
    setLoading(false);
    if (error || data?.status !== 'success') { setError(data?.message || data?.error || error?.message || 'Lecture Erplain impossible'); return; }
    setVariants(data.variants ?? []);
    setSynced({ stock: data.syncedStock, bom: data.syncedBom });
    setEdges(data.edges ?? []); setBomStatus(data.bomStatus ?? null); setReadAt(data.readAt ?? null);
  }, []);

  const [costReadAt, setCostReadAt] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<string | null>(null);

  /** Re-reads only BOMs + routings from Erplain (read-only for Erplain), resuming chunked runs, then reloads the catalog. */
  const refreshBom = useCallback(async () => {
    setError(null); setRefreshing('Lecture des nomenclatures Erplain…');
    try {
      for (let i = 0; i < 30; i++) {
        const { data, error } = await supabase.functions.invoke('erplain-sync', { body: { action: 'costflow_refresh_bom' } });
        if (error || data?.status !== 'success') throw new Error(data?.failure || data?.message || data?.error || error?.message || 'Actualisation impossible');
        if (data.done) { await load(); return; }
        setRefreshing(`Lecture des nomenclatures… (${data.current ?? ''} page ${data.page ?? ''})`);
      }
      throw new Error('Actualisation interrompue : relancez pour reprendre où elle s\'est arrêtée.');
    } catch (e) { setError((e as Error).message); }
    finally { setRefreshing(null); }
  }, [load]);

  useEffect(() => { load(); }, [load]);
  return { variants, synced, edges, bomStatus, readAt, loading, error, reload: load, refreshBom, refreshing, costReadAt, setCostReadAt };
}
