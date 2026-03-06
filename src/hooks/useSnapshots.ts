import { useState, useCallback, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { collectAllSupabaseData, restoreAllSupabaseData } from './useSnapshotData';

const STATE_KEY = 'novaride_financial_state_v5';
const ACTIVE_SNAPSHOT_KEY = 'novaride_active_snapshot';

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
  const [isSaving, setIsSaving] = useState(false);
  const [activeSnapshotName, setActiveSnapshotName] = useState<string | null>(() => localStorage.getItem(ACTIVE_SNAPSHOT_KEY));

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
    setIsSaving(true);
    try {
      // 1. Collecter l'état financier (localStorage)
      const currentState = localStorage.getItem(STATE_KEY);
      const financialState = currentState ? JSON.parse(currentState) : {};

      // 2. Collecter TOUTES les données Supabase
      const supabaseData = await collectAllSupabaseData(user.id);

      // 3. Combiner dans le snapshot
      const fullStateData = {
        financialState,
        supabaseData,
        snapshotVersion: 2, // v2 = inclut données Supabase
      };

      const { data, error } = await supabase
        .from('snapshots' as any)
        .insert({ user_id: user.id, name, comment, state_data: fullStateData } as any)
        .select()
        .single();

      if (error || !data) {
        toast({ title: 'Erreur', description: 'Impossible de créer la sauvegarde.', variant: 'destructive' });
        return false;
      }
      const d = data as any;
      setSnapshots(prev => [{ id: d.id, name: d.name, comment: d.comment, createdAt: d.created_at, stateData: JSON.stringify(d.state_data) }, ...prev]);
      setActiveSnapshotName(d.name);
      localStorage.setItem(ACTIVE_SNAPSHOT_KEY, d.name);
      toast({ title: 'Sauvegarde créée', description: `"${name}" — toutes les données ont été capturées.` });
      return true;
    } catch (e) {
      console.error('Failed to create snapshot:', e);
      toast({ title: 'Erreur', description: 'Impossible de créer la sauvegarde.', variant: 'destructive' });
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [user]);

  const restoreSnapshot = useCallback(async (id: string) => {
    if (!user) return false;
    const snapshot = snapshots.find(s => s.id === id);
    if (!snapshot) return false;

    setIsSaving(true);
    try {
      const stateData = JSON.parse(snapshot.stateData);

      // Vérifier si c'est un snapshot v2 (avec données Supabase)
      if (stateData.snapshotVersion === 2) {
        // Restaurer l'état financier dans localStorage
        if (stateData.financialState) {
          localStorage.setItem(STATE_KEY, JSON.stringify(stateData.financialState));
        }

        // Restaurer les données Supabase
        if (stateData.supabaseData) {
          const { success, errors } = await restoreAllSupabaseData(user.id, stateData.supabaseData);
          if (!success) {
            console.warn('Snapshot restore had errors:', errors);
            toast({
              title: 'Restauration partielle',
              description: `Certaines données n'ont pas pu être restaurées. ${errors.length} erreur(s).`,
              variant: 'destructive',
            });
          }
        }
      } else {
        // Ancien format v1 : seulement localStorage
        localStorage.setItem(STATE_KEY, snapshot.stateData);
      }

      localStorage.setItem(ACTIVE_SNAPSHOT_KEY, snapshot.name);
      setActiveSnapshotName(snapshot.name);
      toast({ title: 'Restauration effectuée', description: `"${snapshot.name}" — rechargement...` });
      setTimeout(() => window.location.reload(), 800);
      return true;
    } catch (e) {
      console.error('Failed to restore snapshot:', e);
      toast({ title: 'Erreur', description: 'Impossible de restaurer la sauvegarde.', variant: 'destructive' });
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [user, snapshots]);

  const duplicateSnapshot = useCallback(async (id: string) => { return false; }, []);
  const deleteSnapshot = useCallback(async (id: string) => {
    if (!user) return false;
    await supabase.from('snapshots' as any).delete().eq('id', id);
    setSnapshots(prev => prev.filter(s => s.id !== id));
    return true;
  }, [user]);
  const renameSnapshot = useCallback(async (id: string, newName: string) => { return false; }, []);

  const formatDate = (isoString: string) => new Date(isoString).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return { snapshots, isLoading, isSaving, activeSnapshotName, canManageSnapshots: canManageSnapshots(), createSnapshot, restoreSnapshot, duplicateSnapshot, deleteSnapshot, renameSnapshot, formatDate };
}
