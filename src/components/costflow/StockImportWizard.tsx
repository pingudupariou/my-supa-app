import { useState, useMemo, useCallback } from 'react';
import { CostFlowReference, CostFlowProduct } from '@/hooks/useCostFlowData';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, FileSpreadsheet, ArrowRight, Check, AlertTriangle, X, ChevronLeft } from 'lucide-react';
import * as XLSX from 'xlsx';

interface Props {
  references: CostFlowReference[];
  products: CostFlowProduct[];
  onImportComplete: (
    entries: { itemType: 'reference' | 'product'; itemId: string; quantity: number }[],
    fileName: string,
    matchedCount: number,
    partialCount: number,
    unmatchedCount: number,
  ) => void;
  onClose: () => void;
}

type Step = 'upload' | 'columns' | 'matching' | 'confirm';

interface ExcelRow {
  [key: string]: any;
}

interface MatchResult {
  excelSku: string;
  excelQty: number;
  matchType: 'exact' | 'partial' | 'none';
  matchedItem?: { id: string; type: 'reference' | 'product'; name: string; code?: string };
  partialCandidates?: { id: string; type: 'reference' | 'product'; name: string; code?: string; score: number }[];
  accepted: boolean;
  selectedItemId?: string;
}

function similarity(a: string, b: string): number {
  const la = a.toLowerCase().trim();
  const lb = b.toLowerCase().trim();
  if (la === lb) return 1;
  if (la.includes(lb) || lb.includes(la)) return 0.8;
  // Simple character overlap
  const setA = new Set(la.split(''));
  const setB = new Set(lb.split(''));
  const intersection = [...setA].filter(c => setB.has(c)).length;
  const union = new Set([...setA, ...setB]).size;
  return union > 0 ? intersection / union : 0;
}

export function StockImportWizard({ references, products, onImportComplete, onClose }: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ExcelRow[]>([]);
  const [skuColumn, setSkuColumn] = useState('');
  const [qtyColumn, setQtyColumn] = useState('');
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);

  // Step 1: Upload
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      const wb = XLSX.read(data, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json: ExcelRow[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
      if (json.length > 0) {
        setHeaders(Object.keys(json[0]));
        setRows(json);
        setStep('columns');
      }
    };
    reader.readAsBinaryString(file);
  }, []);

  // Step 2 -> 3: Run matching
  const runMatching = useCallback(() => {
    if (!skuColumn || !qtyColumn) return;

    const allItems = [
      ...references.filter(r => !r.deleted_at).map(r => ({
        id: r.id,
        type: 'reference' as const,
        name: r.name,
        code: r.code,
      })),
      ...products.filter(p => !p.deleted_at).map(p => ({
        id: p.id,
        type: 'product' as const,
        name: p.name,
        code: undefined,
      })),
    ];

    const results: MatchResult[] = rows.map(row => {
      const excelSku = String(row[skuColumn] || '').trim();
      const excelQty = Number(row[qtyColumn]) || 0;

      if (!excelSku) {
        return { excelSku: '(vide)', excelQty, matchType: 'none' as const, accepted: false };
      }

      // Exact match
      const exact = allItems.find(item =>
        (item.code && item.code.toLowerCase() === excelSku.toLowerCase()) ||
        item.name.toLowerCase() === excelSku.toLowerCase()
      );

      if (exact) {
        return {
          excelSku,
          excelQty,
          matchType: 'exact' as const,
          matchedItem: exact,
          accepted: true,
        };
      }

      // Partial matches
      const scored = allItems
        .map(item => ({
          ...item,
          score: Math.max(
            item.code ? similarity(excelSku, item.code) : 0,
            similarity(excelSku, item.name),
          ),
        }))
        .filter(item => item.score >= 0.4)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      if (scored.length > 0) {
        return {
          excelSku,
          excelQty,
          matchType: 'partial' as const,
          partialCandidates: scored,
          accepted: false,
        };
      }

      return { excelSku, excelQty, matchType: 'none' as const, accepted: false };
    });

    setMatchResults(results);
    setStep('matching');
  }, [skuColumn, qtyColumn, rows, references, products]);

  // Accept/reject partial
  const handleAcceptPartial = (index: number, itemId: string) => {
    setMatchResults(prev => prev.map((r, i) => {
      if (i !== index) return r;
      const candidate = r.partialCandidates?.find(c => c.id === itemId);
      return {
        ...r,
        accepted: true,
        selectedItemId: itemId,
        matchedItem: candidate ? { id: candidate.id, type: candidate.type, name: candidate.name, code: candidate.code } : undefined,
      };
    }));
  };

  const handleRejectPartial = (index: number) => {
    setMatchResults(prev => prev.map((r, i) =>
      i === index ? { ...r, accepted: false, selectedItemId: undefined, matchedItem: undefined } : r
    ));
  };

  const handleToggleExact = (index: number, accepted: boolean) => {
    setMatchResults(prev => prev.map((r, i) =>
      i === index ? { ...r, accepted } : r
    ));
  };

  // Stats
  const stats = useMemo(() => {
    const exact = matchResults.filter(r => r.matchType === 'exact').length;
    const partial = matchResults.filter(r => r.matchType === 'partial').length;
    const none = matchResults.filter(r => r.matchType === 'none').length;
    const accepted = matchResults.filter(r => r.accepted).length;
    return { exact, partial, none, accepted, total: matchResults.length };
  }, [matchResults]);

  // Final import
  const handleImport = () => {
    const entries = matchResults
      .filter(r => r.accepted && r.matchedItem)
      .map(r => ({
        itemType: r.matchedItem!.type,
        itemId: r.matchedItem!.id,
        quantity: r.excelQty,
      }));

    onImportComplete(
      entries,
      fileName,
      stats.exact,
      matchResults.filter(r => r.matchType === 'partial' && r.accepted).length,
      stats.none,
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Stock Excel
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* Step indicators */}
            {['upload', 'columns', 'matching', 'confirm'].map((s, i) => (
              <div key={s} className="flex items-center gap-1">
                <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  step === s ? 'bg-primary text-primary-foreground' :
                  ['upload', 'columns', 'matching', 'confirm'].indexOf(step) > i ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                }`}>{i + 1}</div>
                {i < 3 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
              </div>
            ))}
            <Button variant="ghost" size="icon" className="ml-2" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="flex flex-col items-center gap-6 py-8">
            <div className="border-2 border-dashed rounded-lg p-10 text-center hover:border-primary/50 transition-colors">
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm font-medium mb-2">Glissez un fichier Excel ou cliquez pour sélectionner</p>
              <p className="text-xs text-muted-foreground mb-4">Formats supportés : .xlsx, .xls, .csv</p>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* Step 2: Column selection */}
        {step === 'columns' && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary">{fileName}</Badge>
              <Badge variant="outline">{rows.length} lignes</Badge>
              <Badge variant="outline">{headers.length} colonnes</Badge>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Colonne SKU / Code</label>
                <Select value={skuColumn} onValueChange={setSkuColumn}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                  <SelectContent>
                    {headers.map(h => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {skuColumn && rows[0] && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Ex : « {String(rows[0][skuColumn]).slice(0, 40)} »
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Colonne Quantité</label>
                <Select value={qtyColumn} onValueChange={setQtyColumn}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                  <SelectContent>
                    {headers.map(h => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {qtyColumn && rows[0] && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Ex : « {String(rows[0][qtyColumn]).slice(0, 20)} »
                  </p>
                )}
              </div>
            </div>

            {/* Preview table */}
            <div className="border rounded-md overflow-hidden max-h-48 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {headers.map(h => (
                      <TableHead key={h} className={`text-xs ${h === skuColumn ? 'bg-primary/10 font-bold' : h === qtyColumn ? 'bg-accent font-bold' : ''}`}>
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 5).map((row, i) => (
                    <TableRow key={i}>
                      {headers.map(h => (
                        <TableCell key={h} className={`text-xs ${h === skuColumn ? 'bg-primary/5 font-mono' : h === qtyColumn ? 'bg-accent/30 font-mono' : ''}`}>
                          {String(row[h]).slice(0, 30)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('upload')}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Retour
              </Button>
              <Button onClick={runMatching} disabled={!skuColumn || !qtyColumn}>
                Lancer le matching <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Matching results */}
        {step === 'matching' && (
          <div className="space-y-4">
            {/* Stats bar */}
            <div className="flex gap-3">
              <Badge className="bg-green-500/10 text-green-700 border-green-500/30">
                <Check className="h-3 w-3 mr-1" /> {stats.exact} exact{stats.exact > 1 ? 's' : ''}
              </Badge>
              <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/30">
                <AlertTriangle className="h-3 w-3 mr-1" /> {stats.partial} partiel{stats.partial > 1 ? 's' : ''}
              </Badge>
              <Badge className="bg-red-500/10 text-red-700 border-red-500/30">
                <X className="h-3 w-3 mr-1" /> {stats.none} non trouvé{stats.none > 1 ? 's' : ''}
              </Badge>
              <Badge variant="default">{stats.accepted} accepté{stats.accepted > 1 ? 's' : ''}</Badge>
            </div>

            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">✓</TableHead>
                    <TableHead>SKU Excel</TableHead>
                    <TableHead>Qté</TableHead>
                    <TableHead>Correspondance</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matchResults.map((r, i) => (
                    <TableRow key={i} className={
                      r.matchType === 'exact' ? 'bg-green-500/5' :
                      r.matchType === 'partial' ? 'bg-amber-500/5' : 'bg-red-500/5'
                    }>
                      <TableCell>
                        {r.matchType !== 'none' && (
                          <Checkbox
                            checked={r.accepted}
                            onCheckedChange={(v) => {
                              if (r.matchType === 'exact') handleToggleExact(i, !!v);
                              else if (!v) handleRejectPartial(i);
                            }}
                          />
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.excelSku}</TableCell>
                      <TableCell className="font-mono font-bold">{r.excelQty}</TableCell>
                      <TableCell>
                        {r.matchType === 'exact' && r.matchedItem && (
                          <div className="text-xs">
                            <span className="font-medium">{r.matchedItem.name}</span>
                            {r.matchedItem.code && <span className="text-muted-foreground ml-1">({r.matchedItem.code})</span>}
                          </div>
                        )}
                        {r.matchType === 'partial' && !r.accepted && (
                          <Select onValueChange={(v) => handleAcceptPartial(i, v)}>
                            <SelectTrigger className="h-7 text-xs w-52">
                              <SelectValue placeholder="Choisir..." />
                            </SelectTrigger>
                            <SelectContent>
                              {r.partialCandidates?.map(c => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.name} {c.code ? `(${c.code})` : ''} — {Math.round(c.score * 100)}%
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        {r.matchType === 'partial' && r.accepted && r.matchedItem && (
                          <div className="text-xs">
                            <span className="font-medium">{r.matchedItem.name}</span>
                            <Button variant="ghost" size="sm" className="h-5 ml-1 text-xs" onClick={() => handleRejectPartial(i)}>
                              Changer
                            </Button>
                          </div>
                        )}
                        {r.matchType === 'none' && (
                          <span className="text-xs text-muted-foreground">Aucune correspondance</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.matchedItem && (
                          <Badge variant={r.matchedItem.type === 'reference' ? 'outline' : 'secondary'} className="text-[10px]">
                            {r.matchedItem.type === 'reference' ? '📦 Ref' : '🎯 Produit'}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          r.matchType === 'exact' ? 'default' :
                          r.matchType === 'partial' ? 'secondary' : 'destructive'
                        } className="text-[10px]">
                          {r.matchType === 'exact' ? '✓ Exact' : r.matchType === 'partial' ? '~ Partiel' : '✗ Aucun'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('columns')}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Retour
              </Button>
              <Button onClick={handleImport} disabled={stats.accepted === 0}>
                Importer {stats.accepted} entrée{stats.accepted > 1 ? 's' : ''} <Check className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
