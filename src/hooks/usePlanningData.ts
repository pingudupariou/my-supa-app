import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PlanningColor {
  id: string;
  user_id: string;
  name: string;
  color: string;
  sort_order: number;
}

export interface PlanningRow {
  id: string;
  user_id: string;
  label: string;
  sort_order: number;
}

export interface PlanningBlock {
  id: string;
  user_id: string;
  row_id: string;
  color_id: string | null;
  label: string;
  start_month: number;
  duration: number;
}

export function usePlanningData() {
  const [colors, setColors] = useState<PlanningColor[]>([]);
  const [rows, setRows] = useState<PlanningRow[]>([]);
  const [blocks, setBlocks] = useState<PlanningBlock[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const [cRes, rRes, bRes] = await Promise.all([
        supabase.from('costflow_planning_colors').select('*').order('sort_order'),
        supabase.from('costflow_planning_rows').select('*').order('sort_order'),
        supabase.from('costflow_planning_blocks').select('*'),
      ]);
      if (cRes.error) throw cRes.error;
      if (rRes.error) throw rRes.error;
      if (bRes.error) throw bRes.error;
      setColors(cRes.data || []);
      setRows(rRes.data || []);
      setBlocks(bRes.data || []);
    } catch (e: any) {
      toast.error('Erreur chargement planning: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const getUserId = async () => {
    const { data } = await supabase.auth.getUser();
    return data.user?.id;
  };

  // Colors
  const createColor = async (name: string, color: string) => {
    const user_id = await getUserId();
    if (!user_id) return;
    const { data, error } = await supabase.from('costflow_planning_colors')
      .insert({ user_id, name, color, sort_order: colors.length })
      .select().single();
    if (error) { toast.error(error.message); return; }
    setColors(prev => [...prev, data]);
  };

  const updateColor = async (id: string, updates: Partial<Pick<PlanningColor, 'name' | 'color'>>) => {
    const { error } = await supabase.from('costflow_planning_colors').update(updates).eq('id', id);
    if (error) { toast.error(error.message); return; }
    setColors(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const deleteColor = async (id: string) => {
    const { error } = await supabase.from('costflow_planning_colors').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    setColors(prev => prev.filter(c => c.id !== id));
  };

  // Rows
  const createRow = async (label: string) => {
    const user_id = await getUserId();
    if (!user_id) return;
    const { data, error } = await supabase.from('costflow_planning_rows')
      .insert({ user_id, label, sort_order: rows.length })
      .select().single();
    if (error) { toast.error(error.message); return; }
    setRows(prev => [...prev, data]);
  };

  const updateRow = async (id: string, label: string) => {
    const { error } = await supabase.from('costflow_planning_rows').update({ label }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    setRows(prev => prev.map(r => r.id === id ? { ...r, label } : r));
  };

  const deleteRow = async (id: string) => {
    const { error } = await supabase.from('costflow_planning_rows').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    setRows(prev => prev.filter(r => r.id !== id));
    setBlocks(prev => prev.filter(b => b.row_id !== id));
  };

  // Blocks
  const createBlock = async (row_id: string, start_month: number, duration: number, color_id: string | null, label: string) => {
    const user_id = await getUserId();
    if (!user_id) return;
    const { data, error } = await supabase.from('costflow_planning_blocks')
      .insert({ user_id, row_id, start_month, duration, color_id, label })
      .select().single();
    if (error) { toast.error(error.message); return; }
    setBlocks(prev => [...prev, data]);
  };

  const updateBlock = async (id: string, updates: Partial<Pick<PlanningBlock, 'start_month' | 'duration' | 'color_id' | 'label' | 'row_id'>>) => {
    const { error } = await supabase.from('costflow_planning_blocks').update(updates).eq('id', id);
    if (error) { toast.error(error.message); return; }
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  const deleteBlock = async (id: string) => {
    const { error } = await supabase.from('costflow_planning_blocks').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    setBlocks(prev => prev.filter(b => b.id !== id));
  };

  return {
    colors, rows, blocks, loading,
    createColor, updateColor, deleteColor,
    createRow, updateRow, deleteRow,
    createBlock, updateBlock, deleteBlock,
  };
}
