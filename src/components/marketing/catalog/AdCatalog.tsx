import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronDown, ChevronRight, Loader2, Save, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import {
  buildCatalog, matchesRules, refusalReasons, variantStatus, UNIDENTIFIED,
  type Offer, type Rules, type Variant, type Model,
} from './catalogModel';

const sb = supabase as any;
const OFFER_COLS = 'name,offer_id,feed_label,content_language,title,sku,color,size,item_group_id,product_type,image_link,price,currency,availability,custom_label_0,custom_label_1,custom_label_2,custom_label_3,custom_label_4,issues,shopify_variant_id,shopify_product_id,match_method';

async function fetchAll(q: () => any) {
  const out: any[] = [];
  for (let p = 0; ; p++) {
    const { data, error } = await q().range(p * 1000, p * 1000 + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

const STATUS_UI: Record<string, { label: string; variant: 'default' | 'destructive' | 'outline' | 'secondary' }> = {
  approved: { label: 'Éligible', variant: 'default' }, disapproved: { label: 'Refusée', variant: 'destructive' },
  pending: { label: 'En attente', variant: 'secondary' }, absent: { label: 'Absente', variant: 'outline' },
};

type Tri = boolean | 'indeterminate';
const triOf = (keys: string[], sel: Set<string>): Tri => {
  const n = keys.filter((k) => sel.has(k)).length;
  return n === 0 ? false : n === keys.length ? true : 'indeterminate';
};

export function AdCatalog({ canWrite }: { canWrite: boolean }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [products, setProducts] = useState(new Map<number, { title: string; product_type: string | null }>());
  const [manual, setManual] = useState(new Map<string, { variant: number; product: number | null }>());
  const [sales, setSales] = useState(new Map<number, { qty: number; rev: number }>());
  const [statusCache, setStatusCache] = useState<Record<string, Map<string, string>>>({});
  const [selections, setSelections] = useState<any[]>([]);

  const [rules, setRules] = useState<Rules>({ country: 'FR', family: 'all', label: 'all', availability: 'all', eligibility: 'all', search: '' });
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [saveName, setSaveName] = useState('');
  const [saveKind, setSaveKind] = useState<'fixed' | 'dynamic'>('fixed');
  const [analysisCountry, setAnalysisCountry] = useState('US');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [off, prods, man, sal, sels] = await Promise.all([
        fetchAll(() => sb.from('merchant_offers').select(OFFER_COLS).order('name')),
        fetchAll(() => sb.from('shopify_products').select('id,title,product_type').order('id')),
        sb.from('merchant_manual_matches').select('offer_id,shopify_variant_id'),
        sb.rpc('merchant_catalog_sales', { _days: 365 }),
        sb.from('merchant_catalog_selections').select('*').order('updated_at', { ascending: false }),
      ]);
      const manRows = man.data ?? [];
      const vids = manRows.map((r: any) => r.shopify_variant_id);
      const vp = vids.length ? (await sb.from('shopify_variants').select('id,product_id').in('id', vids)).data ?? [] : [];
      const vpMap = new Map(vp.map((r: any) => [Number(r.id), Number(r.product_id)]));
      setOffers(off);
      setProducts(new Map(prods.map((p: any) => [Number(p.id), { title: p.title, product_type: p.product_type }])));
      setManual(new Map(manRows.map((r: any) => [r.offer_id, { variant: Number(r.shopify_variant_id), product: vpMap.get(Number(r.shopify_variant_id)) ?? null }])));
      setSales(new Map((sal.data ?? []).map((r: any) => [Number(r[0]), { qty: Number(r[1]), rev: Number(r[2]) }])));
      setSelections(sels.data ?? []);
    } catch (e: any) { setError(e.message ?? String(e)); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const ensureCountry = useCallback(async (c: string | undefined) => {
    if (!c || statusCache[c]) return;
    const rows = await fetchAll(() => sb.from('merchant_offer_countries').select('offer_name,status').eq('country', c).order('offer_name'));
    setStatusCache((p) => ({ ...p, [c]: new Map(rows.map((r: any) => [r.offer_name, r.status])) }));
  }, [statusCache]);
  useEffect(() => { ensureCountry(rules.country); }, [rules.country, ensureCountry]);
  useEffect(() => { ensureCountry(analysisCountry); }, [analysisCountry, ensureCountry]);

  const { variants, models } = useMemo(() => buildCatalog(offers, products, manual, sales), [offers, products, manual, sales]);
  const modelByKey = useMemo(() => new Map(models.map((m) => [m.key, m])), [models]);
  const variantByKey = useMemo(() => new Map(variants.map((v) => [v.key, v])), [variants]);

  const countries = useMemo(() => {
    const s = new Set<string>();
    for (const o of offers) { if (o.feed_label) s.add(o.feed_label); for (const i of o.issues ?? []) for (const c of i?.countries ?? []) s.add(c); }
    return [...s].filter((c) => /^[A-Z]{2}$/.test(c)).sort();
  }, [offers]);
  const families = useMemo(() => [...new Set(variants.map((v) => v.family))].sort((a, b) => (a === UNIDENTIFIED ? 1 : b === UNIDENTIFIED ? -1 : a.localeCompare(b))), [variants]);
  const labels = useMemo(() => [...new Set(variants.flatMap((v) => v.labels))].sort(), [variants]);

  const statuses = rules.country ? statusCache[rules.country] : undefined;
  const filtered = useMemo(() => variants.filter((v) => matchesRules(v, modelByKey.get(v.modelKey)?.title ?? '', rules, statuses)), [variants, modelByKey, rules, statuses]);

  const tree = useMemo(() => {
    const fam = new Map<string, Map<string, Map<string, Variant[]>>>();
    for (const v of filtered) {
      const f = fam.get(v.family) ?? new Map(); fam.set(v.family, f);
      const m = f.get(v.modelKey) ?? new Map(); f.set(v.modelKey, m);
      const c = m.get(v.color) ?? []; m.set(v.color, c); c.push(v);
    }
    return [...fam.entries()].sort(([a], [b]) => families.indexOf(a) - families.indexOf(b));
  }, [filtered, families]);

  const toggleKeys = (keys: string[], on: boolean) => setSel((p) => { const n = new Set(p); keys.forEach((k) => (on ? n.add(k) : n.delete(k))); return n; });
  const toggleOpen = (k: string) => setOpen((p) => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });

  // Selection report against the current country
  const selected = useMemo(() => [...sel].map((k) => variantByKey.get(k)).filter(Boolean) as Variant[], [sel, variantByKey]);
  const notEligible = useMemo(() => rules.country ? selected.filter((v) => variantStatus(v, statuses) !== 'approved') : [], [selected, statuses, rules.country]);

  const save = async () => {
    if (!canWrite || !user) return;
    if (!saveName.trim()) return toast.error('Donne un nom à la sélection');
    const payload: any = { name: saveName.trim(), kind: saveKind, target_country: rules.country ?? null, created_by: user.id };
    if (saveKind === 'fixed') { if (!sel.size) return toast.error('Aucune référence cochée'); payload.item_keys = [...sel]; }
    else payload.rules = rules;
    const { error } = await sb.from('merchant_catalog_selections').insert(payload);
    if (error) return toast.error(error.message);
    toast.success('Sélection enregistrée'); setSaveName(''); load();
  };
  const openSelection = (s: any) => {
    if (s.kind === 'fixed') { setSel(new Set(s.item_keys)); setRules((r) => ({ ...r, country: s.target_country ?? r.country })); }
    else { setRules({ ...s.rules }); setSel(new Set()); }
    toast.message(`Sélection « ${s.name} » chargée`);
  };
  const removeSelection = async (id: string) => {
    if (!canWrite || !confirm('Supprimer cette sélection ?')) return;
    const { error } = await sb.from('merchant_catalog_selections').delete().eq('id', id);
    if (error) toast.error(error.message); else load();
  };
  const resolveCount = (s: any) => {
    if (s.kind === 'fixed') {
      const vs = (s.item_keys as string[]).map((k) => variantByKey.get(k)).filter(Boolean) as Variant[];
      return { total: s.item_keys.length, missing: s.item_keys.length - vs.length, vs };
    }
    const st = s.rules?.country ? statusCache[s.rules.country] : undefined;
    const vs = variants.filter((v) => matchesRules(v, modelByKey.get(v.modelKey)?.title ?? '', s.rules ?? {}, st));
    return { total: vs.length, missing: 0, vs };
  };

  if (loading) return <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Chargement du catalogue…</div>;
  if (error) return <Card><CardContent className="pt-6 text-sm text-destructive">Erreur : {error}</CardContent></Card>;
  if (!offers.length) return <Card><CardContent className="pt-6 text-sm text-muted-foreground">Aucune offre Merchant Center synchronisée. Lance la synchronisation dans Connexions.</CardContent></Card>;

  const distinctIds = new Set(offers.map((o) => o.offer_id)).size;
  const unidentified = variants.filter((v) => !v.identified).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[['Offres Merchant', offers.length], ['Identifiants distincts', distinctIds], ['Variantes regroupées', variants.length], ['Modèles', models.length], ['Non identifiées', unidentified]].map(([l, v]) => (
          <Card key={l as string}><CardContent className="p-3"><div className="text-xs text-muted-foreground">{l}</div><div className="text-xl font-semibold">{(v as number).toLocaleString('fr-FR')}</div></CardContent></Card>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Lecture seule : rien n'est modifié dans Merchant Center ni Google Ads. Une variante regroupe ses offres de tous les flux (pays, langues) ; l'éligibilité affichée est celle du pays choisi.</p>

      <Card>
        <CardContent className="grid gap-2 p-3 md:grid-cols-6">
          <Input className="md:col-span-2" placeholder="Nom, SKU, compatibilité (ex. SRAM AXS)…" value={rules.search} onChange={(e) => setRules({ ...rules, search: e.target.value })} />
          <Select value={rules.country} onValueChange={(v) => setRules({ ...rules, country: v })}>
            <SelectTrigger><SelectValue placeholder="Pays" /></SelectTrigger>
            <SelectContent>{countries.map((c) => <SelectItem key={c} value={c}>Pays : {c}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={rules.eligibility} onValueChange={(v) => setRules({ ...rules, eligibility: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Toute éligibilité</SelectItem><SelectItem value="eligible">Éligibles</SelectItem><SelectItem value="refused">Refusées</SelectItem><SelectItem value="absent">Absentes du pays</SelectItem></SelectContent>
          </Select>
          <Select value={rules.availability} onValueChange={(v) => setRules({ ...rules, availability: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Toute disponibilité</SelectItem><SelectItem value="in">En stock</SelectItem><SelectItem value="out">Hors stock</SelectItem></SelectContent>
          </Select>
          <Select value={rules.label} onValueChange={(v) => setRules({ ...rules, label: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Toutes étiquettes</SelectItem>{labels.map((l) => <SelectItem key={l} value={l}>Label {l.replace(':', ' : ')}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={rules.family} onValueChange={(v) => setRules({ ...rules, family: v })}>
            <SelectTrigger className="md:col-span-2"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Toutes familles</SelectItem>{families.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
          </Select>
          <div className="flex items-center gap-2 text-sm md:col-span-4">
            <Checkbox checked={triOf(filtered.map((v) => v.key), sel)} onCheckedChange={(c) => toggleKeys(filtered.map((v) => v.key), c === true)} />
            <span>Tout le résultat filtré ({filtered.length} variantes)</span>
            {!statuses && rules.country && <Loader2 className="h-3 w-3 animate-spin" />}
            {labels.length === 0 && <span className="text-xs text-muted-foreground">· aucun custom label renseigné dans Merchant Center</span>}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardContent className="max-h-[70vh] overflow-auto p-2 text-sm">
            {tree.length === 0 && <p className="p-4 text-muted-foreground">Aucun résultat.</p>}
            {tree.map(([fam, mods]) => {
              const famKeys = [...mods.values()].flatMap((m) => [...m.values()].flat().map((v) => v.key));
              const fk = `f:${fam}`;
              return (
                <div key={fam} className="border-b last:border-0">
                  <div className="flex items-center gap-2 py-2">
                    <Checkbox checked={triOf(famKeys, sel)} onCheckedChange={(c) => toggleKeys(famKeys, c === true)} />
                    <button className="flex flex-1 items-center gap-1 text-left font-semibold" onClick={() => toggleOpen(fk)}>
                      {open.has(fk) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}{fam}
                      <span className="ml-1 text-xs font-normal text-muted-foreground">{mods.size} modèles · {famKeys.length} variantes</span>
                      {fam === UNIDENTIFIED && <Badge variant="outline" className="ml-2">sans correspondance Shopify</Badge>}
                    </button>
                  </div>
                  {open.has(fk) && [...mods.entries()].map(([mk, colors]) => (
                    <ModelRow key={mk} model={modelByKey.get(mk)!} colors={colors} sel={sel} open={open} toggleOpen={toggleOpen}
                      toggleKeys={toggleKeys} statuses={statuses} country={rules.country!} canWrite={canWrite} onManualChange={load} userId={user?.id} />
                  ))}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Sélection en cours</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div><b>{sel.size}</b> variantes cochées · {selected.reduce((s, v) => s + v.offers.length, 0)} offres</div>
              {rules.country && sel.size > 0 && (notEligible.length > 0
                ? <div className="rounded border border-destructive/40 bg-destructive/5 p-2 text-xs">
                    <div className="flex items-center gap-1 font-medium text-destructive"><AlertTriangle className="h-3 w-3" />{notEligible.length} non éligibles en {rules.country}</div>
                    <ul className="mt-1 max-h-32 space-y-0.5 overflow-auto">{notEligible.slice(0, 30).map((v) => <li key={v.key}>{v.title} — {STATUS_UI[variantStatus(v, statuses)].label}{refusalReasons(v, rules.country!).length ? ` (${refusalReasons(v, rules.country!).join(', ')})` : ''}</li>)}</ul>
                  </div>
                : <div className="text-xs text-muted-foreground">Toutes éligibles en {rules.country}.</div>)}
              <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setSel(new Set())} disabled={!sel.size}>Vider</Button></div>
              {canWrite && <div className="space-y-2 border-t pt-3">
                <Input placeholder="Nom de la sélection" value={saveName} onChange={(e) => setSaveName(e.target.value)} />
                <Select value={saveKind} onValueChange={(v: any) => setSaveKind(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixe — références cochées</SelectItem>
                    <SelectItem value="dynamic">Dynamique — filtres actuels (attributs, étiquettes)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{saveKind === 'fixed' ? 'Garde exactement ces variantes.' : 'Se recalcule à chaque synchronisation selon recherche, famille, étiquette, disponibilité et éligibilité.'} Pays visé : {rules.country}.</p>
                <Button size="sm" onClick={save}><Save className="mr-1 h-4 w-4" />Enregistrer</Button>
              </div>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Sélections enregistrées</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {selections.length === 0 && <p className="text-muted-foreground">Aucune.</p>}
              {selections.map((s) => {
                const r = resolveCount(s);
                const st = s.target_country ? statusCache[s.target_country] : undefined;
                const ne = st ? r.vs.filter((v) => variantStatus(v, st) !== 'approved').length : null;
                return (
                  <div key={s.id} className="rounded border p-2">
                    <div className="flex items-center justify-between gap-2">
                      <button className="text-left font-medium hover:underline" onClick={() => openSelection(s)}>{s.name}</button>
                      {canWrite && <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeSelection(s.id)}><Trash2 className="h-3 w-3" /></Button>}
                    </div>
                    <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                      <Badge variant="outline">{s.kind === 'fixed' ? 'Fixe' : 'Dynamique'}</Badge>
                      {s.target_country && <Badge variant="outline">{s.target_country}</Badge>}
                      <span>{r.total} variantes</span>
                      {r.missing > 0 && <span className="text-destructive">· {r.missing} disparues du flux</span>}
                      {ne !== null ? (ne > 0 && <span className="text-destructive">· {ne} non éligibles</span>)
                        : s.target_country && <button className="underline" onClick={() => ensureCountry(s.target_country)}>vérifier l'éligibilité</button>}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>

      <RefusalAnalysis country={analysisCountry} setCountry={setAnalysisCountry} countries={countries} variants={variants}
        offers={offers} statuses={statusCache[analysisCountry]} modelByKey={modelByKey} />
    </div>
  );
}

function ModelRow({ model, colors, sel, open, toggleOpen, toggleKeys, statuses, country, canWrite, onManualChange, userId }: {
  model: Model; colors: Map<string, Variant[]>; sel: Set<string>; open: Set<string>; toggleOpen: (k: string) => void;
  toggleKeys: (k: string[], on: boolean) => void; statuses?: Map<string, string>; country: string; canWrite: boolean; onManualChange: () => void; userId?: string;
}) {
  const keys = [...colors.values()].flat().map((v) => v.key);
  const mk = `m:${model.key}`;
  const all = [...colors.values()].flat();
  const elig = all.filter((v) => variantStatus(v, statuses) === 'approved').length;
  const qty = all.reduce((s, v) => s + v.qty, 0);
  return (
    <div className="ml-5 border-l pl-2">
      <div className="flex items-center gap-2 py-1">
        <Checkbox checked={triOf(keys, sel)} onCheckedChange={(c) => toggleKeys(keys, c === true)} />
        <button className="flex flex-1 items-center gap-1 text-left" onClick={() => toggleOpen(mk)}>
          {open.has(mk) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span className="font-medium">{model.title}</span>
          <span className="ml-1 text-xs text-muted-foreground">{colors.size} couleurs · {keys.length} var. · {elig}/{keys.length} éligibles {country}{qty ? ` · ${qty} vendus 12 m` : ''}</span>
        </button>
      </div>
      {open.has(mk) && [...colors.entries()].map(([color, vs]) => {
        const ck = vs.map((v) => v.key);
        return (
          <div key={color} className="ml-5">
            <div className="flex items-center gap-2 py-0.5 text-xs font-medium text-muted-foreground">
              <Checkbox checked={triOf(ck, sel)} onCheckedChange={(c) => toggleKeys(ck, c === true)} />Couleur : {color} ({vs.length})
            </div>
            {vs.map((v) => <VariantRow key={v.key} v={v} sel={sel} toggleKeys={toggleKeys} statuses={statuses} country={country} canWrite={canWrite} onManualChange={onManualChange} userId={userId} />)}
          </div>
        );
      })}
    </div>
  );
}

function VariantRow({ v, sel, toggleKeys, statuses, country, canWrite, onManualChange, userId }: {
  v: Variant; sel: Set<string>; toggleKeys: (k: string[], on: boolean) => void; statuses?: Map<string, string>; country: string;
  canWrite: boolean; onManualChange: () => void; userId?: string;
}) {
  const [show, setShow] = useState(false);
  const st = variantStatus(v, statuses);
  const reasons = st === 'disapproved' ? refusalReasons(v, country) : [];
  return (
    <div className="ml-5 py-0.5">
      <div className="flex items-center gap-2">
        <Checkbox checked={sel.has(v.key)} onCheckedChange={(c) => toggleKeys([v.key], c === true)} />
        <button className="flex-1 truncate text-left" onClick={() => setShow(!show)} title={v.title}>{v.title}</button>
        <span className="hidden text-xs text-muted-foreground md:inline">{v.sku ?? '—'}</span>
        {!v.inStock && <Badge variant="outline" className="text-[10px]">Hors stock</Badge>}
        {v.manual && <Badge variant="secondary" className="text-[10px]">Manuel</Badge>}
        <Badge variant={STATUS_UI[st].variant} className="text-[10px]">{STATUS_UI[st].label}</Badge>
      </div>
      {reasons.length > 0 && <div className="ml-6 text-xs text-destructive">{reasons.join(' · ')}</div>}
      {show && (
        <div className="ml-6 mt-1 space-y-1 rounded bg-muted/40 p-2 text-xs">
          <div>{v.offers.length} offre(s) : {v.offers.map((o) => `${o.feed_label ?? '?'}/${o.content_language ?? '?'}`).join(', ')}</div>
          {v.labels.length > 0 && <div>Labels : {v.labels.join(', ')}</div>}
          <div className="text-muted-foreground">IDs : {[...new Set(v.offers.map((o) => o.offer_id))].join(', ')}</div>
          {!v.identified && <ManualMatch v={v} canWrite={canWrite} onDone={onManualChange} userId={userId} />}
          {v.manual && canWrite && <RemoveManual v={v} onDone={onManualChange} />}
        </div>
      )}
    </div>
  );
}

function ManualMatch({ v, canWrite, onDone, userId }: { v: Variant; canWrite: boolean; onDone: () => void; userId?: string }) {
  const [q, setQ] = useState(v.sku ?? '');
  const [res, setRes] = useState<any[] | null>(null);
  if (!canWrite) return <div className="text-muted-foreground">Aucune correspondance Shopify fiable (rapprochement automatique désactivé).</div>;
  const search = async () => {
    const term = q.trim(); if (!term) return;
    const { data } = await sb.from('shopify_variants').select('id,product_id,sku,title').or(`sku.ilike.%${term.replace(/[,()%]/g, '')}%,title.ilike.%${term.replace(/[,()%]/g, '')}%`).limit(10);
    setRes(data ?? []);
  };
  const link = async (row: any) => {
    const offerIds = [...new Set(v.offers.map((o) => o.offer_id))];
    if (!confirm(`Rattacher ${offerIds.length} offre(s) à la variante Shopify ${row.sku ?? row.id} ? (correction interne uniquement)`)) return;
    const { error } = await sb.from('merchant_manual_matches').upsert(offerIds.map((offer_id) => ({ offer_id, shopify_variant_id: row.id, created_by: userId })));
    if (error) toast.error(error.message); else { toast.success('Correspondance manuelle enregistrée'); onDone(); }
  };
  return (
    <div className="space-y-1">
      <div className="text-muted-foreground">Correction manuelle facultative (n'écrit rien dans Merchant Center ni Shopify) :</div>
      <div className="flex gap-1"><Input className="h-7 text-xs" value={q} onChange={(e) => setQ(e.target.value)} placeholder="SKU ou nom Shopify" /><Button size="sm" variant="outline" className="h-7" onClick={search}>Chercher</Button></div>
      {res && (res.length ? res.map((r) => (
        <button key={r.id} className="block w-full rounded px-1 text-left hover:bg-muted" onClick={() => link(r)}>{r.sku ?? '—'} · {r.title} <span className="text-muted-foreground">#{r.id}</span></button>
      )) : <div className="text-muted-foreground">Aucun résultat.</div>)}
    </div>
  );
}

function RemoveManual({ v, onDone }: { v: Variant; onDone: () => void }) {
  return <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={async () => {
    const ids = [...new Set(v.offers.filter((o) => !o.shopify_variant_id).map((o) => o.offer_id))];
    const { error } = await sb.from('merchant_manual_matches').delete().in('offer_id', ids);
    if (error) toast.error(error.message); else onDone();
  }}>Retirer la correspondance manuelle</Button>;
}

function RefusalAnalysis({ country, setCountry, countries, variants, offers, statuses, modelByKey }: {
  country: string; setCountry: (c: string) => void; countries: string[]; variants: Variant[]; offers: Offer[];
  statuses?: Map<string, string>; modelByKey: Map<string, Model>;
}) {
  const data = useMemo(() => {
    if (!statuses) return null;
    const refusedOffers = offers.filter((o) => statuses.get(o.name) === 'disapproved');
    const reasons = new Map<string, Set<string>>();
    for (const o of refusedOffers) for (const i of o.issues ?? []) {
      if (i?.severity === 'DISAPPROVED' && (i.countries ?? []).includes(country)) {
        const k = i.description || i.code; const s = reasons.get(k) ?? new Set(); s.add(o.name); reasons.set(k, s);
      }
    }
    const refusedVariants = variants.filter((v) => variantStatus(v, statuses) === 'disapproved');
    const fam = new Map<string, number>();
    for (const v of refusedVariants) fam.set(v.family, (fam.get(v.family) ?? 0) + 1);
    const best = [...refusedVariants].sort((a, b) => b.qty - a.qty || b.revenue - a.revenue).slice(0, 15);
    const noReason = refusedOffers.filter((o) => !(o.issues ?? []).some((i: any) => i?.severity === 'DISAPPROVED' && (i.countries ?? []).includes(country))).length;
    return { refusedOffers: refusedOffers.length, refusedVariants: refusedVariants.length,
      reasons: [...reasons.entries()].map(([k, s]) => [k, s.size] as const).sort((a, b) => b[1] - a[1]),
      fam: [...fam.entries()].sort((a, b) => b[1] - a[1]), best, noReason };
  }, [statuses, offers, variants, country]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-base">Analyse des offres refusées</CardTitle>
        <Select value={country} onValueChange={setCountry}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>{countries.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {!data ? <Loader2 className="h-4 w-4 animate-spin" /> : <>
          <p><b>{data.refusedOffers}</b> offres refusées en {country}, soit <b>{data.refusedVariants}</b> variantes sans aucune offre éligible dans ce pays.
            {data.noReason > 0 && <span className="text-muted-foreground"> {data.noReason} offre(s) refusée(s) sans motif détaillé par Google pour ce pays (non interprété).</span>}</p>
          <div className="grid gap-4 md:grid-cols-2">
            <div><div className="mb-1 font-medium">Motifs (offres concernées)</div>
              <Table><TableBody>{data.reasons.map(([r, n]) => <TableRow key={r}><TableCell className="py-1">{r}</TableCell><TableCell className="py-1 text-right">{n}</TableCell></TableRow>)}</TableBody></Table></div>
            <div><div className="mb-1 font-medium">Familles concernées (variantes)</div>
              <Table><TableBody>{data.fam.map(([f, n]) => <TableRow key={f}><TableCell className="py-1">{f}</TableCell><TableCell className="py-1 text-right">{n}</TableCell></TableRow>)}</TableBody></Table></div>
          </div>
          <div><div className="mb-1 font-medium">Priorité : best-sellers refusés (ventes Shopify 12 mois, tous pays)</div>
            <Table>
              <TableHeader><TableRow><TableHead>Produit</TableHead><TableHead>Famille</TableHead><TableHead className="text-right">Unités</TableHead><TableHead className="text-right">CA HT</TableHead><TableHead>Motif</TableHead></TableRow></TableHeader>
              <TableBody>{data.best.map((v) => (
                <TableRow key={v.key}><TableCell className="py-1">{modelByKey.get(v.modelKey)?.title ?? v.title} <span className="text-muted-foreground">· {v.color}</span></TableCell>
                  <TableCell className="py-1">{v.family}</TableCell><TableCell className="py-1 text-right">{v.qty}</TableCell>
                  <TableCell className="py-1 text-right">{v.revenue.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €</TableCell>
                  <TableCell className="py-1 text-xs">{refusalReasons(v, country).join(' · ') || '—'}</TableCell></TableRow>))}</TableBody>
            </Table></div>
        </>}
      </CardContent>
    </Card>
  );
}
