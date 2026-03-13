import { useTasksData } from '@/hooks/useTasksData';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { useB2BClientsData } from '@/hooks/useB2BClientsData';
import { useAuth } from '@/context/AuthContext';
import { TaskManager } from '@/components/tasks/TaskManager';
import { TaskBanner } from '@/components/tasks/TaskBanner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KPICard } from '@/components/ui/KPICard';
import { ClipboardList, User, Users } from 'lucide-react';

export function TasksPage() {
  const { user } = useAuth();
  const tasksData = useTasksData();
  const { members } = useTeamMembers();
  const b2b = useB2BClientsData();

  const customers = b2b.clients.map(c => ({ id: c.id, company_name: c.company_name }));
  const myTasks = tasksData.tasks.filter(t => t.assigned_to === user?.id || t.user_id === user?.id);
  const allActive = tasksData.tasks.filter(t => t.status !== 'done');
  const today = new Date().toISOString().slice(0, 10);
  const overdue = myTasks.filter(t => t.status !== 'done' && t.due_date && t.due_date < today).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Tâches</h1>
        <p className="text-muted-foreground">Gestion et suivi des tâches de l'équipe</p>
      </div>

      <TaskBanner tasks={tasksData.tasks} currentUserId={user?.id} />

      <div className="grid gap-4 md:grid-cols-4">
        <KPICard label="Mes tâches actives" value={myTasks.filter(t => t.status !== 'done').length} />
        <KPICard label="En retard" value={overdue} trend={overdue > 0 ? 'down' : 'neutral'} />
        <KPICard label="Tâches équipe" value={allActive.length} />
        <KPICard label="Notifications" value={tasksData.unreadCount} trend={tasksData.unreadCount > 0 ? 'down' : 'neutral'} />
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all"><Users className="h-4 w-4 mr-2" />Les tâches</TabsTrigger>
          <TabsTrigger value="my"><User className="h-4 w-4 mr-2" />Mes tâches</TabsTrigger>
        </TabsList>

        <TabsContent value="my" className="mt-4">
          <TaskManager
            tasks={myTasks}
            history={tasksData.history}
            users={members}
            customers={customers}
            onCreateTask={tasksData.createTask}
            onUpdateTask={tasksData.updateTask}
            onDeleteTask={tasksData.deleteTask}
            getTaskHistory={tasksData.getTaskHistory}
          />
        </TabsContent>

        <TabsContent value="all" className="mt-4">
          <TaskManager
            tasks={tasksData.tasks}
            history={tasksData.history}
            users={members}
            customers={customers}
            onCreateTask={tasksData.createTask}
            onUpdateTask={tasksData.updateTask}
            onDeleteTask={tasksData.deleteTask}
            getTaskHistory={tasksData.getTaskHistory}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
