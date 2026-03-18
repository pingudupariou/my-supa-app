import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Search, Link2, Users } from 'lucide-react';
import { B2BClient } from '@/hooks/useB2BClientsData';
import { BusinessEntity } from '@/hooks/useBusinessEntities';

interface EntityClientAssociatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entity: BusinessEntity;
  allClients: B2BClient[];
  associatedClientIds: string[];
  onToggle: (entityId: string, clientId: string) => Promise<boolean>;
}

export function EntityClientAssociator({
  open,
  onOpenChange,
  entity,
  allClients,
  associatedClientIds,
  onToggle,
}: EntityClientAssociatorProps) {
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allClients.filter(c =>
      c.company_name.toLowerCase().includes(q) ||
      (c.country || '').toLowerCase().includes(q)
    );
  }, [allClients, search]);

  const handleToggle = async (clientId: string) => {
    setLoading(clientId);
    await onToggle(entity.id, clientId);
    setLoading(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: entity.color }} />
            Associer des clients à {entity.name}
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Rechercher un client..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          {associatedClientIds.length} client(s) associé(s) sur {allClients.length}
        </div>

        <div className="flex-1 overflow-y-auto space-y-0.5 max-h-[400px] pr-1">
          {filtered.map(client => {
            const isAssociated = associatedClientIds.includes(client.id);
            return (
              <button
                key={client.id}
                onClick={() => handleToggle(client.id)}
                disabled={loading === client.id}
                className="w-full flex items-center gap-3 p-2.5 rounded-lg text-left hover:bg-muted/50 transition-colors"
              >
                <Checkbox
                  checked={isAssociated}
                  className="pointer-events-none"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{client.company_name}</div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                    {client.country && <span>{client.country}</span>}
                    <Badge variant={client.is_active ? 'default' : 'secondary'} className="text-[9px] px-1 py-0">
                      {client.is_active ? 'Actif' : 'Inactif'}
                    </Badge>
                  </div>
                </div>
                {loading === client.id && (
                  <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                )}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">Aucun client trouvé</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
