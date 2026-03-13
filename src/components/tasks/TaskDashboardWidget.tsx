import { Task } from '@/hooks/useTasksData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, Circle, AlertTriangle } from 'lucide-react';

interface TaskDashboardWidgetProps {
  tasks: Task[];
  currentUserId: string | undefined;
}

export function TaskDashboardWidget({ tasks, currentUserId }: TaskDashboardWidgetProps) {
  const myTasks = tasks.filter(t => t.assigned_to === currentUserId || t.user_id === currentUserId);
  const todo = myTasks.filter(t => t.status === 'todo').length;
  const inProgress = myTasks.filter(t => t.status === 'in_progress').length;
  const done = myTasks.filter(t => t.status === 'done').length;
  const today = new Date().toISOString().slice(0, 10);
  const overdue = myTasks.filter(t => t.status !== 'done' && t.due_date && t.due_date < today).length;

  const urgentTasks = myTasks
    .filter(t => t.status !== 'done')
    .sort((a, b) => {
      if (a.priority === 'haute' && b.priority !== 'haute') return -1;
      if (b.priority === 'haute' && a.priority !== 'haute') return 1;
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
      return a.due_date ? -1 : 1;
    })
    .slice(0, 5);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          📋 Mes tâches
          {overdue > 0 && (
            <Badge variant="destructive" className="text-[10px]">
              <AlertTriangle className="h-3 w-3 mr-0.5" />{overdue} en retard
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <Circle className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
            <div className="text-lg font-bold">{todo}</div>
            <div className="text-[10px] text-muted-foreground">À faire</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-blue-50 dark:bg-blue-950">
            <Clock className="h-4 w-4 mx-auto text-blue-600 mb-1" />
            <div className="text-lg font-bold">{inProgress}</div>
            <div className="text-[10px] text-muted-foreground">En cours</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-green-50 dark:bg-green-950">
            <CheckCircle2 className="h-4 w-4 mx-auto text-green-600 mb-1" />
            <div className="text-lg font-bold">{done}</div>
            <div className="text-[10px] text-muted-foreground">Terminé</div>
          </div>
        </div>
        {urgentTasks.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground">Prioritaires :</p>
            {urgentTasks.map(t => (
              <div key={t.id} className="flex items-center gap-2 text-sm">
                {t.status === 'in_progress' ? <Clock className="h-3 w-3 text-blue-600" /> : <Circle className="h-3 w-3 text-muted-foreground" />}
                <span className="truncate flex-1">{t.title}</span>
                {t.priority === 'haute' && <Badge variant="destructive" className="text-[9px] px-1">Urgent</Badge>}
              </div>
            ))}
          </div>
        )}
        {myTasks.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-2">Aucune tâche assignée</p>
        )}
      </CardContent>
    </Card>
  );
}
