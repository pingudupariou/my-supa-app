import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'haute' | 'moyenne' | 'basse';
  assigned_to: string | null;
  assigned_by: string | null;
  customer_id: string | null;
  meeting_id: string | null;
  context: string;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskNotification {
  id: string;
  user_id: string;
  task_id: string;
  notification_type: string;
  is_read: boolean;
  created_at: string;
}

export interface TaskHistory {
  id: string;
  task_id: string;
  user_id: string;
  action: string;
  details: string;
  created_at: string;
}

export function useTasksData() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notifications, setNotifications] = useState<TaskNotification[]>([]);
  const [history, setHistory] = useState<TaskHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    try {
      const [tasksRes, notifsRes, histRes] = await Promise.all([
        supabase.from('tasks' as any).select('*').order('created_at', { ascending: false }),
        supabase.from('task_notifications' as any).select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('task_history' as any).select('*').order('created_at', { ascending: false }).limit(200),
      ]);
      if (tasksRes.data) setTasks(tasksRes.data as any[]);
      if (notifsRes.data) setNotifications(notifsRes.data as any[]);
      if (histRes.data) setHistory(histRes.data as any[]);
    } catch (err) {
      console.error('Tasks fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Realtime subscription for notifications
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('task-notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'task_notifications',
        filter: `user_id=eq.${user.id}`,
      }, () => { fetchAll(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchAll]);

  const addHistory = async (taskId: string, action: string, details: string) => {
    if (!user) return;
    await supabase.from('task_history' as any).insert({
      task_id: taskId, user_id: user.id, action, details,
    } as any);
  };

  const createTask = async (task: Partial<Task>) => {
    if (!user) return;
    const newTask = {
      user_id: user.id,
      title: task.title || 'Nouvelle tâche',
      description: task.description || '',
      status: task.status || 'todo',
      priority: task.priority || 'moyenne',
      assigned_to: task.assigned_to || null,
      assigned_by: task.assigned_to ? user.id : null,
      customer_id: task.customer_id || null,
      meeting_id: task.meeting_id || null,
      context: task.context || 'global',
      due_date: task.due_date || null,
    };
    const { data, error } = await supabase.from('tasks' as any).insert(newTask as any).select().single();
    if (error) { toast.error('Erreur création tâche'); console.error(error); return; }
    const created = data as any;
    await addHistory(created.id, 'created', `Tâche créée : ${newTask.title}`);
    if (newTask.assigned_to && newTask.assigned_to !== user.id) {
      await supabase.from('task_notifications' as any).insert({
        user_id: newTask.assigned_to,
        task_id: created.id,
        notification_type: 'assigned',
      } as any);
    }
    toast.success('Tâche créée');
    fetchAll();
  };

  const updateTask = async (id: string, updates: Partial<Task>) => {
    if (!user) return;
    const prev = tasks.find(t => t.id === id);
    if (updates.status === 'done' && prev?.status !== 'done') {
      (updates as any).completed_at = new Date().toISOString();
    }
    const { error } = await supabase.from('tasks' as any).update(updates as any).eq('id', id);
    if (error) { toast.error('Erreur mise à jour'); console.error(error); return; }
    
    // Log changes
    const changes: string[] = [];
    if (updates.status && prev?.status !== updates.status) changes.push(`Statut → ${updates.status}`);
    if (updates.priority && prev?.priority !== updates.priority) changes.push(`Priorité → ${updates.priority}`);
    if (updates.assigned_to && prev?.assigned_to !== updates.assigned_to) {
      changes.push('Réassignée');
      if (updates.assigned_to !== user.id) {
        await supabase.from('task_notifications' as any).insert({
          user_id: updates.assigned_to,
          task_id: id,
          notification_type: updates.status === 'done' ? 'completed' : 'updated',
        } as any);
      }
    }
    if (changes.length) await addHistory(id, 'updated', changes.join(', '));
    fetchAll();
  };

  const deleteTask = async (id: string) => {
    const { error } = await supabase.from('tasks' as any).delete().eq('id', id);
    if (error) { toast.error('Erreur suppression'); console.error(error); return; }
    toast.success('Tâche supprimée');
    fetchAll();
  };

  const markNotificationRead = async (id: string) => {
    await supabase.from('task_notifications' as any).update({ is_read: true } as any).eq('id', id);
    fetchAll();
  };

  const markAllNotificationsRead = async () => {
    if (!user) return;
    await supabase.from('task_notifications' as any).update({ is_read: true } as any).eq('user_id', user.id).eq('is_read', false);
    fetchAll();
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const getTasksForCustomer = (customerId: string) => tasks.filter(t => t.customer_id === customerId);
  const getMyTasks = () => tasks.filter(t => t.assigned_to === user?.id || t.user_id === user?.id);
  const getTaskHistory = (taskId: string) => history.filter(h => h.task_id === taskId);

  return {
    tasks, notifications, history, isLoading, unreadCount,
    createTask, updateTask, deleteTask,
    markNotificationRead, markAllNotificationsRead,
    getTasksForCustomer, getMyTasks, getTaskHistory,
    refresh: fetchAll,
  };
}
