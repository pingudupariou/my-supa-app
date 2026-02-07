import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Customer {
  id: string;
  company_name: string;
  contact_name: string | null;
  status: string;
  pricing_tier: string;
  city: string | null;
}

interface CustomerListProps {
  customers: Customer[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRefresh: () => void;
}

export function CustomerList({ customers, selectedId, onSelect, onRefresh }: CustomerListProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Clients</CardTitle>
          <Button size="sm" variant="ghost" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {customers.length === 0 && <p className="text-sm text-muted-foreground">Aucun client</p>}
        {customers.map(c => (
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
              {c.city && <span>{c.city}</span>}
              <Badge variant="outline" className="text-[10px]">{c.pricing_tier}</Badge>
            </div>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
