import { Fragment, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import type { ErplainVariantRow, BomStatus } from './useErplainCatalog';
import { buildWhereUsed, type Edge } from './whereUsed';

export function ErplainWhereUsed({ variants, edges, bomStatus }: { variants: ErplainVariantRow[]; edges: Edge[]; bomStatus: BomStatus | null }) {
  const [search, setSearch] = useState('');
  const [unused, setUnused] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const byId = useMemo(() => new Map(variants.map(v => [v.id, v])), [variants]);
  const w = useMemo(() => buildWhereUsed(edges), [edges]);
  const name = (id: string) => { const v = byId.get(id); return v?.label || v?.sku || `Erplain #${id}`; };
  const reliable = !!bomStatus?.complete && !bomStatus.ambiguousParents;

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return variants
      .filter(v => !q || `${v.id} ${v.sku ?? ''} ${v.label ?? ''}`.toLowerCase().includes(q))
      .map(v => ({ v, usages: w.usagesOf(v.id), direct: w.directParents(v.id) }))
      .filter(r => (unused ? r.direct.length === 0 && !v_isFinished(r.v) : r.direct.length > 0))
      .sort((a, b) => b.usages.length - a.usages.length || (a.v.label ?? '').localeCompare(b.v.label ?? ''))
      .slice(0, 300);
    function v_isFinished(v: ErplainVariantRow) { return !!v.bom || v.bomCount > 0; }
  }, [variants, w, search, unused]);

  return (
    <div className="space-y-4" data-readonly-allow="true">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher ID Erplain, SKU ou nom..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button variant={unused ? 'default' : 'outline'} size="sm" onClick={() => setUnused(!unused)} disabled={!reliable && !unused}>
          {unused ? 'Non utilisées' : 'Références utilisées'}
        </Button>
        <span className="text-xs text-muted-foreground">{rows.length} affichées (max 300)</span>
      </div>
      {!reliable && (
        <p className="text-sm text-destructive flex gap-1 items-center"><AlertTriangle className="h-4 w-4" />
          {!bomStatus?.complete ? `Nomenclatures incomplètes (dernière lecture : ${bomStatus?.runStatus ?? 'aucune'}) : le filtre « Non utilisées » n'est pas fiable.` : `${bomStatus.ambiguousParents} produit(s) avec plusieurs nomenclatures sans défaut : leurs composants ne sont pas comptés, « Non utilisées » n'est pas fiable.`}
        </p>
      )}
      {unused && <p className="text-xs text-muted-foreground">Variantes présentes dans le stock Erplain, sans nomenclature propre et absentes de toute nomenclature retenue.</p>}
      <div className="border rounded overflow-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="w-6"></TableHead><TableHead>Référence / sous-ensemble</TableHead><TableHead>ID · SKU</TableHead>
            <TableHead className="text-right">Utilisateurs directs</TableHead><TableHead className="text-right">Produits finis</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Aucune référence.</TableCell></TableRow>}
            {rows.map(({ v, usages, direct }) => (
              <Fragment key={v.id}>
                <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => setOpen(open === v.id ? null : v.id)}>
                  <TableCell>{direct.length > 0 && (open === v.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />)}</TableCell>
                  <TableCell className="font-medium">{v.label ?? '—'} {(v.bom || v.bomCount > 0) && <Badge variant="secondary" className="ml-1">Sous-ensemble</Badge>}</TableCell>
                  <TableCell className="font-mono text-xs">#{v.id} · {v.sku ?? 'sans SKU'}</TableCell>
                  <TableCell className="text-right font-mono-numbers">{direct.length}</TableCell>
                  <TableCell className="text-right font-mono-numbers">{usages.length}</TableCell>
                </TableRow>
                {open === v.id && usages.map(u => (
                  <TableRow key={u.productId} className="text-xs bg-muted/30">
                    <TableCell></TableCell>
                    <TableCell colSpan={2}>
                      <span className="font-medium">{name(u.productId)}</span> <span className="font-mono text-muted-foreground">#{u.productId}</span>
                      {u.paths.filter(p => p.ids.length > 2).map((p, i) => (
                        <div key={i} className="text-muted-foreground">↳ {p.ids.map(name).join(' → ')} ({p.quantity})</div>
                      ))}
                    </TableCell>
                    <TableCell className="text-right">{u.direct ? 'direct' : 'indirect'}</TableCell>
                    <TableCell className="text-right font-mono-numbers font-medium">{u.quantity} / produit fini</TableCell>
                  </TableRow>
                ))}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">Quantité cumulée = somme sur tous les chemins (quantités multipliées à chaque niveau). Seule la nomenclature retenue de chaque produit est utilisée. Lecture seule.</p>
    </div>
  );
}
