// ============================================
// SYSTÈME DE SNAPSHOTS (SAUVEGARDES CLOUD)
// ============================================

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
  stateData: string; // JSON stringifié de l'état complet
}

interface SnapshotsState {
  snapshots: Snapshot[];
  isLoading: boolean;
}

export function useSnapshots() {
  const { user, isAdmin, getTabPermission } = useAuth();
  const [state, setState] = useState<SnapshotsState>({
    snapshots: [],
    isLoading: true,
  });

  // Vérifier si l'utilisateur peut créer/modifier des sauvegardes
  const canManageSnapshots = useCallback(() => {
    if (!user) return false;
    if (isAdmin) return true;
    
    // Vérifier si l'utilisateur a des droits d'écriture sur au moins un onglet
    const tabKeys = ['home', 'product-plan', 'organisation', 'charges', 'funding', 'scenarios', 'valuation', 'investment-summary'];
    return tabKeys.some(tabKey => getTabPermission(tabKey) === 'write');
  }, [user, isAdmin, getTabPermission]);

  // Charger les snapshots depuis Supabase
  const loadSnapshots = useCallback(async () => {
    if (!user) {
      setState({ snapshots: [], isLoading: false });
      return;
    }

    try {
      // Charger toutes les sauvegardes (tous les utilisateurs peuvent voir toutes les sauvegardes)
      const { data, error } = await supabase
        .from('snapshots')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading snapshots:', error);
        setState({ snapshots: [], isLoading: false });
        return;
      }

      const snapshots: Snapshot[] = (data || []).map(row => ({
        id: row.id,
        name: row.name,
        comment: row.comment || undefined,
        createdAt: row.created_at,
        stateData: JSON.stringify(row.state_data),
      }));

      setState({ snapshots, isLoading: false });
    } catch (e) {
      console.error('Failed to load snapshots:', e);
      setState({ snapshots: [], isLoading: false });
    }
  }, [user]);

  // Charger les snapshots au démarrage et quand l'utilisateur change
  useEffect(() => {
    loadSnapshots();
  }, [loadSnapshots]);

  // Créer un nouveau snapshot
  const createSnapshot = useCallback(async (name: string, comment?: string): Promise<boolean> => {
    if (!user) {
      toast({
        title: "Erreur",
        description: "Vous devez être connecté pour créer une sauvegarde.",
        variant: "destructive",
      });
      return false;
    }

    if (!canManageSnapshots()) {
      toast({
        title: "Accès refusé",
        description: "Vous n'avez pas les droits pour créer des sauvegardes.",
        variant: "destructive",
      });
      return false;
    }

    try {
      const currentState = localStorage.getItem(STATE_KEY);
      if (!currentState) {
        toast({
          title: "Erreur",
          description: "Aucune donnée à sauvegarder.",
          variant: "destructive",
        });
        return false;
      }

      const stateData = JSON.parse(currentState);

      const { data, error } = await supabase
        .from('snapshots')
        .insert({
          user_id: user.id,
          name,
          comment: comment || null,
          state_data: stateData,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating snapshot:', error);
        toast({
          title: "Erreur",
          description: "Impossible de créer la sauvegarde.",
          variant: "destructive",
        });
        return false;
      }

      // Ajouter le nouveau snapshot à la liste
      const newSnapshot: Snapshot = {
        id: data.id,
        name: data.name,
        comment: data.comment || undefined,
        createdAt: data.created_at,
        stateData: JSON.stringify(data.state_data),
      };

      setState(prev => ({
        ...prev,
        snapshots: [newSnapshot, ...prev.snapshots],
      }));

      toast({
        title: "Sauvegarde créée",
        description: `"${name}" a été enregistrée avec succès.`,
      });

      return true;
    } catch (e) {
      console.error('Failed to create snapshot:', e);
      toast({
        title: "Erreur",
        description: "Impossible de créer la sauvegarde.",
        variant: "destructive",
      });
      return false;
    }
  }, [user, canManageSnapshots]);

  // Restaurer un snapshot
  const restoreSnapshot = useCallback((id: string): boolean => {
    try {
      const snapshot = state.snapshots.find(s => s.id === id);
      if (!snapshot) {
        toast({
          title: "Erreur",
          description: "Sauvegarde introuvable.",
          variant: "destructive",
        });
        return false;
      }

      // Remplacer l'état actuel par celui du snapshot
      localStorage.setItem(STATE_KEY, snapshot.stateData);

      toast({
        title: "Restauration effectuée",
        description: `"${snapshot.name}" a été restaurée. Rechargement...`,
      });

      // Recharger la page pour appliquer les changements
      setTimeout(() => {
        window.location.reload();
      }, 500);

      return true;
    } catch (e) {
      console.error('Failed to restore snapshot:', e);
      toast({
        title: "Erreur",
        description: "Impossible de restaurer la sauvegarde.",
        variant: "destructive",
      });
      return false;
    }
  }, [state.snapshots]);

  // Dupliquer un snapshot
  const duplicateSnapshot = useCallback(async (id: string): Promise<boolean> => {
    if (!user || !canManageSnapshots()) {
      toast({
        title: "Accès refusé",
        description: "Vous n'avez pas les droits pour dupliquer des sauvegardes.",
        variant: "destructive",
      });
      return false;
    }

    try {
      const snapshot = state.snapshots.find(s => s.id === id);
      if (!snapshot) {
        toast({
          title: "Erreur",
          description: "Sauvegarde introuvable.",
          variant: "destructive",
        });
        return false;
      }

      const stateData = JSON.parse(snapshot.stateData);

      const { data, error } = await supabase
        .from('snapshots')
        .insert({
          user_id: user.id,
          name: `${snapshot.name} (copie)`,
          comment: snapshot.comment || null,
          state_data: stateData,
        })
        .select()
        .single();

      if (error) {
        console.error('Error duplicating snapshot:', error);
        toast({
          title: "Erreur",
          description: "Impossible de dupliquer la sauvegarde.",
          variant: "destructive",
        });
        return false;
      }

      const duplicated: Snapshot = {
        id: data.id,
        name: data.name,
        comment: data.comment || undefined,
        createdAt: data.created_at,
        stateData: JSON.stringify(data.state_data),
      };

      setState(prev => ({
        ...prev,
        snapshots: [duplicated, ...prev.snapshots],
      }));

      toast({
        title: "Duplication effectuée",
        description: `"${duplicated.name}" a été créée.`,
      });

      return true;
    } catch (e) {
      console.error('Failed to duplicate snapshot:', e);
      toast({
        title: "Erreur",
        description: "Impossible de dupliquer la sauvegarde.",
        variant: "destructive",
      });
      return false;
    }
  }, [user, state.snapshots, canManageSnapshots]);

  // Supprimer un snapshot
  const deleteSnapshot = useCallback(async (id: string): Promise<boolean> => {
    if (!user || !canManageSnapshots()) {
      toast({
        title: "Accès refusé",
        description: "Vous n'avez pas les droits pour supprimer des sauvegardes.",
        variant: "destructive",
      });
      return false;
    }

    try {
      const snapshot = state.snapshots.find(s => s.id === id);
      if (!snapshot) {
        toast({
          title: "Erreur",
          description: "Sauvegarde introuvable.",
          variant: "destructive",
        });
        return false;
      }

      const { error } = await supabase
        .from('snapshots')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting snapshot:', error);
        toast({
          title: "Erreur",
          description: "Impossible de supprimer la sauvegarde.",
          variant: "destructive",
        });
        return false;
      }

      setState(prev => ({
        ...prev,
        snapshots: prev.snapshots.filter(s => s.id !== id),
      }));

      toast({
        title: "Suppression effectuée",
        description: `"${snapshot.name}" a été supprimée.`,
      });

      return true;
    } catch (e) {
      console.error('Failed to delete snapshot:', e);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la sauvegarde.",
        variant: "destructive",
      });
      return false;
    }
  }, [user, state.snapshots, canManageSnapshots]);

  // Renommer un snapshot
  const renameSnapshot = useCallback(async (id: string, newName: string): Promise<boolean> => {
    if (!user || !canManageSnapshots()) {
      toast({
        title: "Accès refusé",
        description: "Vous n'avez pas les droits pour renommer des sauvegardes.",
        variant: "destructive",
      });
      return false;
    }

    try {
      const { error } = await supabase
        .from('snapshots')
        .update({ name: newName })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error renaming snapshot:', error);
        return false;
      }

      setState(prev => ({
        ...prev,
        snapshots: prev.snapshots.map(s =>
          s.id === id ? { ...s, name: newName } : s
        ),
      }));

      toast({
        title: "Renommage effectué",
        description: `Sauvegarde renommée en "${newName}".`,
      });

      return true;
    } catch (e) {
      console.error('Failed to rename snapshot:', e);
      return false;
    }
  }, [user, canManageSnapshots]);

  // Formater la date
  const formatDate = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return {
    snapshots: state.snapshots,
    isLoading: state.isLoading,
    canManageSnapshots: canManageSnapshots(),
    createSnapshot,
    restoreSnapshot,
    duplicateSnapshot,
    deleteSnapshot,
    renameSnapshot,
    formatDate,
  };
}
