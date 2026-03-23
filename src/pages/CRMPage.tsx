import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClientSubTabs } from '@/components/crm/ClientSubTabs';
import { Card, CardContent } from '@/components/ui/card';
import { KPICard } from '@/components/ui/KPICard';
import { Users, Kanban, Bell, Trash2, ClipboardList, BarChart3, Building2, FolderOpen, Database } from 'lucide-react';
import { CustomerList } from '@/components/crm/CustomerList';
import { CustomerDetail } from '@/components/crm/CustomerDetail';
import { PipelineKanban } from '@/components/crm/PipelineKanban';
import { ReminderBanner } from '@/components/crm/ReminderBanner';
import { CrmReminderManager } from '@/components/crm/CrmReminderManager';
import { useB2BClientsData } from '@/hooks/useB2BClientsData';
import { BusinessEntitySelector } from '@/components/crm/BusinessEntitySelector';
import { BusinessEntityManager } from '@/components/crm/BusinessEntityManager';
import { useBusinessEntities } from '@/hooks/useBusinessEntities';
import { useEntityClients } from '@/hooks/useEntityClients';
import { EntityClientAssociator } from '@/components/crm/EntityClientAssociator';

import { B2BTrashBin } from '@/components/b2b/B2BTrashBin';
import { CrmAnalyticsDashboard } from '@/components/crm/CrmAnalyticsDashboard';
import { useCRMData } from '@/hooks/useCRMData';
import { useAuth } from '@/context/AuthContext';
import { useTasksData } from '@/hooks/useTasksData';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { TaskManager } from '@/components/tasks/TaskManager';
import { TaskBanner } from '@/components/tasks/TaskBanner';
import { Button } from '@/components/ui/button';
import { Link2 } from 'lucide-react';

export function CRMPage() {
  const b2b = useB2BClientsData();
  const crm = useCRMData();
  const { user, isAdmin } = useAuth();
  const tasksData = useTasksData();
  const { members } = useTeamMembers();
  const bizEntities = useBusinessEntities();
  const entityClients = useEntityClients();
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [showAssociator, setShowAssociator] = useState(false);

  const entityId = bizEntities.selectedEntityId;
  const filterByEntity = entityId && entityId !== 'all';

  // Entity-filtered client IDs
  const entityClientIds = filterByEntity
    ? entityClients.getClientIdsForEntity(entityId)
    : null;

  // Entity-filtered clients for KPIs
  const visibleClients = entityClientIds != null
    ? b2b.clients.filter(c => entityClientIds.includes(c.id))
    : b2b.clients;

  const totalClients = visibleClients.length;
  const activeClients = visibleClients.filter(c => c.is_active).length;
  const currentYear = new Date().getFullYear();
  const totalCA = b2b.projections
    .filter(p => p.year === currentYear && (!entityClientIds || entityClientIds.includes(p.client_id)))
    .reduce((sum, p) => sum + Number(p.projected_revenue || 0), 0);

  const selectedClient = b2b.clients.find(c => c.id === selectedClientId);

  const pipelineValue = crm.opportunities
    .filter(o => !['won', 'lost'].includes(o.stage))
    .reduce((s, o) => s + (o.estimated_amount || 0), 0);

  const filteredMeetings = filterByEntity
    ? crm.meetings.filter(m => m.business_entity_id === entityId)
    : crm.meetings;

  const filteredInteractions = filterByEntity
    ? crm.interactions.filter(i => i.business_entity_id === entityId)
    : crm.interactions;

  const filteredReminders = filterByEntity
    ? crm.reminders.filter(r => r.business_entity_id === entityId)
    : crm.reminders;

  const pendingReminders = filteredReminders.filter(r => !r.is_completed).length;
  const today = new Date().toISOString().slice(0, 10);
  const overdueReminders = filteredReminders.filter(r => !r.is_completed && r.due_date < today).length;

  const customersForSelect = b2b.clients.map(c => ({ id: c.id, company_name: c.company_name }));

  // Wrapped create functions that inject business_entity_id
  const createMeetingWithEntity = async (meeting: any) => {
    return crm.createMeeting({
      ...meeting,
      business_entity_id: filterByEntity ? entityId : null,
    });
  };

  const createInteractionWithEntity = async (interaction: any) => {
    return crm.createInteraction({
      ...interaction,
      business_entity_id: filterByEntity ? entityId : null,
    });
  };

  const createReminderWithEntity = async (reminder: any) => {
    return crm.createReminder({
      ...reminder,
      business_entity_id: filterByEntity ? entityId : null,
    });
  };

  // Clients list for fiches tab - filtered by entity
  const fichesClients = entityClientIds != null
    ? b2b.clients.filter(c => entityClientIds.includes(c.id))
    : b2b.clients;

  if (b2b.isLoading && crm.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">CRM — Clients</h1>
          <p className="text-muted-foreground">
            Gestion des clients, pipeline commercial, suivi des RDV et rappels
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Entity selector */}
          {bizEntities.entities.length > 0 && (
            <BusinessEntitySelector
              entities={bizEntities.entities}
              selectedId={bizEntities.selectedEntityId}
              onSelect={bizEntities.setSelectedEntityId}
            />
          )}
          {/* Associate clients button (admin, when entity selected) */}
          {isAdmin && filterByEntity && bizEntities.selectedEntity && (
            <Button size="sm" variant="outline" onClick={() => setShowAssociator(true)}>
              <Link2 className="h-3.5 w-3.5 mr-1.5" />
              Associer clients
            </Button>
          )}
        </div>
      </div>

      {/* Banners */}
      <ReminderBanner reminders={filteredReminders} customers={customersForSelect} />
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
          <TabsTrigger value="analytics">
            <BarChart3 className="h-4 w-4 mr-2" />
            Analyse
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="entities">
              <Building2 className="h-4 w-4 mr-2" />
              Entités
            </TabsTrigger>
          )}
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

        {/* B2B Client Table - filtered by entity */}
        <TabsContent value="clients">
          <ClientSubTabs b2b={b2b} crm={crm} entityClientIds={entityClientIds} filteredMeetings={filteredMeetings} filteredReminders={filteredReminders} filteredInteractions={filteredInteractions} />
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
                clients={fichesClients}
                selectedId={selectedClientId}
                onSelect={setSelectedClientId}
                onRefresh={b2b.refreshData}
                meetings={filteredMeetings}
              />
            </div>
            <div className="lg:col-span-2">
              {selectedClient ? (
                <CustomerDetail
                  client={selectedClient}
                  interactions={filteredInteractions.filter(i => i.customer_id === selectedClient.id)}
                  opportunities={crm.getCustomerOpportunities(selectedClient.id)}
                  meetings={filteredMeetings.filter(m => m.customer_id === selectedClient.id)}
                  reminders={filteredReminders.filter(r => r.customer_id === selectedClient.id)}
                  onCreateInteraction={createInteractionWithEntity}
                  onCreateMeeting={createMeetingWithEntity}
                  onUpdateMeeting={crm.updateMeeting}
                  onDeleteMeeting={crm.deleteMeeting}
                  onRestoreMeeting={crm.restoreMeeting}
                  onPermanentDeleteMeeting={crm.permanentDeleteMeeting}
                  getTrashedMeetings={crm.getTrashedMeetings}
                  onCreateReminder={createReminderWithEntity}
                  onCompleteReminder={crm.completeReminder}
                  onUncompleteReminder={crm.uncompleteReminder}
                  onDeleteReminder={crm.deleteReminder}
                  isAdmin={isAdmin}
                  selectedEntityName={bizEntities.selectedEntity?.name}
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
                reminders={filteredReminders}
                customers={customersForSelect}
                onCreate={createReminderWithEntity}
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

        {/* Analytics */}
        <TabsContent value="analytics" className="space-y-4">
          <CrmAnalyticsDashboard
            clients={visibleClients}
            projections={b2b.projections}
            categories={b2b.categories}
            interactions={filteredInteractions}
            meetings={filteredMeetings}
          />
        </TabsContent>

        {/* Business Entities management (admin only) */}
        <TabsContent value="entities" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <BusinessEntityManager
                entities={bizEntities.entities}
                onCreate={bizEntities.createEntity}
                onUpdate={bizEntities.updateEntity}
                onDelete={bizEntities.deleteEntity}
                onSetDefault={bizEntities.setDefault}
                isAdmin={isAdmin}
                allClients={b2b.clients}
                entityClients={entityClients}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="corbeille" className="space-y-4">
          <B2BTrashBin
            trashedClients={b2b.trashedClients}
            onRestore={b2b.restoreClient}
            onPermanentDelete={b2b.permanentDeleteClient}
            isAdmin={isAdmin}
          />
        </TabsContent>
      </Tabs>

      {/* Entity Client Associator Dialog */}
      {bizEntities.selectedEntity && (
        <EntityClientAssociator
          open={showAssociator}
          onOpenChange={setShowAssociator}
          entity={bizEntities.selectedEntity}
          allClients={b2b.clients}
          associatedClientIds={entityClientIds || []}
          onToggle={entityClients.toggleClientEntity}
        />
      )}
    </div>
  );
}
