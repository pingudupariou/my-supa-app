import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Upload, X, Info, ClipboardPaste, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { CostFlowReference, CostFlowProduct } from '@/hooks/useCostFlowData';

const VOLUME_TIERS = [50, 100, 200, 500, 1000, 2000, 5000, 10000];
const FAMILIES = ['Standard', 'Premium', 'Économique', 'Custom'];

interface BomRow {
  refCode: string;
  quantity: number;
  volume: number;
  found: boolean;
  referenceId: string | null;
  referenceName: string;
}

function emptyBomRow(): BomRow {
  return { refCode: '', quantity: 1, volume: 200, found: false, referenceId: null, referenceName: '' };
}

interface ImportResult {
  success: boolean;
  productName: string;
  refCount: number;
  errors: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingReferences: CostFlowReference[];
  existingSuppliers: string[];
  onImportProduct: (product: Partial<CostFlowProduct>, bomEntries: { referenceId: string; quantity: number }[]) => Promise<void>;
}

export function ProductImportDialog({ open, onOpenChange, existingReferences, existingSuppliers, onImportProduct }: Props) {
  const [productName, setProductName] = useState('');
  const [family, setFamily] = useState('Standard');
  const [supplier, setSupplier] = useState('');
  const [rows, setRows] = useState<BomRow[]>([emptyBomRow()]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resolveRef = useCallback((code: string): Pick<BomRow, 'found' | 'referenceId' | 'referenceName'> => {
    if (!code.trim()) return { found: false, referenceId: null, referenceName: '' };
    const ref = existingReferences.find(r => r.code.toLowerCase() === code.trim().toLowerCase());
    if (ref) return { found: true, referenceId: ref.id, referenceName: ref.name };
    return { found: false, referenceId: null, referenceName: '' };
  }, [existingReferences]);

  const updateRow = (index: number, field: keyof BomRow, value: any) => {
    setRows(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      if (field === 'refCode') {
        const resolved = resolveRef(value as string);
        next[index] = { ...next[index], ...resolved };
      }
      return next;
    });
  };

  const removeRow = (index: number) => {
    setRows(prev => prev.length === 1 ? [emptyBomRow()] : prev.filter((_, i) => i !== index));
  };

  const addRow = () => setRows(prev => [...prev, emptyBomRow()]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text/plain');
    if (!text.includes('\t') && !text.includes('\n')) return;

    e.preventDefault();
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const firstLine = lines[0].toLowerCase();
    const isHeader = firstLine.includes('code') || firstLine.includes('ref') || firstLine.includes('référence');
    const dataLines = isHeader ? lines.slice(1) : lines;

    const parsed: BomRow[] = dataLines.map(line => {
      const cols = line.split('\t');
      const code = (cols[0] || '').trim();
      const quantity = parseFloat((cols[1] || '1').replace(',', '.')) || 1;
      const volume = parseInt(cols[2] || '200') || 200;
      const resolved = resolveRef(code);
      return { refCode: code, quantity, volume, ...resolved };
    }).filter(r => r.refCode.length > 0);

    if (parsed.length > 0) {
      setRows(prev => {
        if (prev.length === 1 && !prev[0].refCode) return parsed;
        return [...prev, ...parsed];
      });
    }
  }, [resolveRef]);

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (!text) return;
      const separator = text.includes('\t') ? '\t' : text.includes(';') ? ';' : ',';
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      const firstLine = lines[0].toLowerCase();
      const isHeader = firstLine.includes('code') || firstLine.includes('ref');
      const dataLines = isHeader ? lines.slice(1) : lines;

      const parsed: BomRow[] = dataLines.map(line => {
        const cols = line.split(separator);
        const code = (cols[0] || '').trim();
        const quantity = parseFloat((cols[1] || '1').replace(',', '.')) || 1;
        const volume = parseInt(cols[2] || '200') || 200;
        const resolved = resolveRef(code);
        return { refCode: code, quantity, volume, ...resolved };
      }).filter(r => r.refCode.length > 0);

      if (parsed.length > 0) setRows(parsed);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const validRows = rows.filter(r => r.refCode.trim() && r.found && r.referenceId);
  const notFoundRows = rows.filter(r => r.refCode.trim() && !r.found);
  const validCount = validRows.length;

  const handleImport = async () => {
    if (!productName.trim() || validCount === 0) return;
    setImporting(true);

    try {
      const bomEntries = validRows.map(r => ({ referenceId: r.referenceId!, quantity: r.quantity }));
      await onImportProduct(
        { name: productName, family, main_supplier: supplier, coefficient: 1.3, price_ttc: 0, default_volume: 500, comments: '' },
        bomEntries
      );
      setResult({ success: true, productName, refCount: validCount, errors: notFoundRows.map(r => r.refCode) });
    } catch {
      setResult({ success: false, productName, refCount: 0, errors: ['Erreur lors de la création'] });
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setProductName('');
    setFamily('Standard');
    setSupplier('');
    setRows([emptyBomRow()]);
    setResult(null);
    onOpenChange(false);
  };

  if (result) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {result.success ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <AlertTriangle className="h-5 w-5 text-destructive" />}
              {result.success ? 'Produit créé' : 'Erreur'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {result.success && (
              <>
                <p className="text-sm">Le produit <strong>{result.productName}</strong> a été créé avec <strong>{result.refCount}</strong> référence(s).</p>
                {result.errors.length > 0 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <span className="font-medium">{result.errors.length} référence(s) non trouvée(s) ignorée(s) :</span>
                      <span className="text-xs ml-1">{result.errors.join(', ')}</span>
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}
            {!result.success && <p className="text-sm text-destructive">{result.errors[0]}</p>}
          </div>
          <Button onClick={handleClose} className="w-full">Fermer</Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Importer des produits</DialogTitle>
          <p className="text-sm text-muted-foreground">Choisissez votre méthode d'import</p>
        </DialogHeader>

        <Tabs defaultValue="paste" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="w-full">
            <TabsTrigger value="paste" className="flex-1"><ClipboardPaste className="h-4 w-4 mr-1" /> Coller depuis Excel</TabsTrigger>
            <TabsTrigger value="file" className="flex-1"><Upload className="h-4 w-4 mr-1" /> Importer un fichier</TabsTrigger>
          </TabsList>

          <TabsContent value="paste" className="flex-1 flex flex-col overflow-hidden space-y-3 mt-3">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Comment utiliser :</strong>
                <ol className="list-decimal ml-4 mt-1 text-sm space-y-0.5">
                  <li>Saisissez le <strong>nom du produit</strong> et sa famille en haut</li>
                  <li>Collez les codes de références depuis Excel (Ctrl+V)</li>
                  <li>Ajustez quantité et volume d'achat pour chaque référence</li>
                  <li>Les références <strong className="text-destructive">non trouvées</strong> apparaissent en rouge</li>
                </ol>
              </AlertDescription>
            </Alert>

            {/* Product info */}
            <div className="grid grid-cols-3 gap-4 p-4 border rounded-lg bg-muted/30">
              <div>
                <Label>Nom du produit *</Label>
                <Input value={productName} onChange={e => setProductName(e.target.value)} placeholder="Ex: CCD-Diaphrag-105 111" />
              </div>
              <div>
                <Label>Famille *</Label>
                <Select value={family} onValueChange={setFamily}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FAMILIES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fournisseur</Label>
                <Select value={supplier} onValueChange={setSupplier}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value=" ">Aucun</SelectItem>
                    {existingSuppliers.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* References table */}
            <div className="flex-1 overflow-auto border rounded" onPaste={handlePaste}>
              <p className="text-sm font-medium px-3 py-2 bg-muted/50 border-b">Références du produit</p>
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium">Code Référence</th>
                    <th className="px-3 py-2 text-left text-xs font-medium w-24">Quantité</th>
                    <th className="px-3 py-2 text-left text-xs font-medium w-32">Volume d'achat</th>
                    <th className="px-3 py-2 text-left text-xs font-medium">Statut</th>
                    <th className="px-1 py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className={`border-t ${row.refCode && !row.found ? 'bg-destructive/5' : ''}`}>
                      <td className="px-2 py-1">
                        <Input
                          className={`h-8 text-xs ${row.refCode && !row.found ? 'border-destructive text-destructive' : ''}`}
                          placeholder="NR20200022"
                          value={row.refCode}
                          onChange={e => updateRow(i, 'refCode', e.target.value)}
                        />
                        {row.found && <span className="text-xs text-muted-foreground ml-1">{row.referenceName}</span>}
                      </td>
                      <td className="px-2 py-1">
                        <Input type="number" min={1} className="h-8 text-xs font-mono-numbers" value={row.quantity} onChange={e => updateRow(i, 'quantity', parseInt(e.target.value) || 1)} />
                      </td>
                      <td className="px-2 py-1">
                        <Select value={String(row.volume)} onValueChange={v => updateRow(i, 'volume', parseInt(v))}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{VOLUME_TIERS.map(v => <SelectItem key={v} value={String(v)}>{v}</SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-1">
                        {row.refCode && (
                          row.found
                            ? <Badge variant="secondary" className="text-xs">✓ Trouvée</Badge>
                            : <Badge variant="destructive" className="text-xs">Non trouvée</Badge>
                        )}
                      </td>
                      <td className="px-1 py-1 text-center">
                        <button onClick={() => removeRow(i)} className="text-destructive hover:text-destructive/80"><X className="h-4 w-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={addRow}>+ Ajouter une référence</Button>
              <div className="flex items-center gap-3">
                {notFoundRows.length > 0 && <span className="text-xs text-destructive">{notFoundRows.length} non trouvée(s)</span>}
                <span className="text-sm text-muted-foreground">{validCount} référence(s) valide(s)</span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="file" className="space-y-4 mt-3">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Formats supportés : <strong>.csv, .tsv</strong><br />
                Colonnes attendues : Code Référence, Quantité, Volume d'achat
              </AlertDescription>
            </Alert>
            <div className="flex justify-center py-8 border-2 border-dashed rounded-lg">
              <div className="text-center">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground mb-2">Glissez un fichier ou cliquez pour sélectionner</p>
                <input ref={fileInputRef} type="file" className="hidden" accept=".csv,.tsv,.txt" onChange={handleFileImport} />
                <Button variant="outline" onClick={() => fileInputRef.current?.click()}>Choisir un fichier</Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={handleClose}><X className="h-4 w-4 mr-1" /> Annuler</Button>
          <Button onClick={handleImport} disabled={!productName.trim() || validCount === 0 || importing}>
            <Upload className="h-4 w-4 mr-1" /> Créer le produit ({validCount} réf.)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
