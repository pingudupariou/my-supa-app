import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCw, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { B2BClient } from '@/hooks/useB2BClientsData';

interface CustomerListProps {
  clients: B2BClient[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRefresh: () => void;
}

export function CustomerList({ clients, selectedId, onSelect, onRefresh }: CustomerListProps) {
  const [search, setSearch] = useState('');

  const filtered = clients.filter(c =>
    c.company_name.toLowerCase().includes(search.toLowerCase()) ||
    (c.contact_email || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.country || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Clients B2B</CardTitle>
          <Button size="sm" variant="ghost" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <div className="relative mt-2">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-1 max-h-[500px] overflow-y-auto">
        {filtered.length === 0 && <p className="text-sm text-muted-foreground">Aucun client</p>}
        {filtered.map(c => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={cn(
              'w-full text-left p-3 rounded-lg transition-colors',
              selectedId === c.id ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted/50'
            )}
          >
            <div className="font-medium text-sm">{c.company_name}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              {c.country && <span>{c.country}</span>}
              <Badge variant={c.is_active ? 'default' : 'secondary'} className="text-[10px]">
                {c.is_active ? 'Actif' : 'Inactif'}
              </Badge>
            </div>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
