import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { CostFlowReference, CostFlowProduct } from '@/hooks/useCostFlowData';
import { StockSyncEntry } from '@/hooks/useStockData';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
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
const IGNORE = '__ignore__';
const bigrams = (s: string) => { const m = new Map<string, number>(); for (let i = 0; i < s.length - 1; i++) { const b = s.slice(i, i + 2); m.set(b, (m.get(b) ?? 0) + 1); } return m; };
const dice = (a: Map<string, number>, al: number, b: Map<string, number>, bl: number) => {
  if (al < 2 || bl < 2) return 0;
  let inter = 0; for (const [k, v] of a) inter += Math.min(v, b.get(k) ?? 0);
  return (2 * inter) / (al - 1 + bl - 1);
};
// Compare séparément les chiffres et les lettres : les chiffres pèsent plus (identifiant),
// les lettres/mots affinent (préfixe, famille). Score combiné 0..1.
const parts = (s: string) => ({ digits: s.replace(/\D/g, ''), letters: s.replace(/\d/g, '') });
const smartScore = (a: string, b: string) => {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const pa = parts(a), pb = parts(b);
  let dScore = 0, dWeight = 0;
  if (pa.digits && pb.digits) {
    dWeight = 0.95; // les chiffres sont l'identifiant principal : poids quasi total
    dScore = pa.digits === pb.digits ? 1 : dice(bigrams(pa.digits), pa.digits.length, bigrams(pb.digits), pb.digits.length);
  } else if (!pa.digits && !pb.digits) {
    dWeight = 0;
  } else {
    return 0; // l'un a des chiffres, pas l'autre : pas le même type de code
  }
  let lScore = 0, lWeight = 0;
  if (pa.letters && pb.letters) {
    lWeight = 1 - dWeight;
    lScore = pa.letters === pb.letters ? 1 : dice(bigrams(pa.letters), pa.letters.length, bigrams(pb.letters), pb.letters.length);
  }
  if (dWeight + lWeight === 0) return 0;
  return (dScore * dWeight + lScore * lWeight) / (dWeight + lWeight);
};
type Item = { key: string; type: 'reference' | 'product'; id: string; code: string; name: string; k: string };
type CutMode = 'full' | 'underscore';
// Coupe la chaîne au premier '_' non inclus si mode 'underscore' : NR20210041_GTAICNC → NR20210041
const cutAt = (s: string, mode: CutMode) => (mode === 'underscore' ? s.split('_')[0] : s);
type RowCand = { idx: number; sku: string; label: string; score: number };
// Une entrée analysée = un article de l'app (référence ou produit) et ses meilleures
// lignes candidates dans le fichier importé. Le sens de recherche part de l'app.
type Analyzed = { item: Item; mode: 'auto' | 'code' | 'label'; cands: RowCand[] };

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
  const [threshold, setThreshold] = useState(85);
  const [choices, setChoices] = useState<Record<string, number>>({});
  const [matchMode, setMatchMode] = useState<Record<string, 'auto' | 'code' | 'label'>>({});
  const [cutRef, setCutRef] = useState<CutMode>('full');
  const [cutProd, setCutProd] = useState<CutMode>('full');

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
      setChoices({});
      if (!data.length) setError('Le fichier ne contient aucune ligne de stock (uniquement les en-têtes).');
    } catch {
      setError('Fichier illisible.');
    }
  };

  // Point de départ : les articles déjà présents dans l'app (référentiel maître).
  const items = useMemo<Item[]>(() => [
    ...references.filter(r => !r.deleted_at).map(r => ({ key: 'reference:' + r.id, type: 'reference' as const, id: r.id, code: r.code, name: r.name, k: loose(cutAt(r.code, cutRef)) })),
    ...products.filter(p => !p.deleted_at).map(p => ({ key: 'product:' + p.id, type: 'product' as const, id: p.id, code: '', name: p.name, k: loose(cutAt(p.name, cutProd)) })),
  ], [references, products, cutRef, cutProd]);

  // Pour chaque article de l'app, on cherche ses meilleures lignes dans le fichier.
  const analyzed = useMemo<Analyzed[]>(() => {
    if (!cols.sku) return [];
    const rowKeys = rows.map(row => {
      const sku = String(row[cols.sku!] ?? '').trim();
      const label = cols.label ? String(row[cols.label] ?? '') : '';
      return { sku, label, kSkuRef: loose(cutAt(sku, cutRef)), kSkuProd: loose(cutAt(sku, cutProd)), kLabelProd: label ? loose(cutAt(label, cutProd)) : '' };
    });
    return items.map(item => {
      const mode = matchMode[item.key] ?? 'auto';
      const scored: RowCand[] = [];
      rowKeys.forEach((rk, idx) => {
        if (!rk.sku) return;
        // Références : comparaison sur le code uniquement. Produits : code et/ou libellé.
        const qs = item.type === 'reference'
          ? [rk.kSkuRef]
          : mode === 'code' ? [rk.kSkuProd] : mode === 'label' ? (rk.kLabelProd ? [rk.kLabelProd] : [rk.kSkuProd]) : [rk.kSkuProd, rk.kLabelProd].filter(Boolean);
        let best = 0;
        for (const q of qs) {
          const sc = smartScore(q, item.k);
          if (sc > best) best = sc;
        }
        if (best > 0.3) scored.push({ idx, sku: rk.sku, label: rk.label, score: Math.round(best * 100) });
      });
      scored.sort((a, b) => b.score - a.score);
      return { item, mode, cands: scored.slice(0, 5) };
    });
  }, [rows, cols.sku, cols.label, items, matchMode, cutRef, cutProd]);

  const { matched, toReview, notFound, ignoredRows } = useMemo(() => {
    const matched: { type: 'reference' | 'product'; code: string; name: string; score: number; manual: boolean; entry: StockSyncEntry }[] = [];
    const toReview: Analyzed[] = [];
    let notFound = 0;
    const usedRows = new Set<number>();
    for (const a of analyzed) {
      const auto = a.cands[0] && a.cands[0].score >= threshold ? a.cands[0] : undefined;
      if (!auto) toReview.push(a);
      const chosen = choices[a.item.key];
      const selIdx = chosen ?? auto?.idx;
      if (selIdx === undefined) { if (!a.cands.length) notFound++; continue; }
      if (usedRows.has(selIdx)) continue;
      usedRows.add(selIdx);
      const row = rows[selIdx];
      const g = (f: string) => (cols[f] ? num(row[cols[f]!]) : null);
      matched.push({
        type: a.item.type, code: a.item.code, name: a.item.name,
        score: a.cands.find(c => c.idx === selIdx)?.score ?? 0, manual: chosen !== undefined && !auto,
        entry: { referenceId: a.item.id, itemType: a.item.type, quantity: g('real') ?? 0, available: g('available'), reserved: g('reserved'), incoming: g('incoming'), reorderPoint: g('reorder') },
      });
    }
    // Lignes du fichier qu'aucun article de l'app n'utilise : ignorées.
    const ignoredRows = rows.filter(r => String(r[cols.sku!] ?? '').trim()).length - usedRows.size;
    return { matched, toReview, notFound, ignoredRows };
  }, [analyzed, choices, threshold, rows, cols]);

  const confirm = async () => {
    setSaving(true);
    await onConfirm(matched.map(m => m.entry), fileName, matched.length, Math.max(0, ignoredRows));
    setSaving(false);
  };

  const refCount = matched.filter(m => m.type === 'reference').length;
  const pendingReview = toReview.filter(a => choices[a.item.key] === undefined).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Mettre à jour le stock (références et produits)</CardTitle>
        <Button variant="ghost" size="sm" onClick={onClose}><ChevronLeft className="h-4 w-4 mr-1" />Retour</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          On part de vos références et produits déjà dans l'application : pour chacun, on cherche sa ligne dans le fichier importé pour récupérer les quantités. Les lignes du fichier sans correspondance sont ignorées, rien n'est créé.
        </p>
        <label className="flex items-center justify-center gap-2 border-2 border-dashed rounded-md p-6 cursor-pointer hover:bg-muted/50">
          <Upload className="h-5 w-5" />
          <span className="text-sm">{fileName || 'Choisir le fichier Excel de stock'}</span>
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </label>
        {error && <p className="text-sm text-destructive">{error}</p>}

        {headers.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border rounded-md p-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Références : partie du code comparée</label>
              <Select value={cutRef} onValueChange={v => setCutRef(v as CutMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Code en entier (ex : NR20210041_GTAICNC)</SelectItem>
                  <SelectItem value="underscore">Jusqu'au premier « _ » non inclus (ex : NR20210041)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Produits : partie du nom comparée</label>
              <Select value={cutProd} onValueChange={v => setCutProd(v as CutMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Nom en entier</SelectItem>
                  <SelectItem value="underscore">Jusqu'au premier « _ » non inclus</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground md:col-span-2">
              La coupure s'applique des deux côtés (fichier et application) : « NR20210041_GTAICNC » dans l'app et « NR20210041 » dans le fichier matcheront à 100 %.
            </p>
          </div>
        )}

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
            <div className="space-y-2 border rounded-md p-3">
              <div className="flex justify-between text-sm">
                <span className="font-medium">Seuil de pré-validation automatique</span>
                <span className="font-mono">{threshold}%</span>
              </div>
              <Slider min={30} max={100} step={1} value={[threshold]} onValueChange={v => setThreshold(v[0])} />
              <p className="text-xs text-muted-foreground">Au-dessus du seuil : correspondance validée automatiquement. En dessous : à choisir à la main ci-dessous.</p>
            </div>
            {toReview.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">À valider manuellement ({pendingReview} restants / {toReview.length})</p>
                <div className="border rounded-md max-h-[350px] overflow-auto divide-y">
                  {toReview.slice(0, 200).map(a => (
                    <div key={a.item.key} className="flex items-center gap-3 p-2">
                      <div className="w-56 shrink-0">
                        <p className="font-mono text-xs">{a.item.code || a.item.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{a.item.name}</p>
                        {a.item.type === 'product' && cols.label && (
                          <div className="flex gap-1 mt-1">
                            {(['auto', 'code', 'label'] as const).map(m => (
                              <button
                                key={m}
                                type="button"
                                onClick={() => setMatchMode(mm => ({ ...mm, [a.item.key]: m }))}
                                className={`text-[10px] px-1.5 py-0.5 rounded border ${(matchMode[a.item.key] ?? 'auto') === m ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground'}`}
                              >
                                {m === 'auto' ? 'Les deux' : m === 'code' ? 'Code' : 'Libellé'}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <Select
                        value={choices[a.item.key] !== undefined ? String(choices[a.item.key]) : ''}
                        onValueChange={v => setChoices(c => ({ ...c, [a.item.key]: Number(v) }))}
                      >
                        <SelectTrigger className="flex-1"><SelectValue placeholder={a.cands.length ? 'Choisir la ligne du fichier…' : 'Aucune ligne ressemblante dans le fichier'} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={IGNORE}>— Ignorer cet article —</SelectItem>
                          {a.cands.map(c => (
                            <SelectItem key={c.idx} value={String(c.idx)}>{c.score}% · {c.sku}{c.label ? ` — ${c.label}` : ''}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {a.cands[0] && choices[a.item.key] === undefined && (
                        <Button size="sm" variant="outline" onClick={() => setChoices(c => ({ ...c, [a.item.key]: a.cands[0].idx }))}>Valider {a.cands[0].score}%</Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-3 text-sm">
              <Badge>{refCount} références</Badge>
              <Badge variant="secondary">{matched.length - refCount} produits</Badge>
              <Badge variant="outline">{notFound} articles sans ligne dans le fichier</Badge>
              <Badge variant="outline">{Math.max(0, ignoredRows)} lignes du fichier non utilisées</Badge>
            </div>
            <div className="border rounded-md max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead><TableHead>Score</TableHead><TableHead>Code</TableHead><TableHead>Nom</TableHead>
                    <TableHead className="text-right">Réel</TableHead><TableHead className="text-right">Dispo</TableHead>
                    <TableHead className="text-right">Réservé</TableHead><TableHead className="text-right">À venir</TableHead>
                    <TableHead className="text-right">Pt cde</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matched.slice(0, 300).map(({ type, code, name, score, manual, entry }) => (
                    <TableRow key={type + entry.referenceId}>
                      <TableCell><Badge variant={type === 'reference' ? 'default' : 'secondary'} className="text-xs">{type === 'reference' ? 'Réf' : 'Produit'}</Badge></TableCell>
                      <TableCell className="text-xs">{score}%{manual ? ' ✋' : ''}</TableCell>
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
