import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, X, Info, ClipboardPaste } from 'lucide-react';
import type { CostFlowReference } from '@/hooks/useCostFlowData';

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'CNY', 'JPY'];
const VOLUME_TIERS = [50, 100, 200, 500, 1000, 2000, 5000, 10000];

interface ImportRow {
  code: string;
  name: string;
  supplier: string;
  currency: string;
  prices: Record<number, number>;
  unit: string;
  comments: string;
  valid: boolean;
}

function emptyRow(): ImportRow {
  return { code: '', name: '', supplier: '', currency: 'EUR', prices: {}, unit: 'pièce', comments: '', valid: false };
}

function validateRow(row: ImportRow): boolean {
  return row.code.trim().length > 0 && row.name.trim().length > 0;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (refs: Partial<CostFlowReference>[]) => Promise<void>;
  existingCodes: string[];
}

export function ReferenceImportDialog({ open, onOpenChange, onImport, existingCodes }: Props) {
  const [rows, setRows] = useState<ImportRow[]>([emptyRow()]);
  const [importing, setImporting] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validCount = rows.filter(r => validateRow(r)).length;

  const updateRow = (index: number, field: keyof ImportRow, value: any) => {
    setRows(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      next[index].valid = validateRow(next[index]);
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
      return row;
    }).filter(r => r.code || r.name); // filter completely empty

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
      code: r.code, name: r.name, supplier: r.supplier,
      currency: r.currency, prices: r.prices, comments: r.comments,
      category: 'Mécanique', revision: 'A',
    }));
    await onImport(refs);
    setImporting(false);
    setRows([emptyRow()]);
    onOpenChange(false);
  };

  const duplicates = rows.filter(r => r.code && existingCodes.includes(r.code));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                <strong>Comment coller depuis Excel :</strong>
                <ol className="list-decimal ml-4 mt-1 text-sm space-y-0.5">
                  <li>Sélectionnez vos lignes dans Excel (avec ou sans en-têtes)</li>
                  <li>Copiez (Ctrl+C)</li>
                  <li>Cliquez dans la première cellule du tableau ci-dessous</li>
                  <li>Collez (Ctrl+V) — les lignes s'ajouteront automatiquement</li>
                </ol>
              </AlertDescription>
            </Alert>

            {duplicates.length > 0 && (
              <Alert variant="destructive">
                <AlertDescription>
                  {duplicates.length} code(s) déjà existant(s) : {duplicates.map(d => d.code).join(', ')}
                </AlertDescription>
              </Alert>
            )}

            <div ref={tableRef} className="flex-1 overflow-auto border rounded" onPaste={handlePaste}>
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="px-2 py-2 text-left text-xs font-medium w-24">Code</th>
                    <th className="px-2 py-2 text-left text-xs font-medium w-28">Nom</th>
                    <th className="px-2 py-2 text-left text-xs font-medium w-28">Fournisseur</th>
                    <th className="px-2 py-2 text-left text-xs font-medium w-20">Devise</th>
                    {VOLUME_TIERS.map(v => (
                      <th key={v} className="px-1 py-2 text-center text-xs font-medium w-16">{v}</th>
                    ))}
                    <th className="px-2 py-2 text-left text-xs font-medium w-20">Unité</th>
                    <th className="px-2 py-2 text-left text-xs font-medium w-28">Commentaire</th>
                    <th className="px-1 py-2 w-8">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-1 py-1">
                        <Input className="h-8 text-xs" placeholder="NR..." value={row.code} onChange={e => updateRow(i, 'code', e.target.value)} />
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
                          <Input type="number" step="0.01" className="h-8 text-xs text-right font-mono-numbers" value={row.prices[vol] || ''} onChange={e => updatePrice(i, vol, parseFloat(e.target.value) || 0)} />
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
              <span className="text-sm text-muted-foreground">{validCount} ligne(s) valide(s)</span>
            </div>
          </TabsContent>

          <TabsContent value="file" className="space-y-4 mt-3">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Formats supportés : <strong>.xlsx, .xls, .csv</strong><br />
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
          <Button variant="outline" onClick={() => onOpenChange(false)}><X className="h-4 w-4 mr-1" /> Annuler</Button>
          <Button onClick={handleImport} disabled={validCount === 0 || importing}>
            <Upload className="h-4 w-4 mr-1" /> Importer {validCount} référence(s)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
