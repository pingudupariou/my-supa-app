import { useState, useCallback, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

const STATE_KEY = 'novaride_financial_state_v5';

export interface Snapshot {
  id: string;
  name: string;
  comment?: string;
  createdAt: string;
  stateData: string;
}

export function useSnapshots() {
  const { user, isAdmin, getTabPermission } = useAuth();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const canManageSnapshots = useCallback(() => {
    if (!user) return false;
    if (isAdmin) return true;
    return true;
  }, [user, isAdmin]);

  const loadSnapshots = useCallback(async () => {
    if (!user) { setIsLoading(false); return; }
    try {
      const { data } = await supabase.from('snapshots' as any).select('*').order('created_at', { ascending: false });
      if (data) {
        setSnapshots((data as any[]).map(row => ({
          id: row.id, name: row.name, comment: row.comment, createdAt: row.created_at,
          stateData: JSON.stringify(row.state_data),
        })));
      }
    } catch {} finally { setIsLoading(false); }
  }, [user]);

  useEffect(() => { loadSnapshots(); }, [loadSnapshots]);

  const createSnapshot = useCallback(async (name: string, comment?: string) => {
    if (!user) return false;
    try {
      const currentState = localStorage.getItem(STATE_KEY);
      if (!currentState) return false;
      const { data, error } = await supabase.from('snapshots' as any).insert({ user_id: user.id, name, comment, state_data: JSON.parse(currentState) } as any).select().single();
      if (error || !data) return false;
      const d = data as any;
      setSnapshots(prev => [{ id: d.id, name: d.name, comment: d.comment, createdAt: d.created_at, stateData: JSON.stringify(d.state_data) }, ...prev]);
      toast({ title: 'Sauvegarde créée' });
      return true;
    } catch { return false; }
  }, [user]);

  const restoreSnapshot = useCallback((id: string) => {
    const snapshot = snapshots.find(s => s.id === id);
    if (!snapshot) return false;
    localStorage.setItem(STATE_KEY, snapshot.stateData);
    toast({ title: 'Restauration effectuée' });
    setTimeout(() => window.location.reload(), 500);
    return true;
  }, [snapshots]);

  const duplicateSnapshot = useCallback(async (id: string) => { return false; }, []);
  const deleteSnapshot = useCallback(async (id: string) => {
    if (!user) return false;
    await supabase.from('snapshots' as any).delete().eq('id', id);
    setSnapshots(prev => prev.filter(s => s.id !== id));
    return true;
  }, [user]);
  const renameSnapshot = useCallback(async (id: string, newName: string) => { return false; }, []);

  const formatDate = (isoString: string) => new Date(isoString).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return { snapshots, isLoading, canManageSnapshots: canManageSnapshots(), createSnapshot, restoreSnapshot, duplicateSnapshot, deleteSnapshot, renameSnapshot, formatDate };
}
