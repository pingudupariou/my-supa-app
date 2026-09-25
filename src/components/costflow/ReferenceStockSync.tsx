import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { CostFlowReference } from '@/hooks/useCostFlowData';
import { StockSyncEntry } from '@/hooks/useStockData';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, ChevronLeft, Check } from 'lucide-react';

interface Props {
  references: CostFlowReference[];
  onConfirm: (entries: StockSyncEntry[], fileName: string, matched: number, ignored: number) => Promise<void> | void;
  onClose: () => void;
}

const norm = (s: unknown) => String(s ?? '').trim().toUpperCase();
const keyNorm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '');

const FIELD_ALIASES: Record<string, string[]> = {
  sku: ['sku'],
  real: ['reel', 'stockreel'],
  available: ['disponible'],
  reserved: ['reserve'],
  incoming: ['avenir'],
  reorder: ['pointdecommande'],
};

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(',', '.').replace(/\s/g, ''));
  return isNaN(n) ? null : n;
};

export function ReferenceStockSync({ references, onConfirm, onClose }: Props) {
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [cols, setCols] = useState<Record<string, string | null>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleFile = async (file: File) => {
    setError('');
    setFileName(file.name);
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
      const headers = data.length ? Object.keys(data[0]) : (XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 })[0] || []).map(String);
      const found: Record<string, string | null> = {};
      for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
        found[field] = headers.find(h => aliases.some(a => keyNorm(h).startsWith(a))) ?? null;
      }
      if (!found.sku) { setError('Colonne « Sku » introuvable dans le fichier.'); setRows([]); return; }
      if (!data.length) { setError('Le fichier ne contient aucune ligne de stock (uniquement les en-têtes).'); setRows([]); return; }
      setCols(found);
      setRows(data);
    } catch {
      setError('Fichier illisible.');
    }
  };

  const { matched, ignored } = useMemo(() => {
    const byCode = new Map<string, Record<string, unknown>>();
    for (const r of rows) {
      const sku = norm(r[cols.sku!]);
      if (sku) byCode.set(sku, r);
    }
    const matched: { ref: CostFlowReference; entry: StockSyncEntry }[] = [];
    const matchedCodes = new Set<string>();
    for (const ref of references.filter(r => !r.deleted_at)) {
      const row = byCode.get(norm(ref.code));
      if (!row) continue;
      matchedCodes.add(norm(ref.code));
      const g = (f: string) => (cols[f] ? num(row[cols[f]!]) : null);
      matched.push({
        ref,
        entry: {
          referenceId: ref.id,
          quantity: g('real') ?? 0,
          available: g('available'),
          reserved: g('reserved'),
          incoming: g('incoming'),
          reorderPoint: g('reorder'),
        },
      });
    }
    return { matched, ignored: byCode.size - matchedCodes.size };
  }, [rows, cols, references]);

  const confirm = async () => {
    setSaving(true);
    await onConfirm(matched.map(m => m.entry), fileName, matched.length, ignored);
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Mettre à jour le stock des références</CardTitle>
        <Button variant="ghost" size="sm" onClick={onClose}><ChevronLeft className="h-4 w-4 mr-1" />Retour</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Seules les références déjà présentes dans l'app sont mises à jour (Code = Sku, correspondance exacte). Les SKU inconnus sont ignorés, aucune référence n'est créée.
        </p>
        <label className="flex items-center justify-center gap-2 border-2 border-dashed rounded-md p-6 cursor-pointer hover:bg-muted/50">
          <Upload className="h-5 w-5" />
          <span className="text-sm">{fileName || 'Choisir le fichier Excel de stock'}</span>
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </label>
        {error && <p className="text-sm text-destructive">{error}</p>}

        {rows.length > 0 && (
          <>
            <div className="flex flex-wrap gap-2 text-xs">
              {Object.entries({ sku: 'Sku', real: 'Réel', available: 'Disponible', reserved: 'Réservé', incoming: 'À venir', reorder: 'Point de commande' }).map(([k, l]) => (
                <Badge key={k} variant={cols[k] ? 'secondary' : 'outline'}>{l} → {cols[k] ?? 'non trouvée'}</Badge>
              ))}
            </div>
            <div className="flex gap-3 text-sm">
              <Badge>{matched.length} références trouvées</Badge>
              <Badge variant="outline">{ignored} SKU ignorés (absents de l'app)</Badge>
            </div>
            <div className="border rounded-md max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead><TableHead>Nom</TableHead>
                    <TableHead className="text-right">Réel</TableHead><TableHead className="text-right">Dispo</TableHead>
                    <TableHead className="text-right">Réservé</TableHead><TableHead className="text-right">À venir</TableHead>
                    <TableHead className="text-right">Pt cde</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matched.map(({ ref, entry }) => (
                    <TableRow key={ref.id}>
                      <TableCell className="font-mono text-xs">{ref.code}</TableCell>
                      <TableCell className="text-sm">{ref.name}</TableCell>
                      <TableCell className="text-right font-mono">{entry.quantity}</TableCell>
                      <TableCell className="text-right font-mono">{entry.available ?? '—'}</TableCell>
                      <TableCell className="text-right font-mono">{entry.reserved ?? '—'}</TableCell>
                      <TableCell className="text-right font-mono">{entry.incoming ?? '—'}</TableCell>
                      <TableCell className="text-right font-mono">{entry.reorderPoint ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-end">
              <Button onClick={confirm} disabled={!matched.length || saving}>
                <Check className="h-4 w-4 mr-2" />{saving ? 'Mise à jour…' : `Mettre à jour ${matched.length} références`}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
