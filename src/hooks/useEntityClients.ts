import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';

export interface EntityClient {
  id: string;
  business_entity_id: string;
  client_id: string;
  created_at: string;
  user_id: string;
}

export function useEntityClients() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [entityClients, setEntityClients] = useState<EntityClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEntityClients = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('crm_entity_clients' as any)
        .select('*');
      if (error) throw error;
      setEntityClients((data || []) as unknown as EntityClient[]);
    } catch {
      // Table may not exist yet
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchEntityClients(); }, [fetchEntityClients]);

  const getClientIdsForEntity = useCallback((entityId: string): string[] => {
    return entityClients
      .filter(ec => ec.business_entity_id === entityId)
      .map(ec => ec.client_id);
  }, [entityClients]);

  const isClientInEntity = useCallback((entityId: string, clientId: string): boolean => {
    return entityClients.some(ec => ec.business_entity_id === entityId && ec.client_id === clientId);
  }, [entityClients]);

  const addClientToEntity = useCallback(async (entityId: string, clientId: string) => {
    if (!user) return false;
    try {
      const { data, error } = await supabase
        .from('crm_entity_clients' as any)
        .insert({ business_entity_id: entityId, client_id: clientId, user_id: user.id })
        .select().single();
      if (error) throw error;
      setEntityClients(prev => [...prev, data as unknown as EntityClient]);
      return true;
    } catch {
      toast({ title: 'Erreur', variant: 'destructive' });
      return false;
    }
  }, [user, toast]);

  const removeClientFromEntity = useCallback(async (entityId: string, clientId: string) => {
    if (!user) return false;
    try {
      const { error } = await supabase
        .from('crm_entity_clients' as any)
        .delete()
        .eq('business_entity_id', entityId)
        .eq('client_id', clientId);
      if (error) throw error;
      setEntityClients(prev => prev.filter(ec => !(ec.business_entity_id === entityId && ec.client_id === clientId)));
      return true;
    } catch {
      toast({ title: 'Erreur', variant: 'destructive' });
      return false;
    }
  }, [user, toast]);

  const toggleClientEntity = useCallback(async (entityId: string, clientId: string) => {
    if (isClientInEntity(entityId, clientId)) {
      return removeClientFromEntity(entityId, clientId);
    } else {
      return addClientToEntity(entityId, clientId);
    }
  }, [isClientInEntity, addClientToEntity, removeClientFromEntity]);

  const bulkAddClientsToEntity = useCallback(async (entityId: string, clientIds: string[]) => {
    if (!user) return false;
    try {
      const existing = getClientIdsForEntity(entityId);
      const toAdd = clientIds.filter(id => !existing.includes(id));
      if (toAdd.length === 0) return true;
      const rows = toAdd.map(clientId => ({
        business_entity_id: entityId,
        client_id: clientId,
        user_id: user.id,
      }));
      const { data, error } = await supabase
        .from('crm_entity_clients' as any)
        .insert(rows)
        .select();
      if (error) throw error;
      setEntityClients(prev => [...prev, ...((data || []) as unknown as EntityClient[])]);
      toast({ title: `${toAdd.length} client(s) associé(s)` });
      return true;
    } catch {
      toast({ title: 'Erreur', variant: 'destructive' });
      return false;
    }
  }, [user, toast, getClientIdsForEntity]);

  return {
    entityClients,
    isLoading,
    getClientIdsForEntity,
    isClientInEntity,
    addClientToEntity,
    removeClientFromEntity,
    toggleClientEntity,
    bulkAddClientsToEntity,
    refreshEntityClients: fetchEntityClients,
  };
}
