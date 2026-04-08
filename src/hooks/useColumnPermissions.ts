import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ColumnPermission {
  column_key: string;
  is_editable_by_others: boolean;
}

export function useColumnPermissions() {
  const [permissions, setPermissions] = useState<ColumnPermission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetch = useCallback(async () => {
    const { data, error } = await supabase
      .from('b2b_column_permissions')
      .select('column_key, is_editable_by_others');
    if (!error && data) setPermissions(data as ColumnPermission[]);
    setIsLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const isEditableByOthers = useCallback((columnKey: string) => {
    const perm = permissions.find(p => p.column_key === columnKey);
    return perm?.is_editable_by_others ?? false;
  }, [permissions]);

  const togglePermission = useCallback(async (columnKey: string, value: boolean) => {
    const { error } = await supabase
      .from('b2b_column_permissions')
      .upsert(
        { column_key: columnKey, is_editable_by_others: value, updated_at: new Date().toISOString() } as any,
        { onConflict: 'column_key' }
      );
    if (!error) {
      setPermissions(prev => {
        const exists = prev.find(p => p.column_key === columnKey);
        if (exists) {
          return prev.map(p => p.column_key === columnKey ? { ...p, is_editable_by_others: value } : p);
        }
        return [...prev, { column_key: columnKey, is_editable_by_others: value }];
      });
    }
  }, []);

  return { permissions, isLoading, isEditableByOthers, togglePermission };
}
