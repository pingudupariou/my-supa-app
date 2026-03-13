import { Task } from '@/hooks/useTasksData';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';

interface TaskBannerProps {
  tasks: Task[];
  currentUserId: string | undefined;
}

export function TaskBanner({ tasks, currentUserId }: TaskBannerProps) {
  const today = new Date().toISOString().slice(0, 10);
  const myOverdue = tasks.filter(t =>
    t.status !== 'done' &&
    t.due_date && t.due_date < today &&
    (t.assigned_to === currentUserId || t.user_id === currentUserId)
  );

  if (myOverdue.length === 0) return null;

  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex items-center gap-3">
      <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-medium text-destructive">
          {myOverdue.length} tâche{myOverdue.length > 1 ? 's' : ''} en retard
        </p>
        <p className="text-xs text-muted-foreground">
          {myOverdue.slice(0, 3).map(t => t.title).join(', ')}
          {myOverdue.length > 3 ? ` et ${myOverdue.length - 3} autre(s)` : ''}
        </p>
      </div>
      <Badge variant="destructive" className="shrink-0">{myOverdue.length}</Badge>
    </div>
  );
}
