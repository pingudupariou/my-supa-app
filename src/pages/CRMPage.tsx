import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClientSubTabs } from '@/components/crm/ClientSubTabs';
import { Card, CardContent } from '@/components/ui/card';
import { KPICard } from '@/components/ui/KPICard';
import { Users, Kanban, Bell, Calendar, Trash2, ClipboardList } from 'lucide-react';
import { CustomerList } from '@/components/crm/CustomerList';
import { CustomerDetail } from '@/components/crm/CustomerDetail';
import { PipelineKanban } from '@/components/crm/PipelineKanban';
import { ReminderBanner } from '@/components/crm/ReminderBanner';
import { CrmReminderManager } from '@/components/crm/CrmReminderManager';
import { useB2BClientsData } from '@/hooks/useB2BClientsData';
import { B2BClientTable } from '@/components/b2b/B2BClientTable';
import { B2BTrashBin } from '@/components/b2b/B2BTrashBin';
import { useCRMData } from '@/hooks/useCRMData';
import { useAuth } from '@/context/AuthContext';
import { useTasksData } from '@/hooks/useTasksData';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { TaskManager } from '@/components/tasks/TaskManager';
import { TaskBanner } from '@/components/tasks/TaskBanner';

export function CRMPage() {
  const b2b = useB2BClientsData();
  const crm = useCRMData();
  const { user, isAdmin } = useAuth();
  const tasksData = useTasksData();
  const { members } = useTeamMembers();
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const totalClients = b2b.clients.length;
  const activeClients = b2b.clients.filter(c => c.is_active).length;
  const currentYear = new Date().getFullYear();
  const totalCA = b2b.projections
    .filter(p => p.year === currentYear)
    .reduce((sum, p) => sum + Number(p.projected_revenue || 0), 0);

  const selectedClient = b2b.clients.find(c => c.id === selectedClientId);

  const pipelineValue = crm.opportunities
    .filter(o => !['won', 'lost'].includes(o.stage))
    .reduce((s, o) => s + (o.estimated_amount || 0), 0);

  const pendingReminders = crm.reminders.filter(r => !r.is_completed).length;
  const today = new Date().toISOString().slice(0, 10);
  const overdueReminders = crm.reminders.filter(r => !r.is_completed && r.due_date < today).length;

  const customersForSelect = b2b.clients.map(c => ({ id: c.id, company_name: c.company_name }));

  if (b2b.isLoading && crm.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">CRM — Clients</h1>
        <p className="text-muted-foreground">
          Gestion des clients, pipeline commercial, suivi des RDV et rappels
        </p>
      </div>

      {/* Banners */}
      <ReminderBanner reminders={crm.reminders} customers={customersForSelect} />
      <TaskBanner tasks={tasksData.tasks} currentUserId={user?.id} />

      <div className="grid gap-4 md:grid-cols-5">
        <KPICard label="Total Clients" value={totalClients} />
        <KPICard label="Clients Actifs" value={activeClients} trend={activeClients > 0 ? 'up' : 'neutral'} />
        <KPICard label={`CA ${currentYear}`} value={`${(totalCA / 1000).toFixed(0)} k€`} />
        <KPICard label="Pipeline" value={`${(pipelineValue / 1000).toFixed(0)} k€`} />
        <KPICard
          label="Rappels"
          value={`${pendingReminders}${overdueReminders > 0 ? ` (${overdueReminders} ⚠)` : ''}`}
          trend={overdueReminders > 0 ? 'down' : 'neutral'}
        />
      </div>

      <Tabs defaultValue="clients" className="space-y-4">
        <TabsList>
          <TabsTrigger value="clients">
            <Users className="h-4 w-4 mr-2" />
            Clients
          </TabsTrigger>
          <TabsTrigger value="pipeline">
            <Kanban className="h-4 w-4 mr-2" />
            Pipeline
          </TabsTrigger>
          <TabsTrigger value="fiches">
            <Users className="h-4 w-4 mr-2" />
            Fiches Clients
          </TabsTrigger>
          <TabsTrigger value="suivi">
            <Bell className="h-4 w-4 mr-2" />
            Suivi & Rappels
            {pendingReminders > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                {pendingReminders}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="tasks">
            <ClipboardList className="h-4 w-4 mr-2" />
            Tâches
            {tasksData.tasks.filter(t => t.context === 'crm' && t.status !== 'done').length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                {tasksData.tasks.filter(t => t.context === 'crm' && t.status !== 'done').length}
              </span>
            )}
          </TabsTrigger>
          {b2b.trashedClients.length > 0 && (
            <TabsTrigger value="corbeille">
              <Trash2 className="h-4 w-4 mr-2" />
              Corbeille
              <span className="ml-1.5 inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-muted text-muted-foreground text-[10px] font-bold">
                {b2b.trashedClients.length}
              </span>
            </TabsTrigger>
          )}
        </TabsList>

        {/* B2B Client Table (existing) */}
        <TabsContent value="clients">
          <B2BClientTable
            clients={b2b.clients}
            projections={b2b.projections}
            deliveryFeeTiers={b2b.deliveryFeeTiers}
            paymentTermsOptions={b2b.paymentTermsOptions}
            deliveryMethods={b2b.deliveryMethods}
            categories={b2b.categories}
            onUpsertClient={b2b.upsertClient}
            onDeleteClient={b2b.deleteClient}
            onBulkImport={b2b.bulkImportClients}
            onUpsertProjection={b2b.upsertProjection}
            getClientProjections={b2b.getClientProjections}
            onAddDeliveryFee={b2b.addDeliveryFeeTier}
            onDeleteDeliveryFee={b2b.deleteDeliveryFeeTier}
            onAddPaymentTerm={b2b.addPaymentTerm}
            onDeletePaymentTerm={b2b.deletePaymentTerm}
            onAddDeliveryMethod={b2b.addDeliveryMethod}
            onDeleteDeliveryMethod={b2b.deleteDeliveryMethod}
            onAddCategory={b2b.addCategory}
            onDeleteCategory={b2b.deleteCategory}
            onUpdateCategory={b2b.updateCategory}
            meetings={crm.meetings}
            reminders={crm.reminders}
            interactions={crm.interactions}
          />
        </TabsContent>

        {/* Pipeline Kanban */}
        <TabsContent value="pipeline">
          <PipelineKanban
            opportunities={crm.opportunities}
            customers={customersForSelect}
            onCreateOpportunity={crm.createOpportunity}
            onUpdateOpportunity={crm.updateOpportunity}
            onDeleteOpportunity={crm.deleteOpportunity}
          />
        </TabsContent>

        {/* Customer Detail with interactions, meetings, reminders */}
        <TabsContent value="fiches" className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <CustomerList
                clients={b2b.clients}
                selectedId={selectedClientId}
                onSelect={setSelectedClientId}
                onRefresh={b2b.refreshData}
              />
            </div>
            <div className="lg:col-span-2">
              {selectedClient ? (
                <CustomerDetail
                  client={selectedClient}
                  interactions={crm.getCustomerInteractions(selectedClient.id)}
                  opportunities={crm.getCustomerOpportunities(selectedClient.id)}
                  meetings={crm.getCustomerMeetings(selectedClient.id)}
                  reminders={crm.getCustomerReminders(selectedClient.id)}
                  onCreateInteraction={crm.createInteraction}
                  onCreateMeeting={crm.createMeeting}
                  onUpdateMeeting={crm.updateMeeting}
                  onDeleteMeeting={crm.deleteMeeting}
                  onRestoreMeeting={crm.restoreMeeting}
                  getTrashedMeetings={crm.getTrashedMeetings}
                  onCreateReminder={crm.createReminder}
                  onCompleteReminder={crm.completeReminder}
                  onUncompleteReminder={crm.uncompleteReminder}
                  onDeleteReminder={crm.deleteReminder}
                />
              ) : (
                <Card className="h-full min-h-[400px] flex items-center justify-center">
                  <CardContent className="text-center text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>Sélectionnez un client pour voir ses détails</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Centralized Reminders tab */}
        <TabsContent value="suivi" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <CrmReminderManager
                reminders={crm.reminders}
                customers={customersForSelect}
                onCreate={crm.createReminder}
                onComplete={crm.completeReminder}
                onUncomplete={crm.uncompleteReminder}
                onDelete={crm.deleteReminder}
                showCustomerName
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tasks tab */}
        <TabsContent value="tasks" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <TaskManager
                tasks={tasksData.tasks.filter(t => t.context === 'crm')}
                history={tasksData.history}
                users={members}
                customers={customersForSelect}
                onCreateTask={(t) => tasksData.createTask({ ...t, context: 'crm' })}
                onUpdateTask={tasksData.updateTask}
                onDeleteTask={tasksData.deleteTask}
                getTaskHistory={tasksData.getTaskHistory}
                defaultContext="crm"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trash bin */}
        <TabsContent value="corbeille" className="space-y-4">
          <B2BTrashBin
            trashedClients={b2b.trashedClients}
            onRestore={b2b.restoreClient}
            onPermanentDelete={b2b.permanentDeleteClient}
            isAdmin={isAdmin}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
