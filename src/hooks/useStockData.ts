import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

export interface StockEntry {
  id: string;
  item_type: 'reference' | 'product';
  item_id: string;
  quantity: number;
  location: string;
  notes: string;
  last_updated_at: string;
}

export interface StockImportRecord {
  id: string;
  file_name: string;
  matched_count: number;
  partial_count: number;
  unmatched_count: number;
  imported_at: string;
}

export function useStockData() {
  const { user } = useAuth();
  const [stock, setStock] = useState<StockEntry[]>([]);
  const [imports, setImports] = useState<StockImportRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadStock = useCallback(async () => {
    const { data } = await supabase
      .from('costflow_stock')
      .select('*')
      .order('last_updated_at', { ascending: false });
    if (data) setStock(data as any);
  }, []);

  const loadImports = useCallback(async () => {
    const { data } = await supabase
      .from('costflow_stock_imports')
      .select('*')
      .order('imported_at', { ascending: false })
      .limit(20);
    if (data) setImports(data as any);
  }, []);

  useEffect(() => {
    Promise.all([loadStock(), loadImports()]).then(() => setLoading(false));
  }, [loadStock, loadImports]);

  const upsertStock = useCallback(async (
    itemType: 'reference' | 'product',
    itemId: string,
    quantity: number,
    location?: string,
    notes?: string,
  ) => {
    if (!user) return;
    
    const existing = stock.find(s => s.item_type === itemType && s.item_id === itemId);
    
    if (existing) {
      const { error } = await supabase
        .from('costflow_stock')
        .update({
          quantity,
          location: location ?? existing.location,
          notes: notes ?? existing.notes,
          last_updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
      if (error) { toast.error('Erreur mise à jour stock'); return; }
    } else {
      const { error } = await supabase
        .from('costflow_stock')
        .insert({
          user_id: user.id,
          item_type: itemType,
          item_id: itemId,
          quantity,
          location: location || '',
          notes: notes || '',
        });
      if (error) { toast.error('Erreur création stock'); return; }
    }
    await loadStock();
  }, [user, stock, loadStock]);

  const bulkUpsertStock = useCallback(async (
    entries: { itemType: 'reference' | 'product'; itemId: string; quantity: number }[],
    fileName: string,
    matchedCount: number,
    partialCount: number,
    unmatchedCount: number,
  ) => {
    if (!user) return;

    for (const entry of entries) {
      const existing = stock.find(s => s.item_type === entry.itemType && s.item_id === entry.itemId);
      if (existing) {
        await supabase.from('costflow_stock').update({
          quantity: entry.quantity,
          last_updated_at: new Date().toISOString(),
        }).eq('id', existing.id);
      } else {
        await supabase.from('costflow_stock').insert({
          user_id: user.id,
          item_type: entry.itemType,
          item_id: entry.itemId,
          quantity: entry.quantity,
        });
      }
    }

    // Log import
    await supabase.from('costflow_stock_imports').insert({
      user_id: user.id,
      file_name: fileName,
      matched_count: matchedCount,
      partial_count: partialCount,
      unmatched_count: unmatchedCount,
    });

    await Promise.all([loadStock(), loadImports()]);
    toast.success(`Stock importé : ${entries.length} entrées mises à jour`);
  }, [user, stock, loadStock, loadImports]);

  const getStockForItem = useCallback((itemType: 'reference' | 'product', itemId: string) => {
    return stock.find(s => s.item_type === itemType && s.item_id === itemId);
  }, [stock]);

  return {
    stock,
    imports,
    loading,
    upsertStock,
    bulkUpsertStock,
    getStockForItem,
    reload: loadStock,
  };
}
