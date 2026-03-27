import { useState, useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Users, UserX, UserSearch } from 'lucide-react';
import { B2BClientTable } from '@/components/b2b/B2BClientTable';
import { useCRMData } from '@/hooks/useCRMData';
import { useColumnPermissions } from '@/hooks/useColumnPermissions';
import { useAuth } from '@/context/AuthContext';

type StatusKey = 'all' | 'active' | 'inactive' | 'prospect';

const CLIENT_STATUSES: { value: StatusKey; label: string; icon: any; dot: string }[] = [
  { value: 'all', label: 'Tous les clients', icon: Users, dot: '' },
  { value: 'active', label: 'Actifs', icon: Users, dot: 'bg-emerald-500' },
  { value: 'inactive', label: 'Inactifs', icon: UserX, dot: 'bg-muted-foreground' },
  { value: 'prospect', label: 'Prospects', icon: UserSearch, dot: 'bg-blue-500' },
];

function getClientStatus(c: { is_active: boolean; client_type?: string | null }): 'active' | 'inactive' | 'prospect' {
  if (c.client_type?.toLowerCase() === 'prospect') return 'prospect';
  return c.is_active ? 'active' : 'inactive';
}

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
  const [statusFilter, setStatusFilter] = useState<StatusKey>('all');
  const { isAdmin } = useAuth();
  const { isEditableByOthers, togglePermission } = useColumnPermissions();

  // Filter by entity first
  const entityFilteredClients = entityClientIds != null
    ? b2b.clients.filter(c => entityClientIds.includes(c.id))
    : b2b.clients;

  // Apply category filter
  const catFiltered = useMemo(() => {
    if (categoryFilter === 'all') return entityFilteredClients;
    if (categoryFilter === 'none') return entityFilteredClients.filter(c => !c.category_id);
    return entityFilteredClients.filter(c => c.category_id === categoryFilter);
  }, [entityFilteredClients, categoryFilter]);

  // Apply status filter
  const displayed = useMemo(() => {
    if (statusFilter === 'all') return catFiltered;
    return catFiltered.filter(c => getClientStatus(c) === statusFilter);
  }, [catFiltered, statusFilter]);

  // Cross-filtered counts: status counts respect category, category counts respect status
  const statusCounts = useMemo(() => ({
    all: catFiltered.length,
    active: catFiltered.filter(c => getClientStatus(c) === 'active').length,
    inactive: catFiltered.filter(c => getClientStatus(c) === 'inactive').length,
    prospect: catFiltered.filter(c => getClientStatus(c) === 'prospect').length,
  }), [catFiltered]);

  // Category summary chips (show status breakdown per selected category)
  const selectedCatLabel = categoryFilter === 'all'
    ? null
    : categoryFilter === 'none'
      ? 'Sans catégorie'
      : b2b.categories.find(c => c.id === categoryFilter)?.name;

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
      {entityClientIds != null && (
        <Badge variant="outline" className="text-xs">
          {entityFilteredClients.length} client(s) associé(s) à cette entité
        </Badge>
      )}

      {/* Filters row */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Status filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Statut :</span>
          <Select value={statusFilter} onValueChange={v => setStatusFilter(v as StatusKey)}>
            <SelectTrigger className="w-[190px] h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CLIENT_STATUSES.map(s => (
                <SelectItem key={s.value} value={s.value}>
                  <div className="flex items-center gap-2">
                    {s.dot && <span className={`h-2 w-2 rounded-full shrink-0 ${s.dot}`} />}
                    {s.label}
                    <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-auto">
                      {statusCounts[s.value]}
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
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color || '#6366f1' }} />
                    {cat.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Reset */}
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

      {/* Status summary chips when a category is selected */}
      {selectedCatLabel && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">{selectedCatLabel} :</span>
          {CLIENT_STATUSES.filter(s => s.value !== 'all').map(s => (
            <Badge
              key={s.value}
              variant={statusFilter === s.value ? 'default' : 'outline'}
              className="text-[11px] cursor-pointer gap-1.5 transition-colors"
              onClick={() => setStatusFilter(statusFilter === s.value ? 'all' : s.value)}
            >
              {s.dot && <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />}
              {s.label} ({statusCounts[s.value]})
            </Badge>
          ))}
        </div>
      )}

      {/* Result count */}
      <p className="text-xs text-muted-foreground">
        {displayed.length} client{displayed.length !== 1 ? 's' : ''} affiché{displayed.length !== 1 ? 's' : ''}
      </p>

      {/* Table */}
      {displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <UserX className="h-12 w-12 mb-4 opacity-30" />
          <p>Aucun client trouvé avec ces filtres</p>
        </div>
      ) : (
        <B2BClientTable
          {...tableProps}
          clients={displayed}
        />
      )}
    </div>
  );
}
