import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Product } from '@/engine/types';
import { SectionCard } from '@/components/ui/KPICard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { formatCurrency } from '@/data/financialConfig';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Loader2, Save, Plus, Pencil, Trash2, ChevronDown, ChevronUp, FolderOpen, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { memberOwners, replacePlanCategory } from './planMembership';
import { toast } from 'sonner';
import { ManualPlanProductDialog } from './ManualPlanProductDialog';

type Ch = 'B2C' | 'B2B' | 'OEM';
const CHS: Ch[] = ['B2C', 'B2B', 'OEM'];
interface Agg { key: string; label: string; byYear: Record<number, Record<Ch, { qty: number; ca: number }>>; cogs: number; cogsQty: number }

interface Props { products: Product[]; years: number[]; onApply: (products: Product[]) => void; onSave?: () => void }

export function ErplainActualsImport({ products, years, onApply, onSave }: Props) {
  const thisYear = new Date().getFullYear();
  const pastYears = years.filter(y => y <= thisYear);
  const futureYears = years.filter(y => y > thisYear);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Agg[] | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [groupName, setGroupName] = useState('');
  const [editor, setEditor] = useState<{ id?: string; keys: Set<string> } | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewYear, setViewYear] = useState(pastYears[pastYears.length - 1]);
  const [formError, setFormError] = useState('');
  const [project, setProject] = useState(true);
  const [growth, setGrowth] = useState(0);
  const [search, setSearch] = useState('');
  const [removeId, setRemoveId] = useState<string | null>(null);

  const fromProduct = (p: Product): Agg => {
    const key = p.id.startsWith('erplain-') ? p.id.slice(8) : `manual:${p.id}`;
    const byYear: Agg['byYear'] = {};
    for (const y of years) {
      byYear[y] = { B2C: { qty: 0, ca: 0 }, B2B: { qty: 0, ca: 0 }, OEM: { qty: 0, ca: 0 } };
      for (const c of CHS) {
        const qty = p.volumesByChannel?.[c]?.[y] ?? (c === p.category ? p.volumesByYear[y] ?? 0 : 0);
        byYear[y][c] = { qty, ca: qty * (c === 'B2C' ? p.priceHT : c === 'B2B' ? p.priceHT_B2B : p.priceHT_OEM) };
      }
    }
    const qty = Object.values(byYear).reduce((n, v) => n + CHS.reduce((s, c) => s + v[c].qty, 0), 0);
    return { key, label: p.name, byYear, cogs: qty * p.unitCost, cogsQty: qty };
  };
  const savedMembers = products.flatMap(p => p.erplainMemberProducts ?? []);
  const candidates = new Map<string, Agg>();
  [...savedMembers, ...products.filter(p => !p.erplainMembers?.length)].forEach(p => { const a = fromProduct(p); candidates.set(a.key, a); });
  (rows ?? []).forEach(a => candidates.set(a.key, a));
  const availableRows = [...candidates.values()];
  const memberName = (key: string) => candidates.get(key)?.label ?? 'Nom indisponible — actualiser les ventes';

  const load = async () => {
    setLoading(true);
    const map = new Map<string, Agg>();
    try {
      for (const y of pastYears) {
        const to = y === thisYear ? new Date().toISOString().slice(0, 10) : `${y}-12-31`;
        const { data, error } = await supabase.rpc('sales_breakdown' as any, { _from: `${y}-01-01`, _to: to });
        if (error) throw error;
        for (const r of (data as any[]) ?? []) {
          const k = String(r.key ?? r.label ?? 'sans-reference'); const a = map.get(k) ?? { key: k, label: String(r.label || r.key || 'Sans référence'), byYear: {}, cogs: 0, cogsQty: 0 };
          const yy = a.byYear[y] ??= { B2C: { qty: 0, ca: 0 }, B2B: { qty: 0, ca: 0 }, OEM: { qty: 0, ca: 0 } };
          const c = yy[r.channel as Ch]; if (!c) continue;
          c.qty += Number(r.qty) || 0; c.ca += Number(r.prod_ht) || 0;
          if (Number(r.cov_ht) > 0 && Number(r.cogs) > 0) { a.cogs += Number(r.cogs); a.cogsQty += Number(r.qty) || 0; }
          map.set(k, a);
        }
      }
      const list = [...map.values()].filter(a => Object.values(a.byYear).some(y => CHS.some(c => y[c].qty > 0)));
      list.sort((a, b) => total(b) - total(a));
      setRows(list);
    } catch (e: any) { toast.error(`Lecture des ventes impossible : ${e.message}`); }
    setLoading(false);
  };

  const total = (a: Agg) => Object.values(a.byYear).reduce((s, y) => s + CHS.reduce((t, c) => t + y[c].ca, 0), 0);
  const lastYearOf = (a: Agg) => Math.max(...Object.keys(a.byYear).map(Number));
  // Average HT price per channel: latest full sale year where that channel sold, else all years.
  const avgPrice = (a: Agg, ch: Ch) => {
    const ys = Object.keys(a.byYear).map(Number).sort((x, y) => y - x);
    for (const y of ys) { const v = a.byYear[y][ch]; if (v.qty > 0) return v.ca / v.qty; }
    return 0;
  };

  const apply = (group?: string, keys: string[] = [...sel], categoryId?: string) => {
    keys = [...new Set(keys)];
    const owners = memberOwners(products.filter(p => p.id !== categoryId));
    if (keys.some(key => owners.has(key))) { setFormError('Un produit appartient déjà à une catégorie.'); return; }
    let chosen = availableRows.filter(r => keys.includes(r.key));
    if (!keys.length || chosen.length !== keys.length) { setFormError('Certaines ventes sont indisponibles. Actualisez les ventes avant de modifier cette catégorie.'); return; }
    const memberProducts = chosen.map(a => {
      const previous = [...products, ...savedMembers].find(p => (a.key.startsWith('manual:') ? p.id === a.key.slice(7) : p.id === `erplain-${a.key}`));
      if (previous) return { ...previous, name: a.label };
      const volumesByChannel: NonNullable<Product['volumesByChannel']> = { B2C: {}, B2B: {}, OEM: {} };
      for (const y of years) for (const c of CHS) {
        const last = lastYearOf(a);
        volumesByChannel[c][y] = Math.round(a.byYear[y]?.[c].qty ?? (project && y > last ? (a.byYear[last]?.[c].qty ?? 0) * Math.pow(1 + growth / 100, y - last) : 0));
      }
      return { id: `erplain-${a.key}`, name: a.label, category: 'B2C', launchYear: Math.min(...Object.keys(a.byYear).map(Number)), devCost: 0, unitCost: a.cogsQty > 0 ? round(a.cogs / a.cogsQty) : 0, priceHT: round(avgPrice(a, 'B2C')), priceTTC_B2C: round(avgPrice(a, 'B2C') * 1.2), priceHT_B2B: round(avgPrice(a, 'B2B')), priceHT_OEM: round(avgPrice(a, 'OEM')), vatRate: .2, coef_shop: 1.5, coef_dist: 1.3, coef_oem: 1.2, productStatus: 'validated', volumesByChannel, volumesByYear: Object.fromEntries(years.map(y => [y, CHS.reduce((s, c) => s + (volumesByChannel[c][y] ?? 0), 0)])) } as Product;
    });
    if (group) {
      // Merge selected products: summed volumes/CA → weighted average price and cost for the category.
      const g: Agg = { key: categoryId?.replace(/^erplain-/, '') ?? `cat-${crypto.randomUUID()}`, label: group, byYear: {}, cogs: 0, cogsQty: 0 };
      for (const a of chosen) {
        g.cogs += a.cogs; g.cogsQty += a.cogsQty;
        for (const [y, v] of Object.entries(a.byYear)) {
          const t = g.byYear[+y] ??= { B2C: { qty: 0, ca: 0 }, B2B: { qty: 0, ca: 0 }, OEM: { qty: 0, ca: 0 } };
          for (const c of CHS) { t[c].qty += v[c].qty; t[c].ca += v[c].ca; }
        }
      }
      chosen = [g];
    }
    let next = [...products];
    for (const a of chosen) {
      const id = `erplain-${a.key}`;
      const existing = next.find(p => p.id === id);
      const vbc = existing?.volumesByChannel ? structuredClone(existing.volumesByChannel) : { B2C: {}, B2B: {}, OEM: {} } as Product['volumesByChannel'] & object;
      for (const y of pastYears) for (const c of CHS) vbc[c][y] = Math.round(a.byYear[y]?.[c].qty || 0);
      const last = lastYearOf(a);
      if (project) for (const y of futureYears) for (const c of CHS) {
        const n = y - last; vbc[c][y] = Math.round((a.byYear[last]?.[c].qty || 0) * Math.pow(1 + growth / 100, n));
      }
      const vby: Record<number, number> = {};
      years.forEach(y => { vby[y] = CHS.reduce((s, c) => s + (vbc[c][y] || 0), 0); });
      const b2c = avgPrice(a, 'B2C'), b2b = avgPrice(a, 'B2B'), oem = avgPrice(a, 'OEM');
      const firstYear = Math.min(...Object.keys(a.byYear).map(Number));
      const p: Product = {
        ...(existing ?? {
          id, category: 'B2C', devCost: 0, vatRate: 0.2, coef_shop: 1.5, coef_dist: 1.3, coef_oem: 1.2, productStatus: 'validated',
          productComment: `Importé d'Erplain (variante ${a.key})`,
        } as Product),
        name: a.label, launchYear: Math.min(existing?.launchYear ?? firstYear, firstYear),
        priceHT: round(b2c || b2b || oem), priceTTC_B2C: round((b2c || b2b || oem) * 1.2),
        priceHT_B2B: round(b2b || b2c), priceHT_OEM: round(oem || b2b || b2c),
        unitCost: a.cogsQty > 0 ? round(a.cogs / a.cogsQty) : existing?.unitCost ?? 0,
        volumesByChannel: vbc, volumesByYear: vby, productStatus: 'validated',
        ...(group ? { erplainMembers: keys, erplainMemberProducts: memberProducts, productComment: `Catégorie du plan : ${keys.length} produit(s)` } : {}),
      };
      if (group) {
        for (const y of years) for (const c of CHS) vbc[c][y] = memberProducts.reduce((s, m) => s + (m.volumesByChannel?.[c]?.[y] ?? (m.category === c ? m.volumesByYear[y] ?? 0 : 0)), 0);
        years.forEach(y => { vby[y] = CHS.reduce((s, c) => s + (vbc[c][y] ?? 0), 0); });
      }
      next = existing ? next.map(x => x.id === id ? p : x) : [...next, p];
    }
    if (group) {
      const category = next.find(p => p.id === (categoryId ?? `erplain-${chosen[0].key}`));
      if (!category) return;
      try { next = replacePlanCategory(products, category); }
      catch (error) { setFormError(error instanceof Error ? error.message : 'Catégorie impossible à enregistrer.'); return; }
    }
    onApply(next);
    setSel(new Set()); setEditor(null); setFormError('');
    toast.success(`${chosen.length} produit(s) appliqué(s) au plan`);
  };

  const cats = products.filter(p => p.erplainMembers?.length);
  const owners = memberOwners(products);
  const shown = (rows ?? []).filter(r => r.label.toLowerCase().includes(search.toLowerCase()));
  const selectable = shown.filter(r => !owners.has(r.key));
  const openEditor = (category?: Product) => {
    setEditor({ id: category?.id, keys: new Set(category?.erplainMembers ?? [...sel].filter(key => !owners.has(key))) });
    setGroupName(category?.name ?? ''); setMemberSearch(''); setFormError('');
  };
  const toggleExpanded = (id: string) => setExpanded(previous => {
    const next = new Set(previous); next.has(id) ? next.delete(id) : next.add(id); return next;
  });
  const editorRows = [...availableRows].sort((a, b) => Number(editor?.keys.has(b.key)) - Number(editor?.keys.has(a.key)))
    .filter(r => r.label.toLowerCase().includes(memberSearch.toLowerCase()));

  return (
    <SectionCard title="Réalisé Erplain · catégories du plan">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <Button size="sm" onClick={load} disabled={loading || !pastYears.length}>
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
          {rows ? 'Actualiser les ventes' : 'Charger les ventes'}
        </Button>
        <div className="flex flex-wrap gap-2"><ManualPlanProductDialog years={years} onAdd={p => onApply([...products, p])} />{onSave && <Button size="sm" variant="outline" onClick={onSave}><Save className="h-4 w-4 mr-2" />Sauvegarder le plan</Button>}</div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h3 className="font-semibold flex items-center gap-2"><FolderOpen className="h-4 w-4 text-primary" />Mes catégories <Badge variant="secondary">{cats.length}</Badge></h3>
        <Button size="sm" onClick={() => openEditor()} disabled={!availableRows.length || loading}><Plus className="h-4 w-4 mr-2" />Créer une catégorie</Button>
      </div>
      {!cats.length && <div className="py-6 border-y text-sm text-muted-foreground">Aucune catégorie dans le plan.</div>}
      <div className="grid gap-3 md:grid-cols-2 mb-5">
        {cats.map(c => <div key={c.id} className="rounded-lg border bg-card p-4 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0"><h4 className="font-semibold break-words">{c.name}</h4><div className="text-xs text-muted-foreground mt-1">{new Set(c.erplainMembers).size} produits</div></div>
            <div className="flex shrink-0 gap-1">
              <Button size="icon" variant="ghost" className="h-8 w-8" disabled={loading} title={`Modifier ${c.name}`} aria-label={`Modifier ${c.name}`} onClick={() => openEditor(c)}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" title={`Supprimer ${c.name}`} aria-label={`Supprimer ${c.name}`} onClick={() => setDeleteId(c.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4 text-sm">
            {CHS.map(ch => <div key={ch}><div className="text-xs text-muted-foreground">{ch} · prix HT</div><div className="font-medium mt-1">{formatCurrency(ch === 'B2C' ? c.priceHT : ch === 'B2B' ? c.priceHT_B2B : c.priceHT_OEM)}</div></div>)}
          </div>
          <div className="flex justify-between gap-2 text-xs border-t mt-3 pt-3"><span className="text-muted-foreground">Volume {viewYear}</span><span className="font-medium">{c.volumesByYear[viewYear] ?? 0}</span></div>
          <Button size="sm" variant="ghost" className="mt-2 w-full justify-between" onClick={() => { toggleExpanded(c.id); if (!expanded.has(c.id) && c.erplainMembers?.some(key => !candidates.has(key)) && !loading) void load(); }} aria-expanded={expanded.has(c.id)}>Produits de la catégorie{expanded.has(c.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</Button>
          <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => openEditor(c)}><Plus className="h-4 w-4 mr-2" />Ajouter des produits</Button>
          {expanded.has(c.id) && <ul className="mt-2 space-y-2 border-t pt-3 text-xs">{[...new Set(c.erplainMembers ?? [])].map(key => <li key={key} className="break-words">{memberName(key)}</li>)}</ul>}
        </div>)}
      </div>

      <h3 className="font-semibold mb-3">Produits individuels du plan</h3>
      <div className="divide-y border-y mb-5">
        {products.filter(p => !p.erplainMembers?.length).map(p => <div key={p.id} className="flex items-center justify-between gap-3 py-3 text-sm"><span className="font-medium break-words">{p.name}</span><Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-destructive" title={`Retirer ${p.name} du plan`} aria-label={`Retirer ${p.name} du plan`} onClick={() => setRemoveId(p.id)}><Trash2 className="h-4 w-4" /></Button></div>)}
        {!products.some(p => !p.erplainMembers?.length) && <p className="py-4 text-sm text-muted-foreground">Aucun produit individuel.</p>}
      </div>

      {rows && <>
        <div className="border-y py-3 mb-4 flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2"><Checkbox checked={project} onCheckedChange={v => setProject(v === true)} />Reporter les volumes sur les années suivantes</label>
          {project && <label className="flex items-center gap-2">Croissance / an<Input aria-label="Croissance annuelle" type="number" value={growth} onChange={e => setGrowth(Number(e.target.value))} className="h-8 w-20 text-center" step={5} />%</label>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h3 className="font-semibold">Produits Erplain <span className="text-muted-foreground font-normal text-sm">({rows.length})</span></h3>
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input aria-label="Rechercher un produit" placeholder="Rechercher un produit…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 w-60 max-w-full" /></div>
            <div className="flex gap-1" aria-label="Année des ventes">{pastYears.map(y => <Button key={y} variant={viewYear === y ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewYear(y)}>{y}</Button>)}</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Badge variant="secondary">{sel.size} sélectionné(s)</Badge>
          <Button size="sm" variant="ghost" onClick={() => setSel(new Set(selectable.every(r => sel.has(r.key)) ? [] : selectable.map(r => r.key)))} disabled={!selectable.length}>{selectable.length > 0 && selectable.every(r => sel.has(r.key)) ? 'Tout décocher' : 'Sélectionner les disponibles'}</Button>
          <Button size="sm" variant="outline" onClick={() => openEditor()} disabled={!sel.size}><FolderOpen className="h-4 w-4 mr-2" />Créer une catégorie</Button>
          <Button size="sm" variant="outline" onClick={() => apply()} disabled={!sel.size}>Ajouter individuellement</Button>
        </div>
        <div className="overflow-auto max-h-[420px] border rounded-md">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10"><TableRow>
              <TableHead className="w-10" /><TableHead className="min-w-[200px]">Produit</TableHead><TableHead>Dans le plan</TableHead>
              {CHS.map(ch => <TableHead key={ch} className="text-right">{ch}<div className="text-xs font-normal">Volume · prix HT</div></TableHead>)}
              <TableHead className="text-right">Coût unitaire</TableHead>
            </TableRow></TableHeader>
            <TableBody>{shown.map(a => {
              const owner = owners.get(a.key);
              return <TableRow key={a.key}>
                <TableCell><Checkbox aria-label={`Sélectionner ${a.label}`} disabled={!!owner} checked={!owner && sel.has(a.key)} onCheckedChange={v => setSel(previous => { const next = new Set(previous); v === true ? next.add(a.key) : next.delete(a.key); return next; })} /></TableCell>
                <TableCell className="text-sm font-medium max-w-[300px] break-words">{a.label}</TableCell>
                <TableCell><Badge variant={owner ? 'secondary' : 'outline'} className="max-w-48 whitespace-normal">{owner?.name ?? (products.some(p => p.id === `erplain-${a.key}`) ? 'Individuel' : 'Disponible')}</Badge></TableCell>
                {CHS.map(ch => { const v = a.byYear[viewYear]?.[ch]; return <TableCell key={ch} className="text-right text-sm tabular-nums">{v?.qty ? <>{Math.round(v.qty)}<div className="text-xs text-muted-foreground">{formatCurrency(v.ca / v.qty)}</div></> : '—'}</TableCell>; })}
                <TableCell className="text-right text-sm">{a.cogsQty > 0 ? formatCurrency(a.cogs / a.cogsQty) : <span className="text-muted-foreground">Non validé</span>}</TableCell>
              </TableRow>;
            })}{!shown.length && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Aucun produit trouvé.</TableCell></TableRow>}</TableBody>
          </Table>
        </div>
      </>}

      <Dialog open={!!editor} onOpenChange={open => { if (!open) setEditor(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editor?.id ? 'Modifier la catégorie' : 'Nouvelle catégorie'}</DialogTitle><DialogDescription>{editor?.keys.size ?? 0} produit(s) sélectionné(s)</DialogDescription></DialogHeader>
          <label className="text-sm font-medium space-y-2">Nom de la catégorie<Input aria-label="Nom de la catégorie" placeholder="Ex. Galets céramique" value={groupName} onChange={e => { setGroupName(e.target.value); setFormError(''); }} /></label>
          <Input aria-label="Rechercher dans les catégories" placeholder="Rechercher un produit…" value={memberSearch} onChange={e => setMemberSearch(e.target.value)} />
          <div className="max-h-[360px] overflow-y-auto divide-y border rounded-md">
            {editorRows.map(row => {
              const owner = owners.get(row.key); const locked = !!owner && owner.id !== editor?.id;
              return <label key={row.key} className={`flex items-center gap-3 p-3 text-sm ${locked ? 'opacity-60' : 'cursor-pointer hover:bg-muted/40'}`}>
                <Checkbox aria-label={`Inclure ${row.label}`} disabled={locked} checked={editor?.keys.has(row.key) ?? false} onCheckedChange={checked => setEditor(previous => { if (!previous) return previous; const keys = new Set(previous.keys); checked === true ? keys.add(row.key) : keys.delete(row.key); return { ...previous, keys }; })} />
                <span className="flex-1 min-w-0 break-words">{row.label}</span>{locked && <Badge variant="secondary" className="max-w-40 whitespace-normal shrink-0">{owner?.name}</Badge>}
              </label>;
            })}
            {!editorRows.length && <div className="p-6 text-center text-sm text-muted-foreground">Aucun produit trouvé.</div>}
          </div>
          {editor && [...editor.keys].some(key => !candidates.has(key)) && <p className="text-sm text-destructive">Actualisez les ventes pour retrouver les produits de cette ancienne catégorie.</p>}
          {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setEditor(null)}>Annuler</Button><Button disabled={!groupName.trim() || !editor?.keys.size} onClick={() => { if (editor) apply(groupName.trim(), [...editor.keys], editor.id); }}>{editor?.id ? 'Enregistrer les modifications' : 'Créer la catégorie'}</Button></div>
        </DialogContent>
      </Dialog>
      <Dialog open={!!removeId} onOpenChange={open => { if (!open) setRemoveId(null); }}>
        <DialogContent className="max-w-md"><DialogHeader><DialogTitle>Retirer {products.find(p => p.id === removeId)?.name} du plan ?</DialogTitle><DialogDescription>Ses volumes et prévisions seront retirés du plan uniquement. Les ventes Erplain ne seront pas modifiées.</DialogDescription></DialogHeader><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setRemoveId(null)}>Annuler</Button><Button variant="destructive" onClick={() => { onApply(products.filter(p => p.id !== removeId)); setRemoveId(null); }}>Retirer du plan</Button></div></DialogContent>
      </Dialog>
      <Dialog open={!!deleteId} onOpenChange={open => { if (!open) setDeleteId(null); }}>
        <DialogContent className="max-w-md"><DialogHeader><DialogTitle>Supprimer cette catégorie ?</DialogTitle><DialogDescription>La ligne et ses volumes seront retirés du plan. Les produits Erplain resteront disponibles ; les ventes d’origine seront conservées.</DialogDescription></DialogHeader><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setDeleteId(null)}>Annuler</Button><Button variant="destructive" onClick={() => { onApply(products.filter(p => p.id !== deleteId)); setDeleteId(null); }}>Supprimer la catégorie</Button></div></DialogContent>
      </Dialog>
    </SectionCard>
  );
}

const round = (n: number) => Math.round(n * 100) / 100;
