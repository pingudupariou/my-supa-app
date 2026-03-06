import { useState, useCallback, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { collectSnapshotData, restoreSnapshotData, type SnapshotType } from './useSnapshotData';

const STATE_KEY = 'novaride_financial_state_v5';
const ACTIVE_SYSTEM_KEY = 'novaride_active_snapshot_system';
const ACTIVE_SCENARIO_KEY = 'novaride_active_snapshot_scenario';

export interface Snapshot {
  id: string;
  name: string;
  comment?: string;
  createdAt: string;
  stateData: string;
  snapshotType: SnapshotType;
  creatorEmail?: string;
}

export function useSnapshots() {
  const { user, isAdmin, getTabPermission } = useAuth();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeSnapshotName, setActiveSnapshotName] = useState<string | null>(() => localStorage.getItem(ACTIVE_SNAPSHOT_KEY));

  const canManageSnapshots = useCallback(() => {
    if (!user) return false;
    return true;
  }, [user]);

  const loadSnapshots = useCallback(async () => {
    if (!user) { setIsLoading(false); return; }
    try {
      const { data } = await supabase.from('snapshots' as any).select('*').order('created_at', { ascending: false });
      if (data) {
        const allSnapshots: Snapshot[] = (data as any[]).map(row => ({
          id: row.id,
          name: row.name,
          comment: row.comment,
          createdAt: row.created_at,
          stateData: JSON.stringify(row.state_data),
          snapshotType: row.snapshot_type || 'scenario',
          creatorEmail: row.creator_email,
        }));

        // Non-admins ne voient que les snapshots scénario
        if (!isAdmin) {
          setSnapshots(allSnapshots.filter(s => s.snapshotType === 'scenario'));
        } else {
          setSnapshots(allSnapshots);
        }
      }
    } catch {} finally { setIsLoading(false); }
  }, [user, isAdmin]);

  useEffect(() => { loadSnapshots(); }, [loadSnapshots]);

  const createSnapshot = useCallback(async (name: string, comment: string | undefined, type: SnapshotType) => {
    if (!user) return false;
    if (type === 'system' && !isAdmin) {
      toast({ title: 'Accès refusé', description: 'Seuls les administrateurs peuvent créer des sauvegardes système.', variant: 'destructive' });
      return false;
    }

    setIsSaving(true);
    try {
      const currentState = localStorage.getItem(STATE_KEY);
      const financialState = currentState ? JSON.parse(currentState) : {};
      const supabaseData = await collectSnapshotData(user.id, type);

      const fullStateData = {
        financialState,
        supabaseData,
        snapshotVersion: 3,
        snapshotType: type,
      };

      const { data, error } = await supabase
        .from('snapshots' as any)
        .insert({
          user_id: user.id,
          name,
          comment,
          state_data: fullStateData,
          snapshot_type: type,
          creator_email: user.email,
        } as any)
        .select()
        .single();

      if (error || !data) {
        toast({ title: 'Erreur', description: 'Impossible de créer la sauvegarde.', variant: 'destructive' });
        return false;
      }
      const d = data as any;
      const newSnap: Snapshot = {
        id: d.id, name: d.name, comment: d.comment, createdAt: d.created_at,
        stateData: JSON.stringify(d.state_data), snapshotType: d.snapshot_type || type,
        creatorEmail: d.creator_email,
      };
      setSnapshots(prev => [newSnap, ...prev]);
      setActiveSnapshotName(d.name);
      localStorage.setItem(ACTIVE_SNAPSHOT_KEY, d.name);
      
      const typeLabel = type === 'system' ? 'système' : 'scénario';
      toast({ title: 'Sauvegarde créée', description: `"${name}" (${typeLabel}) — données capturées.` });
      return true;
    } catch (e) {
      console.error('Failed to create snapshot:', e);
      toast({ title: 'Erreur', description: 'Impossible de créer la sauvegarde.', variant: 'destructive' });
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [user, isAdmin]);

  const restoreSnapshot = useCallback(async (id: string) => {
    if (!user) return false;
    const snapshot = snapshots.find(s => s.id === id);
    if (!snapshot) return false;

    if (snapshot.snapshotType === 'system' && !isAdmin) {
      toast({ title: 'Accès refusé', description: 'Seuls les administrateurs peuvent restaurer des sauvegardes système.', variant: 'destructive' });
      return false;
    }

    setIsSaving(true);
    try {
      const stateData = JSON.parse(snapshot.stateData);
      const version = stateData.snapshotVersion || 1;
      const type = stateData.snapshotType || snapshot.snapshotType || 'scenario';

      if (version >= 2 && stateData.supabaseData) {
        if (stateData.financialState) {
          localStorage.setItem(STATE_KEY, JSON.stringify(stateData.financialState));
        }
        const { success, errors } = await restoreSnapshotData(user.id, stateData.supabaseData, type);
        if (!success) {
          console.warn('Snapshot restore had errors:', errors);
          toast({ title: 'Restauration partielle', description: `${errors.length} erreur(s).`, variant: 'destructive' });
        }
      } else {
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
  }, [user, isAdmin, snapshots]);

  const duplicateSnapshot = useCallback(async (id: string) => {
    if (!user) return false;
    const snapshot = snapshots.find(s => s.id === id);
    if (!snapshot) return false;

    // Seuls les scénarios peuvent être dupliqués (ou admin pour système)
    if (snapshot.snapshotType === 'system' && !isAdmin) return false;

    setIsSaving(true);
    try {
      const stateData = JSON.parse(snapshot.stateData);
      const { data, error } = await supabase
        .from('snapshots' as any)
        .insert({
          user_id: user.id,
          name: `${snapshot.name} (copie)`,
          comment: snapshot.comment,
          state_data: stateData,
          snapshot_type: snapshot.snapshotType,
          creator_email: user.email,
        } as any)
        .select()
        .single();

      if (error || !data) {
        toast({ title: 'Erreur', description: 'Impossible de dupliquer.', variant: 'destructive' });
        return false;
      }
      const d = data as any;
      setSnapshots(prev => [{
        id: d.id, name: d.name, comment: d.comment, createdAt: d.created_at,
        stateData: JSON.stringify(d.state_data), snapshotType: d.snapshot_type,
        creatorEmail: d.creator_email,
      }, ...prev]);
      toast({ title: 'Duplication effectuée', description: `"${d.name}" créée.` });
      return true;
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de dupliquer.', variant: 'destructive' });
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [user, isAdmin, snapshots]);

  const deleteSnapshot = useCallback(async (id: string) => {
    if (!user) return false;
    const snapshot = snapshots.find(s => s.id === id);
    if (!snapshot) return false;

    // Système → admin only, Scénario → propriétaire ou admin
    if (snapshot.snapshotType === 'system' && !isAdmin) return false;

    await supabase.from('snapshots' as any).delete().eq('id', id);
    setSnapshots(prev => prev.filter(s => s.id !== id));
    toast({ title: 'Supprimée', description: `"${snapshot.name}" supprimée.` });
    return true;
  }, [user, isAdmin, snapshots]);

  const renameSnapshot = useCallback(async (id: string, newName: string) => {
    if (!user) return false;
    const { error } = await supabase.from('snapshots' as any).update({ name: newName } as any).eq('id', id);
    if (error) return false;
    setSnapshots(prev => prev.map(s => s.id === id ? { ...s, name: newName } : s));
    toast({ title: 'Renommé', description: `Sauvegarde renommée en "${newName}".` });
    return true;
  }, [user]);

  const formatDate = (isoString: string) => new Date(isoString).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const downloadSnapshot = useCallback((id: string) => {
    const snapshot = snapshots.find(s => s.id === id);
    if (!snapshot) return;
    const blob = new Blob([snapshot.stateData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${snapshot.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [snapshots]);

  return {
    snapshots, isLoading, isSaving, activeSnapshotName, canManageSnapshots: canManageSnapshots(),
    createSnapshot, restoreSnapshot, duplicateSnapshot, deleteSnapshot, renameSnapshot, downloadSnapshot, formatDate,
  };
}
