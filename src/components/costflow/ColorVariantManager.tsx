import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Trash2, Search, Palette, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { CostFlowReference, CostFlowProduct, CostFlowBomEntry } from '@/hooks/useCostFlowData';

interface Color { id: string; name: string; code: string; hex: string }
type Position = 'end' | 'before_last';

interface Props {
  references: CostFlowReference[];
  products: CostFlowProduct[];
  bom: CostFlowBomEntry[];
  onChanged: () => void;
}

export function buildVariantCode(base: string, colorCode: string, sep: string, position: Position) {
  const s = sep || '_';
  if (position === 'before_last') {
    const idx = base.lastIndexOf(s);
    if (idx > 0) return base.slice(0, idx) + s + colorCode + base.slice(idx);
  }
  return base + s + colorCode;
}

const norm = (v: string) => v.trim().toLowerCase();

function NamingSettings({ sep, setSep, pos, setPos, example }: { sep: string; setSep: (v: string) => void; pos: Position; setPos: (v: Position) => void; example: string }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
      <div>
        <Label>Séparateur</Label>
        <Input value={sep} maxLength={3} onChange={e => setSep(e.target.value)} className="font-mono" />
      </div>
      <div>
        <Label>Position du nom de la couleur</Label>
        <Select value={pos} onValueChange={v => setPos(v as Position)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="end">À la fin</SelectItem>
            <SelectItem value="before_last">Avant le dernier séparateur</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="text-sm text-muted-foreground">
        Exemple : <span className="font-mono text-foreground">{example}</span>
      </div>
    </div>
  );
}

function ColorPicker({ colors, selected, toggle }: { colors: Color[]; selected: string[]; toggle: (id: string) => void }) {
  if (colors.length === 0) return <p className="text-sm text-muted-foreground">Créez d'abord des couleurs à l'étape 1.</p>;
  return (
    <div className="flex flex-wrap gap-3">
      {colors.map(c => (
        <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer border rounded px-2 py-1">
          <Checkbox checked={selected.includes(c.id)} onCheckedChange={() => toggle(c.id)} />
          <span className="inline-block h-3 w-3 rounded-full border" style={{ backgroundColor: c.hex }} />
          {c.name} <span className="font-mono text-xs text-muted-foreground">{c.code}</span>
        </label>
      ))}
    </div>
  );
}

export function ColorVariantManager({ references, products, bom, onChanged }: Props) {
  const { user } = useAuth();
  const [colors, setColors] = useState<Color[]>([]);
  const [newColor, setNewColor] = useState({ name: '', code: '', hex: '#3366cc' });

  // Refs
  const [refSearch, setRefSearch] = useState('');
  const [selRefs, setSelRefs] = useState<string[]>([]);
  const [refColors, setRefColors] = useState<string[]>([]);
  const [refSep, setRefSep] = useState('_');
  const [refPos, setRefPos] = useState<Position>('end');
  const [busy, setBusy] = useState(false);

  // Products
  const [prodSearch, setProdSearch] = useState('');
  const [selProds, setSelProds] = useState<string[]>([]);
  const [prodColors, setProdColors] = useState<string[]>([]);
  const [prodSep, setProdSep] = useState('_');
  const [prodPos, setProdPos] = useState<Position>('end');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const loadColors = async () => {
    const { data } = await supabase.from('costflow_colors' as any).select('*').order('name');
    setColors(((data as any[]) || []).map(r => ({ id: r.id, name: r.name, code: r.code, hex: r.hex || '#888888' })));
  };
  useEffect(() => { loadColors(); }, []);

  const addColor = async () => {
    if (!user || !newColor.name.trim()) return;
    const code = (newColor.code.trim() || newColor.name.trim()).toUpperCase().replace(/\s+/g, '');
    const { error } = await supabase.from('costflow_colors' as any).insert({ user_id: user.id, name: newColor.name.trim(), code, hex: newColor.hex } as any);
    if (error) { toast.error('Erreur création couleur'); return; }
    setNewColor({ name: '', code: '', hex: '#3366cc' });
    loadColors();
  };
  const deleteColor = async (id: string) => {
    const { error } = await supabase.from('costflow_colors' as any).delete().eq('id', id);
    if (error) toast.error('Erreur suppression'); else loadColors();
  };

  const colorById = (id?: string | null) => colors.find(c => c.id === id);
  const toggle = (list: string[], set: (v: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter(x => x !== id) : [...list, id]);

  // ===== REFERENCES =====
  const refCodes = useMemo(() => new Set(references.map(r => norm(r.code))), [references]);
  const filteredRefs = references.filter(r => {
    const q = refSearch.toLowerCase();
    return r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q);
  });

  const refPlan = useMemo(() => selRefs.flatMap(rid => {
    const ref = references.find(r => r.id === rid);
    if (!ref) return [];
    return refColors.map(cid => {
      const c = colorById(cid)!;
      const code = buildVariantCode(ref.code, c.code, refSep, refPos);
      return { ref, color: c, code, exists: refCodes.has(norm(code)) };
    });
  }), [selRefs, refColors, refSep, refPos, references, colors, refCodes]);

  const createRefVariants = async () => {
    if (!user) return;
    const todo = refPlan.filter(p => !p.exists);
    if (todo.length === 0) { toast.info('Aucune nouvelle déclinaison à créer'); return; }
    setBusy(true);
    const ids = [...new Set(todo.map(t => t.ref.id))];
    const { data: rows } = await supabase.from('costflow_references' as any).select('*').in('id', ids);
    const src = new Map(((rows as any[]) || []).map(r => [r.id, r]));
    const inserts = todo.map(t => {
      const { id, created_at, updated_at, deleted_at, ...rest } = src.get(t.ref.id) || {};
      return {
        ...rest, user_id: user.id, code: t.code, name: `${t.ref.name} ${t.color.name}`,
        parent_reference_id: t.ref.parent_reference_id || t.ref.id, color_id: t.color.id,
      };
    });
    const { error } = await supabase.from('costflow_references' as any).insert(inserts as any);
    setBusy(false);
    if (error) { console.error(error); toast.error('Erreur création des déclinaisons'); return; }
    toast.success(`${inserts.length} référence(s) déclinée(s) créée(s)`);
    setSelRefs([]);
    onChanged();
  };

  // ===== PRODUCTS =====
  const prodNames = useMemo(() => new Set(products.map(p => norm(p.name))), [products]);
  const filteredProds = products.filter(p => p.name.toLowerCase().includes(prodSearch.toLowerCase()));

  const findColoredRef = (ref: CostFlowReference, colorId: string) => {
    if (ref.color_id === colorId) return ref;
    const root = ref.parent_reference_id || ref.id;
    return references.find(r => r.color_id === colorId && (r.parent_reference_id === root || r.id === root));
  };

  const prodPlan = useMemo(() => selProds.flatMap(pid => {
    const prod = products.find(p => p.id === pid);
    if (!prod) return [];
    const entries = bom.filter(b => b.product_id === pid);
    return prodColors.map(cid => {
      const c = colorById(cid)!;
      const name = buildVariantCode(prod.name, c.code, prodSep, prodPos);
      const lines = entries.map(e => {
        const ref = references.find(r => r.id === e.reference_id);
        const variant = ref ? findColoredRef(ref, cid) : undefined;
        return { entry: e, ref, variant };
      });
      const swaps = lines.filter(l => l.variant && l.variant.id !== l.ref?.id);
      const exists = prodNames.has(norm(name));
      const blocked = entries.length === 0 || swaps.length === 0;
      return { prod, color: c, name, lines, swaps, exists, blocked };
    });
  }), [selProds, prodColors, prodSep, prodPos, products, bom, references, colors, prodNames]);

  const creatableProds = prodPlan.filter(p => !p.blocked && !p.exists);

  const createProdVariants = async () => {
    if (!user) return;
    setConfirmOpen(false);
    setBusy(true);
    const ids = [...new Set(creatableProds.map(p => p.prod.id))];
    const { data: rows } = await supabase.from('costflow_products' as any).select('*').in('id', ids);
    const src = new Map(((rows as any[]) || []).map(r => [r.id, r]));
    let ok = 0;
    for (const p of creatableProds) {
      const { id, created_at, updated_at, deleted_at, ...rest } = src.get(p.prod.id) || {};
      const { data, error } = await supabase.from('costflow_products' as any).insert({
        ...rest, user_id: user.id, name: p.name,
        parent_product_id: p.prod.parent_product_id || p.prod.id, color_id: p.color.id,
      } as any).select('id').single();
      if (error || !data) { console.error(error); continue; }
      const newId = (data as any).id;
      const bomRows = p.lines.map(l => ({
        user_id: user.id, product_id: newId,
        reference_id: l.variant?.id || l.entry.reference_id, quantity: l.entry.quantity,
      }));
      if (bomRows.length) await supabase.from('costflow_bom' as any).insert(bomRows as any);
      ok++;
    }
    setBusy(false);
    toast.success(`${ok} produit(s) décliné(s) créé(s)`);
    setSelProds([]);
    onChanged();
  };

  return (
    <div className="space-y-6">
      {/* STEP 1 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5" /> Étape 1 — Couleurs de déclinaison</CardTitle>
          <CardDescription>Le code est ajouté au code de la référence ou au nom du produit (ex : BLUE).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2 items-end">
            <div><Label>Nom</Label><Input value={newColor.name} onChange={e => setNewColor({ ...newColor, name: e.target.value })} placeholder="Bleu" /></div>
            <div><Label>Code</Label><Input value={newColor.code} onChange={e => setNewColor({ ...newColor, code: e.target.value })} placeholder="BLUE" className="font-mono" /></div>
            <div><Label>Teinte</Label><Input type="color" value={newColor.hex} onChange={e => setNewColor({ ...newColor, hex: e.target.value })} className="w-16 p-1" /></div>
            <Button onClick={addColor}><Plus className="h-4 w-4 mr-1" /> Ajouter</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {colors.map(c => (
              <Badge key={c.id} variant="outline" className="gap-2 py-1">
                <span className="inline-block h-3 w-3 rounded-full border" style={{ backgroundColor: c.hex }} />
                {c.name} <span className="font-mono text-xs text-muted-foreground">{c.code}</span>
                <button onClick={() => deleteColor(c.id)} title="Supprimer"><Trash2 className="h-3 w-3 text-destructive" /></button>
              </Badge>
            ))}
            {colors.length === 0 && <p className="text-sm text-muted-foreground">Aucune couleur.</p>}
          </div>
        </CardContent>
      </Card>

      {/* STEP 2 REFS */}
      <Card>
        <CardHeader>
          <CardTitle>Étape 2 — Décliner des références</CardTitle>
          <CardDescription>Sélectionnez des références et des couleurs : une nouvelle référence est créée par couleur.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ColorPicker colors={colors} selected={refColors} toggle={id => toggle(refColors, setRefColors, id)} />
          <NamingSettings sep={refSep} setSep={setRefSep} pos={refPos} setPos={setRefPos}
            example={buildVariantCode('NR20210041_GTAICNC', colorById(refColors[0])?.code || 'BLUE', refSep, refPos)} />
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher une référence..." value={refSearch} onChange={e => setRefSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="border rounded max-h-72 overflow-auto">
            <Table>
              <TableHeader><TableRow><TableHead className="w-10" /><TableHead>Code</TableHead><TableHead>Nom</TableHead><TableHead>Couleur</TableHead></TableRow></TableHeader>
              <TableBody>
                {filteredRefs.map(r => (
                  <TableRow key={r.id}>
                    <TableCell><Checkbox checked={selRefs.includes(r.id)} onCheckedChange={() => toggle(selRefs, setSelRefs, r.id)} /></TableCell>
                    <TableCell className="font-mono text-xs">{r.code}</TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell>{colorById(r.color_id)?.name || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {refPlan.length > 0 && (
            <div className="border rounded p-3 space-y-1 text-sm">
              <p className="font-medium">Aperçu ({refPlan.filter(p => !p.exists).length} à créer)</p>
              {refPlan.map((p, i) => (
                <div key={i} className="flex items-center gap-2 font-mono text-xs">
                  {p.ref.code} → <span className={p.exists ? 'text-muted-foreground line-through' : ''}>{p.code}</span>
                  {p.exists && <Badge variant="secondary">existe déjà</Badge>}
                </div>
              ))}
            </div>
          )}
          <Button onClick={createRefVariants} disabled={busy || refPlan.filter(p => !p.exists).length === 0}>
            Créer les références déclinées
          </Button>
        </CardContent>
      </Card>

      {/* STEP 3 PRODUCTS */}
      <Card>
        <CardHeader>
          <CardTitle>Étape 3 — Décliner des produits</CardTitle>
          <CardDescription>
            Le produit est dupliqué et chaque référence de sa nomenclature qui existe dans la couleur choisie est remplacée.
            Sans aucune référence dans cette couleur, la déclinaison est impossible.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ColorPicker colors={colors} selected={prodColors} toggle={id => toggle(prodColors, setProdColors, id)} />
          <NamingSettings sep={prodSep} setSep={setProdSep} pos={prodPos} setPos={setProdPos}
            example={buildVariantCode(products[0]?.name || 'CCD_EVO', colorById(prodColors[0])?.code || 'BLUE', prodSep, prodPos)} />
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher un produit..." value={prodSearch} onChange={e => setProdSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="border rounded max-h-72 overflow-auto">
            <Table>
              <TableHeader><TableRow><TableHead className="w-10" /><TableHead>Produit</TableHead><TableHead>Réf. dans la nomenclature</TableHead><TableHead>Couleur</TableHead></TableRow></TableHeader>
              <TableBody>
                {filteredProds.map(p => (
                  <TableRow key={p.id}>
                    <TableCell><Checkbox checked={selProds.includes(p.id)} onCheckedChange={() => toggle(selProds, setSelProds, p.id)} /></TableCell>
                    <TableCell>{p.name}</TableCell>
                    <TableCell>{bom.filter(b => b.product_id === p.id).length}</TableCell>
                    <TableCell>{colorById(p.color_id)?.name || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {prodPlan.length > 0 && (
            <div className="space-y-3">
              {prodPlan.map((p, i) => (
                <div key={i} className="border rounded p-3 text-sm space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {p.blocked || p.exists
                      ? <AlertTriangle className="h-4 w-4 text-destructive" />
                      : <CheckCircle2 className="h-4 w-4 text-primary" />}
                    <span className="font-medium">{p.prod.name}</span> → <span className="font-mono">{p.name}</span>
                    {p.exists && <Badge variant="secondary">existe déjà</Badge>}
                    {p.blocked && <Badge variant="destructive">
                      {p.lines.length === 0 ? 'nomenclature vide' : `aucune référence en ${p.color.name}`}
                    </Badge>}
                  </div>
                  {p.lines.map((l, j) => (
                    <div key={j} className="font-mono text-xs pl-6">
                      {l.ref?.code || '?'} {l.variant && l.variant.id !== l.ref?.id
                        ? <>→ <span className="text-primary">{l.variant.code}</span></>
                        : <span className="text-muted-foreground">(conservée)</span>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
          <Button onClick={() => setConfirmOpen(true)} disabled={busy || creatableProds.length === 0}>
            Créer les produits déclinés ({creatableProds.length})
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Valider la création des déclinaisons produit ?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                {creatableProds.map((p, i) => (
                  <div key={i}>
                    <span className="font-mono">{p.name}</span> — {p.swaps.length} référence(s) remplacée(s)
                  </div>
                ))}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={createProdVariants}>Valider et créer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
