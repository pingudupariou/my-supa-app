import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PlanningNote {
  id: string;
  user_id: string;
  block_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export function usePlanningNotes() {
  const [notes, setNotes] = useState<PlanningNote[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotes = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('costflow_planning_notes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setNotes(data || []);
    } catch (e: any) {
      toast.error('Erreur chargement notes: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  const getNotesForBlock = (blockId: string) => notes.filter(n => n.block_id === blockId);

  const getNotesForBlocks = (blockIds: string[]) => notes.filter(n => blockIds.includes(n.block_id));

  const upsertNote = async (blockId: string, content: string) => {
    const { data: userData } = await supabase.auth.getUser();
    const user_id = userData.user?.id;
    if (!user_id) return;

    const existing = notes.find(n => n.block_id === blockId);
    if (existing) {
      const { error } = await supabase
        .from('costflow_planning_notes')
        .update({ content })
        .eq('id', existing.id);
      if (error) { toast.error(error.message); return; }
      setNotes(prev => prev.map(n => n.id === existing.id ? { ...n, content, updated_at: new Date().toISOString() } : n));
    } else {
      const { data, error } = await supabase
        .from('costflow_planning_notes')
        .insert({ user_id, block_id: blockId, content })
        .select()
        .single();
      if (error) { toast.error(error.message); return; }
      setNotes(prev => [data, ...prev]);
    }
    toast.success('Note sauvegardée');
  };

  return { notes, loading, getNotesForBlock, getNotesForBlocks, upsertNote };
}
