import { Users } from 'lucide-react';
import { KPICard } from '@/components/ui/KPICard';
import { B2BClientTable } from '@/components/b2b/B2BClientTable';
import { useB2BClientsData } from '@/hooks/useB2BClientsData';

export function CRMPage() {
  const b2b = useB2BClientsData();

  const totalClients = b2b.clients.length;
  const activeClients = b2b.clients.filter(c => c.is_active).length;

  // Sum all projections for current year
  const currentYear = new Date().getFullYear();
  const totalCA = b2b.projections
    .filter(p => p.year === currentYear)
    .reduce((sum, p) => sum + Number(p.projected_revenue || 0), 0);

  if (b2b.isLoading) {
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
          Gestion des clients, catégories et suivi commercial
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <KPICard label="Total Clients" value={totalClients} />
        <KPICard label="Clients Actifs" value={activeClients} trend={activeClients > 0 ? 'up' : 'neutral'} />
        <KPICard label={`CA ${currentYear}`} value={`${(totalCA / 1000).toFixed(0)} k€`} />
        <KPICard label="Catégories" value={b2b.categories.length} />
      </div>

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
    </div>
  );
}
