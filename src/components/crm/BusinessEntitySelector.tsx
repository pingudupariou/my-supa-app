import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2 } from 'lucide-react';
import { BusinessEntity } from '@/hooks/useBusinessEntities';

interface BusinessEntitySelectorProps {
  entities: BusinessEntity[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  showAll?: boolean;
}

export function BusinessEntitySelector({ entities, selectedId, onSelect, showAll = true }: BusinessEntitySelectorProps) {
  if (entities.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
      <Select value={selectedId || 'all'} onValueChange={v => onSelect(v)}>
        <SelectTrigger className="h-8 text-sm w-auto min-w-[160px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {showAll && <SelectItem value="all">Toutes les entités</SelectItem>}
          {entities.map(e => (
            <SelectItem key={e.id} value={e.id}>
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                {e.name}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
