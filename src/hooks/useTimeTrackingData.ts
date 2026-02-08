import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

export interface TimeCategory {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface TimeEntry {
  id: string;
  user_id: string;
  date: string;
  category_id: string | null;
  task_description: string;
  duration_minutes: number;
  comments: string;
  created_at: string;
  updated_at: string;
}

export function useTimeTrackingData() {
  const { user, userRole } = useAuth();
  const [categories, setCategories] = useState<TimeCategory[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const canManageCategories = userRole === 'admin' || userRole === 'finance';

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [catRes, entRes] = await Promise.all([
        supabase.from('timetracking_categories' as any).select('*').order('name'),
        supabase.from('timetracking_entries' as any).select('*').eq('user_id', user.id).order('date', { ascending: false }),
      ]);
      if (catRes.data) setCategories((catRes.data as any[]).map((r: any) => ({
        id: r.id, name: r.name, color: r.color || '#6366f1', created_at: r.created_at,
      })));
      if (entRes.data) setEntries((entRes.data as any[]).map((r: any) => ({
        id: r.id, user_id: r.user_id, date: r.date, category_id: r.category_id,
        task_description: r.task_description, duration_minutes: r.duration_minutes || 0,
        comments: r.comments || '', created_at: r.created_at, updated_at: r.updated_at,
      })));
    } catch (err) {
      console.error('TimeTracking fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // === CATEGORIES ===
  const createCategory = async (name: string, color: string) => {
    if (!user) return;
    const { error } = await supabase.from('timetracking_categories' as any).insert({
      user_id: user.id, name, color,
    } as any);
    if (error) { toast.error('Erreur création catégorie'); console.error(error); }
    else { toast.success('Catégorie créée'); fetchAll(); }
  };

  const updateCategory = async (id: string, updates: Partial<TimeCategory>) => {
    const { error } = await supabase.from('timetracking_categories' as any).update(updates as any).eq('id', id);
    if (error) { toast.error('Erreur mise à jour catégorie'); console.error(error); }
    else { toast.success('Catégorie mise à jour'); fetchAll(); }
  };

  const deleteCategory = async (id: string) => {
    const { error } = await supabase.from('timetracking_categories' as any).delete().eq('id', id);
    if (error) { toast.error('Erreur suppression catégorie'); console.error(error); }
    else { toast.success('Catégorie supprimée'); fetchAll(); }
  };

  // === ENTRIES ===
  const createEntry = async (entry: Partial<TimeEntry>) => {
    if (!user) return;
    const { error } = await supabase.from('timetracking_entries' as any).insert({
      user_id: user.id, date: entry.date, category_id: entry.category_id || null,
      task_description: entry.task_description, duration_minutes: entry.duration_minutes || 0,
      comments: entry.comments || '',
    } as any);
    if (error) { toast.error('Erreur création entrée'); console.error(error); }
    else { toast.success('Temps enregistré'); fetchAll(); }
  };

  const updateEntry = async (id: string, updates: Partial<TimeEntry>) => {
    const { error } = await supabase.from('timetracking_entries' as any).update(updates as any).eq('id', id);
    if (error) { toast.error('Erreur mise à jour'); console.error(error); }
    else { fetchAll(); }
  };

  const deleteEntry = async (id: string) => {
    const { error } = await supabase.from('timetracking_entries' as any).delete().eq('id', id);
    if (error) { toast.error('Erreur suppression'); console.error(error); }
    else { fetchAll(); }
  };

  return {
    categories, entries, loading, canManageCategories,
    createCategory, updateCategory, deleteCategory,
    createEntry, updateEntry, deleteEntry,
    refresh: fetchAll,
  };
}
