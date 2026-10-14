import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search } from 'lucide-react';
import type { ErplainVariantRow } from './useErplainCatalog';

export function ErplainStock({ variants }: { variants: ErplainVariantRow[] }) {
  const [search, setSearch] = useState('');
  const [onlyLow, setOnlyLow] = useState(false);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return variants
      .filter(v => v.locations.length > 0)
      .filter(v => !onlyLow || v.available <= 0)
      .filter(v => !q || `${v.sku ?? ''} ${v.label ?? ''}`.toLowerCase().includes(q))
      .sort((a, b) => (a.label ?? '').localeCompare(b.label ?? ''))
      .slice(0, 500);
  }, [variants, search, onlyLow]);

  return (
    <div className="space-y-4" data-readonly-allow="true">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher SKU ou nom..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button variant={onlyLow ? 'default' : 'outline'} size="sm" onClick={() => setOnlyLow(!onlyLow)}>Disponible ≤ 0</Button>
        <span className="text-xs text-muted-foreground">{rows.length} affichés (max 500)</span>
      </div>
      <div className="border rounded overflow-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Variante</TableHead><TableHead>SKU</TableHead><TableHead>Emplacements</TableHead>
            <TableHead className="text-right">Réel</TableHead><TableHead className="text-right">Disponible</TableHead>
            <TableHead className="text-right">Réservé</TableHead><TableHead className="text-right">À venir</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Aucun stock Erplain importé.</TableCell></TableRow>}
            {rows.map(v => (
              <TableRow key={v.id}>
                <TableCell className="font-medium">{v.label ?? '—'}</TableCell>
                <TableCell className="font-mono text-xs">{v.sku ?? '—'}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{v.locations.map(l => l.label).filter(Boolean).join(', ') || '—'}</TableCell>
                <TableCell className="text-right font-mono-numbers">{v.on_hand}</TableCell>
                <TableCell className={`text-right font-mono-numbers font-medium ${v.available <= 0 ? 'negative-value' : ''}`}>{v.available}</TableCell>
                <TableCell className="text-right font-mono-numbers">{v.reserved}</TableCell>
                <TableCell className="text-right font-mono-numbers">{v.incoming}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
