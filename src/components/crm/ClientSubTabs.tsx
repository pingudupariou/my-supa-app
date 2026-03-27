import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Users, UserX, UserSearch } from 'lucide-react';
import { B2BClientTable } from '@/components/b2b/B2BClientTable';
import { useCRMData } from '@/hooks/useCRMData';
import { useColumnPermissions } from '@/hooks/useColumnPermissions';
import { useAuth } from '@/context/AuthContext';

const CLIENT_STATUSES = [
  { value: 'all', label: 'Tous les clients', icon: Users },
  { value: 'active', label: 'Actifs', icon: Users },
  { value: 'inactive', label: 'Inactifs', icon: UserX },
  { value: 'prospect', label: 'Prospects', icon: UserSearch },
] as const;

interface ClientSubTabsProps {
  b2b: ReturnType<typeof import('@/hooks/useB2BClientsData').useB2BClientsData>;
  crm: ReturnType<typeof useCRMData>;
  entityClientIds?: string[] | null;
  filteredMeetings?: ReturnType<typeof useCRMData>['meetings'];
  filteredReminders?: ReturnType<typeof useCRMData>['reminders'];
  filteredInteractions?: ReturnType<typeof useCRMData>['interactions'];
}

export function ClientSubTabs({ b2b, crm, entityClientIds, filteredMeetings, filteredReminders, filteredInteractions }: ClientSubTabsProps) {
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { isAdmin } = useAuth();
  const { isEditableByOthers, togglePermission } = useColumnPermissions();

  // Filter by entity first
  const entityFilteredClients = entityClientIds != null
    ? b2b.clients.filter(c => entityClientIds.includes(c.id))
    : b2b.clients;

  // Filter by status
  const statusFilteredClients = entityFilteredClients.filter(c => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'active') return c.is_active && c.client_type?.toLowerCase() !== 'prospect';
    if (statusFilter === 'inactive') return !c.is_active;
    if (statusFilter === 'prospect') return c.client_type?.toLowerCase() === 'prospect';
    return true;
  });

  // Count per status
  const counts = {
    all: entityFilteredClients.length,
    active: entityFilteredClients.filter(c => c.is_active && c.client_type?.toLowerCase() !== 'prospect').length,
    inactive: entityFilteredClients.filter(c => !c.is_active).length,
    prospect: entityFilteredClients.filter(c => c.client_type?.toLowerCase() === 'prospect').length,
  };

  const filterByCategory = (clients: typeof b2b.clients) => {
    if (categoryFilter === 'all') return clients;
    if (categoryFilter === 'none') return clients.filter(c => !c.category_id);
    return clients.filter(c => c.category_id === categoryFilter);
  };

  const displayedClients = filterByCategory(statusFilteredClients);

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
    meetings: filteredMeetings ?? crm.meetings,
    reminders: filteredReminders ?? crm.reminders,
    interactions: filteredInteractions ?? crm.interactions,
    isAdmin,
    isColumnEditableByOthers: isEditableByOthers,
    onToggleColumnPermission: togglePermission,
  };

  return (
    <div className="space-y-4">
      {/* Info when entity filter is active */}
      {entityClientIds != null && (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {entityFilteredClients.length} client(s) associé(s) à cette entité
          </Badge>
        </div>
      )}

      {/* Filters row */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Status filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Statut :</span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CLIENT_STATUSES.map(s => (
                <SelectItem key={s.value} value={s.value}>
                  <div className="flex items-center gap-2">
                    <s.icon className="h-3.5 w-3.5" />
                    {s.label}
                    <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-1">
                      {counts[s.value as keyof typeof counts]}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Category filter */}
        <div className="flex items-center gap-2">
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
        </div>

        {/* Reset filters */}
        {(statusFilter !== 'all' || categoryFilter !== 'all') && (
          <Badge
            variant="secondary"
            className="text-xs cursor-pointer"
            onClick={() => { setStatusFilter('all'); setCategoryFilter('all'); }}
          >
            ✕ Réinitialiser
          </Badge>
        )}
      </div>

      {/* Result count */}
      <p className="text-xs text-muted-foreground">
        {displayedClients.length} client{displayedClients.length !== 1 ? 's' : ''} affiché{displayedClients.length !== 1 ? 's' : ''}
      </p>

      {/* Table */}
      {displayedClients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <UserX className="h-12 w-12 mb-4 opacity-30" />
          <p>Aucun client trouvé avec ces filtres</p>
        </div>
      ) : (
        <B2BClientTable
          {...tableProps}
          clients={displayedClients}
        />
      )}
    </div>
  );
}
