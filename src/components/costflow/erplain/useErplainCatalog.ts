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

  useEffect(() => { load(); }, [load]);
  return { variants, synced, edges, bomStatus, readAt, loading, error, reload: load };
}
