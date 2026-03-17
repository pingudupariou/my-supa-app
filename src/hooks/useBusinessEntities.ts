import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';

export interface BusinessEntity {
  id: string;
  name: string;
  description: string | null;
  color: string;
  is_default: boolean;
  created_at: string;
  user_id: string;
}

export function useBusinessEntities() {
  const { toast } = useToast();
  const { user, isAdmin } = useAuth();
  const [entities, setEntities] = useState<BusinessEntity[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEntities = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('crm_business_entities' as any)
        .select('*')
        .order('name');
      if (error) throw error;
      const list = (data || []) as unknown as BusinessEntity[];
      setEntities(list);
      // Auto-select default or first
      if (!selectedEntityId && list.length > 0) {
        const def = list.find(e => e.is_default);
        setSelectedEntityId(def?.id || list[0].id);
      }
    } catch {
      // Table may not exist yet
    } finally {
      setIsLoading(false);
    }
  }, [selectedEntityId]);

  useEffect(() => { fetchEntities(); }, [fetchEntities]);

  const createEntity = useCallback(async (entity: { name: string; description?: string; color?: string }) => {
    if (!user) return null;
    try {
      const { data, error } = await supabase
        .from('crm_business_entities' as any)
        .insert({ ...entity, user_id: user.id })
        .select().single();
      if (error) throw error;
      const e = data as unknown as BusinessEntity;
      setEntities(prev => [...prev, e].sort((a, b) => a.name.localeCompare(b.name)));
      if (entities.length === 0) setSelectedEntityId(e.id);
      toast({ title: 'Entité créée', description: `${e.name} ajoutée.` });
      return e;
    } catch {
      toast({ title: 'Erreur', variant: 'destructive' });
      return null;
    }
  }, [user, toast, entities.length]);

  const updateEntity = useCallback(async (id: string, updates: Partial<BusinessEntity>) => {
    try {
      const { error } = await supabase.from('crm_business_entities' as any).update(updates as any).eq('id', id);
      if (error) throw error;
      setEntities(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
      return true;
    } catch {
      toast({ title: 'Erreur', variant: 'destructive' });
      return false;
    }
  }, [toast]);

  const deleteEntity = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from('crm_business_entities' as any).delete().eq('id', id);
      if (error) throw error;
      setEntities(prev => prev.filter(e => e.id !== id));
      if (selectedEntityId === id) {
        const remaining = entities.filter(e => e.id !== id);
        setSelectedEntityId(remaining.length > 0 ? remaining[0].id : null);
      }
      toast({ title: 'Entité supprimée' });
      return true;
    } catch {
      toast({ title: 'Erreur', variant: 'destructive' });
      return false;
    }
  }, [toast, selectedEntityId, entities]);

  const setDefault = useCallback(async (id: string) => {
    // Remove default from all, set on this one
    for (const e of entities) {
      if (e.is_default && e.id !== id) {
        await supabase.from('crm_business_entities' as any).update({ is_default: false } as any).eq('id', e.id);
      }
    }
    await supabase.from('crm_business_entities' as any).update({ is_default: true } as any).eq('id', id);
    setEntities(prev => prev.map(e => ({ ...e, is_default: e.id === id })));
  }, [entities]);

  return {
    entities,
    selectedEntityId,
    setSelectedEntityId,
    selectedEntity: entities.find(e => e.id === selectedEntityId) || null,
    isLoading,
    createEntity,
    updateEntity,
    deleteEntity,
    setDefault,
    refreshEntities: fetchEntities,
  };
}
