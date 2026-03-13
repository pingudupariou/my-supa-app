import { useState, useEffect } from 'react';
import { TaskNotification, Task } from '@/hooks/useTasksData';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Bell, CheckCheck, Clock, User, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';

interface NotificationBellProps {
  notifications: TaskNotification[];
  unreadCount: number;
  tasks: Task[];
  users: { id: string; email: string; display_name: string }[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onNavigateToTask?: (taskId: string) => void;
}

const typeLabels: Record<string, string> = {
  assigned: '📋 Tâche assignée',
  updated: '✏️ Tâche mise à jour',
  completed: '✅ Tâche terminée',
};

export function NotificationBell({
  notifications, unreadCount, tasks, users, onMarkRead, onMarkAllRead, onNavigateToTask,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);

  const getTaskTitle = (taskId: string) => tasks.find(t => t.id === taskId)?.title || 'Tâche';
  const getUserName = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task?.assigned_by) return '';
    const u = users.find(u => u.id === task.assigned_by);
    return u?.display_name || u?.email?.split('@')[0] || '';
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative p-2 rounded-md hover:bg-sidebar-accent/20 transition-colors">
          <Bell className="h-4 w-4 text-sidebar-foreground/70" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" side="bottom">
        <div className="flex items-center justify-between p-3 border-b">
          <span className="text-sm font-semibold">Notifications</span>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={onMarkAllRead}>
              <CheckCheck className="h-3 w-3 mr-1" /> Tout lire
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[350px]">
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aucune notification</p>
          ) : (
            <div className="divide-y">
              {notifications.slice(0, 20).map(n => (
                <button
                  key={n.id}
                  className={`w-full text-left p-3 hover:bg-muted/50 transition-colors ${!n.is_read ? 'bg-primary/5' : ''}`}
                  onClick={() => { onMarkRead(n.id); onNavigateToTask?.(n.task_id); }}
                >
                  <div className="flex items-start gap-2">
                    {!n.is_read && <span className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">{typeLabels[n.notification_type] || n.notification_type}</p>
                      <p className="text-sm font-medium truncate">{getTaskTitle(n.task_id)}</p>
                      {getUserName(n.task_id) && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          par {getUserName(n.task_id)}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {format(new Date(n.created_at), "dd MMM à HH:mm", { locale: fr })}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
