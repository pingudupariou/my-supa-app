import { Task } from '@/hooks/useTasksData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, Circle, AlertTriangle, ArrowRight, User } from 'lucide-react';

interface TeamMember {
  id: string;
  email: string;
  display_name: string;
}

interface TaskDashboardWidgetProps {
  tasks: Task[];
  currentUserId: string | undefined;
  users?: TeamMember[];
}

const statusConfig = {
  todo: { label: 'À faire', icon: Circle, color: 'text-muted-foreground' },
  in_progress: { label: 'En cours', icon: Clock, color: 'text-blue-600' },
  done: { label: 'Terminé', icon: CheckCircle2, color: 'text-green-600' },
};

export function TaskDashboardWidget({ tasks, currentUserId, users = [] }: TaskDashboardWidgetProps) {
  const getUserName = (id: string | null) => {
    if (!id) return '—';
    const u = users.find(m => m.id === id);
    return u ? u.display_name || u.email.split('@')[0] : id.slice(0, 6);
  };

  const allActive = tasks.filter(t => t.status !== 'done');
  const today = new Date().toISOString().slice(0, 10);
  const overdue = allActive.filter(t => t.due_date && t.due_date < today).length;

  const displayTasks = allActive
    .sort((a, b) => {
      if (a.priority === 'haute' && b.priority !== 'haute') return -1;
      if (b.priority === 'haute' && a.priority !== 'haute') return 1;
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
      return a.due_date ? -1 : 1;
    })
    .slice(0, 8);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          📋 Les tâches
          {overdue > 0 && (
            <Badge variant="destructive" className="text-[10px]">
              <AlertTriangle className="h-3 w-3 mr-0.5" />{overdue} en retard
            </Badge>
          )}
          <Badge variant="secondary" className="text-[10px] ml-auto">{allActive.length} actives</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {displayTasks.length > 0 ? (
          <div className="space-y-2">
            {displayTasks.map(t => {
              const cfg = statusConfig[t.status] || statusConfig.todo;
              const StatusIcon = cfg.icon;
              return (
                <div key={t.id} className="flex items-start gap-2 text-sm py-1.5 border-b border-border/30 last:border-0">
                  <StatusIcon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${cfg.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-medium">{t.title}</span>
                      {t.priority === 'haute' && <Badge variant="destructive" className="text-[9px] px-1 shrink-0">Urgent</Badge>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-0.5">
                        <User className="h-2.5 w-2.5" />par {getUserName(t.user_id)}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <ArrowRight className="h-2.5 w-2.5" />{getUserName(t.assigned_to)}
                      </span>
                      <Badge variant="outline" className="text-[9px] px-1 py-0">{cfg.label}</Badge>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-2">Aucune tâche active</p>
        )}
      </CardContent>
    </Card>
  );
}
