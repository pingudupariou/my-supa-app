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
    dWeight = 0.6;
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
type Cand = { key: string; type: 'reference' | 'product'; id: string; code: string; name: string; score: number };

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
  const [choices, setChoices] = useState<Record<number, string>>({});

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

  const items = useMemo(() => [
    ...references.filter(r => !r.deleted_at).map(r => ({ key: 'reference:' + r.id, type: 'reference' as const, id: r.id, code: r.code, name: r.name, k: loose(r.code) })),
    ...products.filter(p => !p.deleted_at).map(p => ({ key: 'product:' + p.id, type: 'product' as const, id: p.id, code: '', name: p.name, k: loose(p.name) })),
  ].map(i => ({ ...i })), [references, products]);

  const analyzed = useMemo(() => {
    if (!cols.sku) return [];
    const out: { idx: number; sku: string; label: string; cands: Cand[]; row: Record<string, unknown> }[] = [];
    rows.forEach((row, idx) => {
      const sku = String(row[cols.sku!] ?? '').trim();
      if (!sku) return;
      const label = cols.label ? String(row[cols.label] ?? '') : '';
      const keys = [loose(sku), label ? loose(label) : ''].filter(Boolean).map(k => ({ k, bg: bigrams(k) }));
      const scored: Cand[] = [];
      for (const it of items) {
        let best = 0;
        for (const q of keys) {
          const sc = q.k === it.k ? 1 : dice(q.bg, q.k.length, it.bg, it.k.length);
          if (it.type === 'reference' && q !== keys[0]) continue; // refs: code vs sku only
          if (sc > best) best = sc;
        }
        if (best > 0.3) scored.push({ key: it.key, type: it.type, id: it.id, code: it.code, name: it.name, score: Math.round(best * 100) });
      }
      scored.sort((a, b) => b.score - a.score);
      out.push({ idx, sku, label, cands: scored.slice(0, 5), row });
    });
    return out;
  }, [rows, cols.sku, cols.label, items]);

  const { matched, ignored, toReview } = useMemo(() => {
    const matched: { type: 'reference' | 'product'; code: string; name: string; score: number; manual: boolean; entry: StockSyncEntry }[] = [];
    const toReview: typeof analyzed = [];
    const seen = new Set<string>();
    let ignored = 0;
    for (const a of analyzed) {
      const choice = choices[a.idx];
      const auto = a.cands[0] && a.cands[0].score >= threshold ? a.cands[0] : undefined;
      if (!auto) toReview.push(a);
      const selKey = choice ?? auto?.key;
      if (!selKey || selKey === IGNORE) { ignored++; continue; }
      const it = items.find(i => i.key === selKey);
      if (!it || seen.has(selKey)) continue;
      seen.add(selKey);
      const g = (f: string) => (cols[f] ? num(a.row[cols[f]!]) : null);
      matched.push({
        type: it.type, code: it.code || a.sku, name: it.name,
        score: a.cands.find(c => c.key === selKey)?.score ?? 0, manual: !!choice,
        entry: { referenceId: it.id, itemType: it.type, quantity: g('real') ?? 0, available: g('available'), reserved: g('reserved'), incoming: g('incoming'), reorderPoint: g('reorder') },
      });
    }
    return { matched, ignored, toReview };
  }, [analyzed, choices, threshold, items, cols]);

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
                <p className="text-sm font-medium">À valider manuellement ({toReview.filter(a => !choices[a.idx]).length} restantes / {toReview.length})</p>
                <div className="border rounded-md max-h-[350px] overflow-auto divide-y">
                  {toReview.slice(0, 200).map(a => (
                    <div key={a.idx} className="flex items-center gap-3 p-2">
                      <div className="w-56 shrink-0">
                        <p className="font-mono text-xs">{a.sku}</p>
                        {a.label && <p className="text-xs text-muted-foreground truncate">{a.label}</p>}
                      </div>
                      <Select value={choices[a.idx] ?? ''} onValueChange={v => setChoices(c => ({ ...c, [a.idx]: v }))}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder={a.cands.length ? 'Choisir une correspondance…' : 'Aucune proposition'} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={IGNORE}>— Ignorer —</SelectItem>
                          {a.cands.map(c => (
                            <SelectItem key={c.key} value={c.key}>{c.score}% · {c.type === 'reference' ? 'Réf' : 'Produit'} · {c.code ? c.code + ' — ' : ''}{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {a.cands[0] && !choices[a.idx] && (
                        <Button size="sm" variant="outline" onClick={() => setChoices(c => ({ ...c, [a.idx]: a.cands[0].key }))}>Valider {a.cands[0].score}%</Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-3 text-sm">
              <Badge>{refCount} références</Badge>
              <Badge variant="secondary">{matched.length - refCount} produits</Badge>
              <Badge variant="outline">{ignored} lignes ignorées (absentes de l'app)</Badge>
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
