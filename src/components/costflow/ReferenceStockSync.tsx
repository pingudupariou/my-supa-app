import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { CostFlowReference, CostFlowProduct } from '@/hooks/useCostFlowData';
import { StockSyncEntry } from '@/hooks/useStockData';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, ChevronLeft, Check } from 'lucide-react';

interface Props {
  references: CostFlowReference[];
  products?: CostFlowProduct[];
  onConfirm: (entries: StockSyncEntry[], fileName: string, matched: number, ignored: number) => Promise<void> | void;
  onClose: () => void;
}

const norm = (s: unknown) => String(s ?? '').trim().toUpperCase();
const loose = (s: unknown) => norm(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s\-_./]/g, '');
const keyNorm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '');
const NONE = '__none__';

const FIELDS: { key: string; label: string; aliases: string[] }[] = [
  { key: 'sku', label: 'Code / Sku (clé de correspondance)', aliases: ['sku'] },
  { key: 'label', label: 'Libellé (secours pour produits)', aliases: ['label', 'libelle', 'nom'] },
  { key: 'real', label: 'Stock réel', aliases: ['reel', 'stockreel'] },
  { key: 'available', label: 'Disponible', aliases: ['disponible'] },
  { key: 'reserved', label: 'Réservé', aliases: ['reserve'] },
  { key: 'incoming', label: 'À venir', aliases: ['avenir'] },
  { key: 'reorder', label: 'Point de commande', aliases: ['pointdecommande'] },
];

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(',', '.').replace(/\s/g, ''));
  return isNaN(n) ? null : n;
};

export function ReferenceStockSync({ references, products = [], onConfirm, onClose }: Props) {
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
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
      const hs = (XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 })[0] || []).map(String).filter(Boolean);
      const found: Record<string, string | null> = {};
      for (const f of FIELDS) found[f.key] = hs.find(h => f.aliases.some(a => keyNorm(h).startsWith(a))) ?? null;
      setHeaders(hs);
      setCols(found);
      setRows(data);
      if (!data.length) setError('Le fichier ne contient aucune ligne de stock (uniquement les en-têtes).');
    } catch {
      setError('Fichier illisible.');
    }
  };

  const { matched, ignored } = useMemo(() => {
    const matched: { type: 'reference' | 'product'; code: string; name: string; entry: StockSyncEntry }[] = [];
    if (!cols.sku) return { matched, ignored: 0 };
    const refByCode = new Map(references.filter(r => !r.deleted_at).map(r => [loose(r.code), r]));
    const prodByName = new Map(products.filter(p => !p.deleted_at).map(p => [loose(p.name), p]));
    const seen = new Set<string>();
    let ignored = 0;
    for (const row of rows) {
      const sku = row[cols.sku];
      if (!norm(sku)) continue;
      const g = (f: string) => (cols[f] ? num(row[cols[f]!]) : null);
      const ref = refByCode.get(loose(sku));
      const prod = !ref ? (prodByName.get(loose(sku)) ?? (cols.label ? prodByName.get(loose(row[cols.label])) : undefined)) : undefined;
      const item = ref ? { type: 'reference' as const, id: ref.id, code: ref.code, name: ref.name }
        : prod ? { type: 'product' as const, id: prod.id, code: String(sku), name: prod.name } : null;
      if (!item || seen.has(item.type + item.id)) { if (!item) ignored++; continue; }
      seen.add(item.type + item.id);
      matched.push({
        type: item.type, code: item.code, name: item.name,
        entry: {
          referenceId: item.id, itemType: item.type,
          quantity: g('real') ?? 0, available: g('available'), reserved: g('reserved'),
          incoming: g('incoming'), reorderPoint: g('reorder'),
        },
      });
    }
    return { matched, ignored };
  }, [rows, cols, references, products]);

  const confirm = async () => {
    setSaving(true);
    await onConfirm(matched.map(m => m.entry), fileName, matched.length, ignored);
    setSaving(false);
  };

  const refCount = matched.filter(m => m.type === 'reference').length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Mettre à jour le stock (références et produits)</CardTitle>
        <Button variant="ghost" size="sm" onClick={onClose}><ChevronLeft className="h-4 w-4 mr-1" />Retour</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Choisis la colonne du fichier qui contient le code, puis les colonnes de stock à récupérer. Références : Code = colonne choisie. Produits : nom = code ou libellé. Rien n'est créé.
        </p>
        <label className="flex items-center justify-center gap-2 border-2 border-dashed rounded-md p-6 cursor-pointer hover:bg-muted/50">
          <Upload className="h-5 w-5" />
          <span className="text-sm">{fileName || 'Choisir le fichier Excel de stock'}</span>
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </label>
        {error && <p className="text-sm text-destructive">{error}</p>}

        {headers.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {FIELDS.map(f => (
              <div key={f.key} className="space-y-1">
                <label className="text-xs font-medium">{f.label}</label>
                <Select value={cols[f.key] ?? NONE} onValueChange={v => setCols(c => ({ ...c, [f.key]: v === NONE ? null : v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>— Ne pas utiliser —</SelectItem>
                    {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}

        {rows.length > 0 && cols.sku && (
          <>
            <div className="flex flex-wrap gap-3 text-sm">
              <Badge>{refCount} références</Badge>
              <Badge variant="secondary">{matched.length - refCount} produits</Badge>
              <Badge variant="outline">{ignored} lignes ignorées (absentes de l'app)</Badge>
            </div>
            <div className="border rounded-md max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead><TableHead>Code</TableHead><TableHead>Nom</TableHead>
                    <TableHead className="text-right">Réel</TableHead><TableHead className="text-right">Dispo</TableHead>
                    <TableHead className="text-right">Réservé</TableHead><TableHead className="text-right">À venir</TableHead>
                    <TableHead className="text-right">Pt cde</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matched.slice(0, 300).map(({ type, code, name, entry }) => (
                    <TableRow key={type + entry.referenceId}>
                      <TableCell><Badge variant={type === 'reference' ? 'default' : 'secondary'} className="text-xs">{type === 'reference' ? 'Réf' : 'Produit'}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{code}</TableCell>
                      <TableCell className="text-sm">{name}</TableCell>
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
                <Check className="h-4 w-4 mr-2" />{saving ? 'Mise à jour…' : `Mettre à jour ${matched.length} articles`}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
