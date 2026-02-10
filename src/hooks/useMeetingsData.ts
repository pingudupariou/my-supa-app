import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

export interface Meeting {
  id: string;
  meeting_date: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface MeetingTask {
  id: string;
  meeting_id: string;
  description: string;
  is_completed: boolean;
  sort_order: number;
  created_at: string;
}

export function useMeetingsData() {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [tasks, setTasks] = useState<MeetingTask[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    try {
      const [meetRes, taskRes] = await Promise.all([
        supabase.from('costflow_meetings' as any).select('*').order('meeting_date', { ascending: false }),
        supabase.from('costflow_meeting_tasks' as any).select('*').order('sort_order'),
      ]);
      if (meetRes.data) setMeetings((meetRes.data as any[]).map((r: any) => ({
        id: r.id, meeting_date: r.meeting_date, title: r.title || '',
        content: r.content || '', created_at: r.created_at, updated_at: r.updated_at,
      })));
      if (taskRes.data) setTasks((taskRes.data as any[]).map((r: any) => ({
        id: r.id, meeting_id: r.meeting_id, description: r.description,
        is_completed: r.is_completed || false, sort_order: r.sort_order || 0,
        created_at: r.created_at,
      })));
    } catch (err) {
      console.error('Meetings fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const createMeeting = async (meeting: Partial<Meeting>) => {
    if (!user) return;
    const { error } = await supabase.from('costflow_meetings' as any).insert({
      user_id: user.id,
      meeting_date: meeting.meeting_date || new Date().toISOString().split('T')[0],
      title: meeting.title || '',
      content: meeting.content || '',
    } as any);
    if (error) { toast.error('Erreur création réunion'); console.error(error); }
    else { toast.success('Réunion créée'); fetchAll(); }
  };

  const updateMeeting = async (id: string, meeting: Partial<Meeting>) => {
    if (!user) return;
    const { error } = await supabase.from('costflow_meetings' as any).update(meeting as any).eq('id', id);
    if (error) { toast.error('Erreur mise à jour réunion'); console.error(error); }
    else { fetchAll(); }
  };

  const deleteMeeting = async (id: string) => {
    const { error } = await supabase.from('costflow_meetings' as any).delete().eq('id', id);
    if (error) { toast.error('Erreur suppression réunion'); console.error(error); }
    else { toast.success('Réunion supprimée'); fetchAll(); }
  };

  const createTask = async (meetingId: string, description: string) => {
    if (!user) return;
    const meetingTasks = tasks.filter(t => t.meeting_id === meetingId);
    const maxOrder = meetingTasks.length > 0 ? Math.max(...meetingTasks.map(t => t.sort_order)) : -1;
    const { error } = await supabase.from('costflow_meeting_tasks' as any).insert({
      user_id: user.id, meeting_id: meetingId, description, sort_order: maxOrder + 1,
    } as any);
    if (error) { toast.error('Erreur ajout tâche'); console.error(error); }
    else { fetchAll(); }
  };

  const updateTask = async (id: string, updates: Partial<MeetingTask>) => {
    if (!user) return;
    const { error } = await supabase.from('costflow_meeting_tasks' as any).update(updates as any).eq('id', id);
    if (error) { toast.error('Erreur mise à jour tâche'); console.error(error); }
    else { fetchAll(); }
  };

  const deleteTask = async (id: string) => {
    const { error } = await supabase.from('costflow_meeting_tasks' as any).delete().eq('id', id);
    if (error) { toast.error('Erreur suppression tâche'); console.error(error); }
    else { fetchAll(); }
  };

  const getTasksForMeeting = (meetingId: string) => tasks.filter(t => t.meeting_id === meetingId);

  return {
    meetings, tasks, loading,
    createMeeting, updateMeeting, deleteMeeting,
    createTask, updateTask, deleteTask,
    getTasksForMeeting, refresh: fetchAll,
  };
}
