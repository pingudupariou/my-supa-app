import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Users, UserX } from 'lucide-react';
import { B2BClientTable } from '@/components/b2b/B2BClientTable';
import { useCRMData } from '@/hooks/useCRMData';

interface ClientSubTabsProps {
  b2b: ReturnType<typeof import('@/hooks/useB2BClientsData').useB2BClientsData>;
  crm: ReturnType<typeof useCRMData>;
}

export function ClientSubTabs({ b2b, crm }: ClientSubTabsProps) {
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const activeClients = b2b.clients.filter(c => c.is_active);
  const inactiveClients = b2b.clients.filter(c => !c.is_active);

  const filterByCategory = (clients: typeof b2b.clients) => {
    if (categoryFilter === 'all') return clients;
    if (categoryFilter === 'none') return clients.filter(c => !c.category_id);
    return clients.filter(c => c.category_id === categoryFilter);
  };

  const tableProps = {
    projections: b2b.projections,
    deliveryFeeTiers: b2b.deliveryFeeTiers,
    paymentTermsOptions: b2b.paymentTermsOptions,
    deliveryMethods: b2b.deliveryMethods,
    categories: b2b.categories,
    onUpsertClient: b2b.upsertClient,
    onDeleteClient: b2b.deleteClient,
    onBulkImport: b2b.bulkImportClients,
    onUpsertProjection: b2b.upsertProjection,
    getClientProjections: b2b.getClientProjections,
    onAddDeliveryFee: b2b.addDeliveryFeeTier,
    onDeleteDeliveryFee: b2b.deleteDeliveryFeeTier,
    onAddPaymentTerm: b2b.addPaymentTerm,
    onDeletePaymentTerm: b2b.deletePaymentTerm,
    onAddDeliveryMethod: b2b.addDeliveryMethod,
    onDeleteDeliveryMethod: b2b.deleteDeliveryMethod,
    onAddCategory: b2b.addCategory,
    onDeleteCategory: b2b.deleteCategory,
    onUpdateCategory: b2b.updateCategory,
    meetings: crm.meetings,
    reminders: crm.reminders,
    interactions: crm.interactions,
  };

  return (
    <div className="space-y-4">
      {/* Category filter */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">Catégorie :</span>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[200px] h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les catégories</SelectItem>
            <SelectItem value="none">Sans catégorie</SelectItem>
            {b2b.categories.map(cat => (
              <SelectItem key={cat.id} value={cat.id}>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color || '#6366f1' }} />
                  {cat.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {categoryFilter !== 'all' && (
          <Badge variant="secondary" className="text-xs cursor-pointer" onClick={() => setCategoryFilter('all')}>
            ✕ Réinitialiser
          </Badge>
        )}
      </div>

      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active" className="gap-2">
            <Users className="h-4 w-4" />
            Actifs
            <Badge variant="default" className="text-[10px] px-1.5 py-0 ml-1">{filterByCategory(activeClients).length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="inactive" className="gap-2">
            <UserX className="h-4 w-4" />
            Inactifs
            {filterByCategory(inactiveClients).length > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">{filterByCategory(inactiveClients).length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <B2BClientTable
            {...tableProps}
            clients={filterByCategory(activeClients)}
          />
        </TabsContent>

        <TabsContent value="inactive">
          {filterByCategory(inactiveClients).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <UserX className="h-12 w-12 mb-4 opacity-30" />
              <p>Aucun client inactif{categoryFilter !== 'all' ? ' dans cette catégorie' : ''}</p>
            </div>
          ) : (
            <B2BClientTable
              {...tableProps}
              clients={filterByCategory(inactiveClients)}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
