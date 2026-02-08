import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Upload, X, Info, ClipboardPaste, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { CostFlowReference } from '@/hooks/useCostFlowData';

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'CNY', 'JPY'];
const VOLUME_TIERS = [50, 100, 200, 500, 1000, 2000, 5000, 10000];

type DuplicateAction = 'skip' | 'overwrite';

interface ImportRow {
  code: string;
  name: string;
  supplier: string;
  currency: string;
  prices: Record<number, number>;
  unit: string;
  comments: string;
  valid: boolean;
  isDuplicate: boolean;
}

function emptyRow(): ImportRow {
  return { code: '', name: '', supplier: '', currency: 'EUR', prices: {}, unit: 'pièce', comments: '', valid: false, isDuplicate: false };
}

function validateRow(row: ImportRow): boolean {
  // Only code is required, all other fields default to 0 or empty
  return row.code.trim().length > 0;
}

interface ImportResult {
  imported: number;
  skipped: number;
  updated: number;
  errors: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (refs: Partial<CostFlowReference>[], duplicateAction: DuplicateAction) => Promise<ImportResult>;
  existingCodes: string[];
}

export function ReferenceImportDialog({ open, onOpenChange, onImport, existingCodes }: Props) {
  const [rows, setRows] = useState<ImportRow[]>([emptyRow()]);
  const [importing, setImporting] = useState(false);
  const [duplicateAction, setDuplicateAction] = useState<DuplicateAction>('skip');
  const [result, setResult] = useState<ImportResult | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validCount = rows.filter(r => validateRow(r)).length;
  const duplicateCount = rows.filter(r => r.code && existingCodes.includes(r.code)).length;

  const updateRow = (index: number, field: keyof ImportRow, value: any) => {
    setRows(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      next[index].valid = validateRow(next[index]);
      next[index].isDuplicate = next[index].code ? existingCodes.includes(next[index].code) : false;
      return next;
    });
  };

  const updatePrice = (index: number, vol: number, value: number) => {
    setRows(prev => {
      const next = [...prev];
      next[index] = { ...next[index], prices: { ...next[index].prices, [vol]: value } };
      return next;
    });
  };

  const removeRow = (index: number) => {
    setRows(prev => prev.length === 1 ? [emptyRow()] : prev.filter((_, i) => i !== index));
  };

  const addRow = () => setRows(prev => [...prev, emptyRow()]);

  // Handle paste from Excel
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text/plain');
    if (!text.includes('\t') && !text.includes('\n')) return; // not tabular data
    
    e.preventDefault();
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    // Detect if first line is header
    const firstLine = lines[0].toLowerCase();
    const isHeader = firstLine.includes('code') || firstLine.includes('nom') || firstLine.includes('name');
    const dataLines = isHeader ? lines.slice(1) : lines;

    const parsed: ImportRow[] = dataLines.map(line => {
      const cols = line.split('\t');
      const row = emptyRow();
      // Expected: Code, Nom, Fournisseur, Devise, 50, 100, 200, 500, 1000, 2000, 5000, 10000, Unité, Commentaire
      row.code = (cols[0] || '').trim();
      row.name = (cols[1] || '').trim();
      row.supplier = (cols[2] || '').trim();
      row.currency = CURRENCIES.includes((cols[3] || '').trim().toUpperCase()) ? (cols[3] || 'EUR').trim().toUpperCase() : 'EUR';
      VOLUME_TIERS.forEach((vol, i) => {
        const val = parseFloat((cols[4 + i] || '').replace(',', '.'));
        if (!isNaN(val)) row.prices[vol] = val;
      });
      row.unit = (cols[12] || 'pièce').trim();
      row.comments = (cols[13] || '').trim();
      row.valid = validateRow(row);
      row.isDuplicate = row.code ? existingCodes.includes(row.code) : false;
      return row;
    }).filter(r => r.code || r.name);

    if (parsed.length > 0) {
      setRows(prev => {
        // If current state is just one empty row, replace it
        if (prev.length === 1 && !prev[0].code && !prev[0].name) return parsed;
        return [...prev, ...parsed];
      });
    }
  }, []);

  // Handle CSV/Excel file import
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
      const isHeader = firstLine.includes('code') || firstLine.includes('nom');
      const dataLines = isHeader ? lines.slice(1) : lines;

      const parsed: ImportRow[] = dataLines.map(line => {
        const cols = line.split(separator);
        const row = emptyRow();
        row.code = (cols[0] || '').trim();
        row.name = (cols[1] || '').trim();
        row.supplier = (cols[2] || '').trim();
        row.currency = CURRENCIES.includes((cols[3] || '').trim().toUpperCase()) ? (cols[3] || 'EUR').trim().toUpperCase() : 'EUR';
        VOLUME_TIERS.forEach((vol, i) => {
          const val = parseFloat((cols[4 + i] || '').replace(',', '.'));
          if (!isNaN(val)) row.prices[vol] = val;
        });
        row.unit = (cols[12] || 'pièce').trim();
        row.comments = (cols[13] || '').trim();
        row.valid = validateRow(row);
        row.isDuplicate = row.code ? existingCodes.includes(row.code) : false;
        return row;
      }).filter(r => r.code || r.name);

      if (parsed.length > 0) setRows(parsed);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImport = async () => {
    const validRows = rows.filter(r => validateRow(r));
    if (validRows.length === 0) return;

    setImporting(true);
    const refs: Partial<CostFlowReference>[] = validRows.map(r => ({
      code: r.code, name: r.name || r.code, supplier: r.supplier || '',
      currency: r.currency || 'EUR', prices: r.prices || {}, comments: r.comments || '',
      category: 'Mécanique', revision: 'A',
    }));
    const importResult = await onImport(refs, duplicateAction);
    setResult(importResult);
    setImporting(false);
  };

  const handleClose = () => {
    setRows([emptyRow()]);
    setResult(null);
    onOpenChange(false);
  };

  // Result screen
  if (result) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Import terminé
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {result.imported > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="default" className="bg-green-600">{result.imported}</Badge>
                <span className="text-sm">référence(s) importée(s)</span>
              </div>
            )}
            {result.updated > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{result.updated}</Badge>
                <span className="text-sm">référence(s) mise(s) à jour</span>
              </div>
            )}
            {result.skipped > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="outline">{result.skipped}</Badge>
                <span className="text-sm">doublon(s) ignoré(s)</span>
              </div>
            )}
            {result.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertDescription>
                  {result.errors.map((err, i) => <div key={i} className="text-xs">{err}</div>)}
                </AlertDescription>
              </Alert>
            )}
          </div>
          <Button onClick={handleClose} className="w-full">Fermer</Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Importer des références</DialogTitle>
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
                <strong>Comment coller depuis Excel :</strong> Sélectionnez vos lignes, copiez (Ctrl+C), cliquez dans le tableau et collez (Ctrl+V). Seul le <strong>code</strong> est obligatoire, les cases vides auront la valeur 0 par défaut.
              </AlertDescription>
            </Alert>

            {duplicateCount > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  <span>{duplicateCount} code(s) déjà existant(s)</span>
                  <div className="flex gap-2 ml-4">
                    <Button size="sm" variant={duplicateAction === 'skip' ? 'default' : 'outline'} onClick={() => setDuplicateAction('skip')}>
                      Ignorer
                    </Button>
                    <Button size="sm" variant={duplicateAction === 'overwrite' ? 'default' : 'outline'} onClick={() => setDuplicateAction('overwrite')}>
                      Écraser
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <div ref={tableRef} className="flex-1 overflow-auto border rounded" onPaste={handlePaste}>
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="px-2 py-2 text-left text-xs font-medium w-24">Code *</th>
                    <th className="px-2 py-2 text-left text-xs font-medium w-28">Nom</th>
                    <th className="px-2 py-2 text-left text-xs font-medium w-28">Fournisseur</th>
                    <th className="px-2 py-2 text-left text-xs font-medium w-20">Devise</th>
                    {VOLUME_TIERS.map(v => (
                      <th key={v} className="px-1 py-2 text-center text-xs font-medium w-16">{v}</th>
                    ))}
                    <th className="px-2 py-2 text-left text-xs font-medium w-20">Unité</th>
                    <th className="px-2 py-2 text-left text-xs font-medium w-28">Commentaire</th>
                    <th className="px-1 py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className={`border-t ${row.isDuplicate ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''}`}>
                      <td className="px-1 py-1">
                        <div className="relative">
                          <Input className={`h-8 text-xs ${row.isDuplicate ? 'border-yellow-400' : ''}`} placeholder="NR..." value={row.code} onChange={e => updateRow(i, 'code', e.target.value)} />
                          {row.isDuplicate && <AlertTriangle className="absolute right-1 top-1.5 h-3 w-3 text-yellow-500" />}
                        </div>
                      </td>
                      <td className="px-1 py-1">
                        <Input className="h-8 text-xs" placeholder="Nom..." value={row.name} onChange={e => updateRow(i, 'name', e.target.value)} />
                      </td>
                      <td className="px-1 py-1">
                        <Input className="h-8 text-xs" value={row.supplier} onChange={e => updateRow(i, 'supplier', e.target.value)} />
                      </td>
                      <td className="px-1 py-1">
                        <Select value={row.currency} onValueChange={v => updateRow(i, 'currency', v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                      {VOLUME_TIERS.map(vol => (
                        <td key={vol} className="px-1 py-1">
                          <Input type="number" step="0.01" className="h-8 text-xs text-right font-mono-numbers" value={row.prices[vol] ?? ''} onChange={e => updatePrice(i, vol, parseFloat(e.target.value) || 0)} placeholder="0" />
                        </td>
                      ))}
                      <td className="px-1 py-1">
                        <Input className="h-8 text-xs" value={row.unit} onChange={e => updateRow(i, 'unit', e.target.value)} />
                      </td>
                      <td className="px-1 py-1">
                        <Input className="h-8 text-xs" value={row.comments} onChange={e => updateRow(i, 'comments', e.target.value)} />
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
              <Button variant="outline" size="sm" onClick={addRow}>+ Ajouter une ligne</Button>
              <div className="flex items-center gap-3">
                {duplicateCount > 0 && <span className="text-xs text-yellow-600">{duplicateCount} doublon(s)</span>}
                <span className="text-sm text-muted-foreground">{validCount} ligne(s) valide(s)</span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="file" className="space-y-4 mt-3">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Formats supportés : <strong>.csv, .tsv</strong><br />
                Colonnes attendues : Code, Nom, Fournisseur, Devise, 50, 100, 200, 500, 1000, 2000, 5000, 10000, Unité, Commentaire
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
            {rows.length > 0 && rows[0].code && (
              <p className="text-sm text-muted-foreground">{validCount} ligne(s) chargée(s) et prête(s) à importer</p>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={handleClose}><X className="h-4 w-4 mr-1" /> Annuler</Button>
          <Button onClick={handleImport} disabled={validCount === 0 || importing}>
            <Upload className="h-4 w-4 mr-1" /> Importer {validCount} référence(s)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
