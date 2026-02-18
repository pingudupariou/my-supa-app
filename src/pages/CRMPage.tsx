import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { KPICard } from '@/components/ui/KPICard';
import { Users, Kanban } from 'lucide-react';
import { CustomerList } from '@/components/crm/CustomerList';
import { CustomerDetail } from '@/components/crm/CustomerDetail';
import { PipelineKanban } from '@/components/crm/PipelineKanban';
import { useB2BClientsData } from '@/hooks/useB2BClientsData';
import { B2BClientTable } from '@/components/b2b/B2BClientTable';
import { useCRMData } from '@/hooks/useCRMData';

export function CRMPage() {
  const b2b = useB2BClientsData();
  const crm = useCRMData();
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
          Gestion des clients, pipeline commercial et suivi des interactions
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <KPICard label="Total Clients" value={totalClients} />
        <KPICard label="Clients Actifs" value={activeClients} trend={activeClients > 0 ? 'up' : 'neutral'} />
        <KPICard label={`CA ${currentYear}`} value={`${(totalCA / 1000).toFixed(0)} k€`} />
        <KPICard label="Catégories" value={b2b.categories.length} />
        <KPICard label="Pipeline" value={`${(pipelineValue / 1000).toFixed(0)} k€`} />
      </div>

      <Tabs defaultValue="clients" className="space-y-4">
        <TabsList>
          <TabsTrigger value="clients">
            <Users className="h-4 w-4 mr-2" />
            Clients B2B
          </TabsTrigger>
          <TabsTrigger value="pipeline">
            <Kanban className="h-4 w-4 mr-2" />
            Pipeline
          </TabsTrigger>
          <TabsTrigger value="fiches">
            <Users className="h-4 w-4 mr-2" />
            Fiches Clients
          </TabsTrigger>
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
          />
        </TabsContent>

        {/* Pipeline Kanban — uses b2b_clients for customer list */}
        <TabsContent value="pipeline">
          <PipelineKanban
            opportunities={crm.opportunities}
            customers={b2b.clients.map(c => ({ id: c.id, company_name: c.company_name }))}
            onCreateOpportunity={crm.createOpportunity}
            onUpdateOpportunity={crm.updateOpportunity}
            onDeleteOpportunity={crm.deleteOpportunity}
          />
        </TabsContent>

        {/* Customer Detail with interactions — linked to B2B clients */}
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
                  onCreateInteraction={crm.createInteraction}
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
      </Tabs>
    </div>
  );
}
