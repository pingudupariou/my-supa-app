import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Info, ClipboardPaste, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import type { CostFlowProduct, CostFlowProductCategory } from '@/hooks/useCostFlowData';

interface ParsedProduct {
  name: string;
  family: string;
  categoryName: string;
  category_id: string | null;
  coefficient: number;
  price_ttc: number;
  default_volume: number;
  main_supplier: string;
  valid: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: CostFlowProductCategory[];
  existingProducts: CostFlowProduct[];
  onBulkImport: (prods: Partial<CostFlowProduct>[]) => Promise<{ imported: number; errors: string[] }>;
}

export function ProductBulkImportDialog({ open, onOpenChange, categories, existingProducts, onBulkImport }: Props) {
  const [rows, setRows] = useState<ParsedProduct[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null);

  const resolveCategory = useCallback((name: string): string | null => {
    if (!name.trim()) return null;
    const cat = categories.find(c => c.name.toLowerCase() === name.trim().toLowerCase());
    return cat ? cat.id : null;
  }, [categories]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text/plain');
    if (!text.includes('\t') && !text.includes('\n')) return;
    e.preventDefault();

    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const firstLine = lines[0].toLowerCase();
    const isHeader = firstLine.includes('nom') || firstLine.includes('name') || firstLine.includes('produit');
    const dataLines = isHeader ? lines.slice(1) : lines;

    const parsed: ParsedProduct[] = dataLines.map(line => {
      const cols = line.split('\t');
      const name = (cols[0] || '').trim();
      const categoryName = (cols[1] || '').trim();
      const family = (cols[2] || 'Standard').trim();
      const coefficient = parseFloat((cols[3] || '1.3').replace(',', '.')) || 1.3;
      const price_ttc = parseFloat((cols[4] || '0').replace(',', '.')) || 0;
      const default_volume = parseInt(cols[5] || '500') || 500;
      const main_supplier = (cols[6] || '').trim();
      const category_id = resolveCategory(categoryName);

      return {
        name, family, categoryName, category_id,
        coefficient, price_ttc, default_volume, main_supplier,
        valid: name.length > 0,
      };
    }).filter(r => r.name.length > 0);

    setRows(parsed);
  }, [resolveCategory]);

  const removeRow = (index: number) => {
    setRows(prev => prev.filter((_, i) => i !== index));
  };

  const validRows = rows.filter(r => r.valid);

  const handleImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    try {
      const prods = validRows.map(r => ({
        name: r.name,
        family: r.family,
        category_id: r.category_id,
        coefficient: r.coefficient,
        price_ttc: r.price_ttc,
        default_volume: r.default_volume,
        main_supplier: r.main_supplier,
      }));
      const res = await onBulkImport(prods);
      setResult(res);
    } catch {
      setResult({ imported: 0, errors: ['Erreur inattendue'] });
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setRows([]);
    setResult(null);
    onOpenChange(false);
  };

  if (result) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {result.imported > 0 ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <AlertTriangle className="h-5 w-5 text-destructive" />}
              Import terminé
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <p className="text-sm"><strong>{result.imported}</strong> produit(s) importé(s) avec succès.</p>
            {result.errors.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <span className="font-medium">{result.errors.length} erreur(s) :</span>
                  <ul className="text-xs mt-1 space-y-0.5">
                    {result.errors.map((e, i) => <li key={i}>• {e}</li>)}
                  </ul>
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
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Import en masse de produits</DialogTitle>
          <p className="text-sm text-muted-foreground">Collez vos produits depuis Excel (Ctrl+V)</p>
        </DialogHeader>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Format attendu (colonnes Excel) :</strong>
            <div className="flex flex-wrap gap-1 mt-1">
              {['Nom *', 'Catégorie', 'Famille', 'Coefficient', 'Prix TTC', 'Volume', 'Fournisseur'].map((col, i) => (
                <Badge key={col} variant={i === 0 ? 'default' : 'secondary'} className="text-xs">{col}</Badge>
              ))}
            </div>
            <p className="text-xs mt-1 text-muted-foreground">
              Seul le <strong>Nom</strong> est obligatoire. La catégorie doit correspondre à une catégorie existante.
            </p>
          </AlertDescription>
        </Alert>

        <div
          className="flex-1 overflow-auto border rounded min-h-[200px]"
          onPaste={handlePaste}
          tabIndex={0}
        >
          {rows.length === 0 ? (
            <div className="flex items-center justify-center h-full py-16">
              <div className="text-center text-muted-foreground">
                <ClipboardPaste className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium">Cliquez ici puis collez (Ctrl+V)</p>
                <p className="text-xs mt-1">Les données seront analysées automatiquement</p>
              </div>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium">Nom</th>
                  <th className="px-3 py-2 text-left text-xs font-medium">Catégorie</th>
                  <th className="px-3 py-2 text-left text-xs font-medium">Famille</th>
                  <th className="px-3 py-2 text-right text-xs font-medium">Coef.</th>
                  <th className="px-3 py-2 text-right text-xs font-medium">Prix TTC</th>
                  <th className="px-3 py-2 text-right text-xs font-medium">Volume</th>
                  <th className="px-3 py-2 text-left text-xs font-medium">Fournisseur</th>
                  <th className="px-1 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className={`border-t ${!row.valid ? 'bg-destructive/5' : ''}`}>
                    <td className="px-3 py-1.5 font-medium">{row.name || <span className="text-destructive">—</span>}</td>
                    <td className="px-3 py-1.5">
                      {row.categoryName ? (
                        row.category_id ? (
                          <Badge variant="secondary" className="text-xs">
                            <span className="w-2 h-2 rounded-full mr-1 inline-block" style={{ backgroundColor: categories.find(c => c.id === row.category_id)?.color }} />
                            {row.categoryName}
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs">{row.categoryName} ✗</Badge>
                        )
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground">{row.family}</td>
                    <td className="px-3 py-1.5 text-right font-mono-numbers">{row.coefficient.toFixed(2)}</td>
                    <td className="px-3 py-1.5 text-right font-mono-numbers">{row.price_ttc > 0 ? `${row.price_ttc.toFixed(2)} €` : '—'}</td>
                    <td className="px-3 py-1.5 text-right font-mono-numbers">{row.default_volume}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{row.main_supplier || '—'}</td>
                    <td className="px-1 py-1.5">
                      <button onClick={() => removeRow(i)} className="text-destructive hover:text-destructive/80">
                        <X className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <span className="text-sm text-muted-foreground">
            {rows.length > 0 ? `${validRows.length} produit(s) valide(s) sur ${rows.length}` : 'Aucune donnée'}
          </span>
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleClose}>Annuler</Button>
            <Button onClick={handleImport} disabled={validRows.length === 0 || importing}>
              Importer {validRows.length} produit(s)
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
