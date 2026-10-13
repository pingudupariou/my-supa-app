import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Save, ShieldCheck, CheckCircle2, Trash2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { buildCatalog, matchesRules, variantStatus, type Offer, type Variant } from '@/components/marketing/catalog/catalogModel';
import { checkConflicts, type Conflict } from './conflicts';

const sb = supabase as any;
export const BUILDER_PREFILL_KEY = 'novaride.builder.prefill';
const OFFER_COLS = 'name,offer_id,feed_label,content_language,title,sku,color,size,item_group_id,product_type,image_link,price,currency,availability,custom_label_0,custom_label_1,custom_label_2,custom_label_3,custom_label_4,issues,shopify_variant_id,shopify_product_id,match_method';
const TYPES: Record<string, string> = { SHOPPING: 'Shopping', PERFORMANCE_MAX: 'Performance Max', SEARCH: 'Search' };
const BIDS: Record<string, string[]> = {
  SHOPPING: ['MAXIMIZE_CLICKS', 'MAXIMIZE_CONVERSION_VALUE', 'TARGET_ROAS', 'MANUAL_CPC'],
  PERFORMANCE_MAX: ['MAXIMIZE_CONVERSION_VALUE', 'MAXIMIZE_CONVERSIONS'],
  SEARCH: ['MAXIMIZE_CONVERSIONS', 'MAXIMIZE_CONVERSION_VALUE', 'MAXIMIZE_CLICKS', 'MANUAL_CPC'],
};
const BID_L: Record<string, string> = { MAXIMIZE_CLICKS: 'Maximiser les clics', MAXIMIZE_CONVERSION_VALUE: 'Maximiser la valeur de conversion', TARGET_ROAS: 'ROAS cible', MAXIMIZE_CONVERSIONS: 'Maximiser les conversions', MANUAL_CPC: 'CPC manuel' };
const STATUS: Record<string, { l: string; v: 'default' | 'secondary' | 'outline' }> = { brouillon: { l: 'Brouillon', v: 'outline' }, valide: { l: 'Validé (non publié)', v: 'default' }, archive: { l: 'Archivé', v: 'secondary' } };
const LIMITS = { headlines: 30, long_headlines: 90, descriptions: 90 };

async function fetchAll(q: () => any) {
  const out: any[] = [];
  for (let p = 0; p < 30; p++) { const { data, error } = await q().range(p * 1000, p * 1000 + 999); if (error) throw error; out.push(...(data ?? [])); if (!data || data.length < 1000) break; }
  return out;
}
const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);
const csv = (s: string) => s.split(/[,;\s]+/).map((x) => x.trim().toUpperCase()).filter(Boolean);

type Draft = any;
const blank = (uid: string): Draft => ({
  name: '', campaign_type: 'SHOPPING', status: 'brouillon', source: 'manuel', countries: ['FR'], languages: ['fr'], daily_budget: 20,
  bidding: { strategy: 'MAXIMIZE_CONVERSION_VALUE', target_roas: null, target_cpa: null }, products: { selection_id: null, eligible_only: true },
  ad_content: { final_url: 'https://novatoride.com', headlines: [], long_headlines: [], descriptions: [], search_themes: [], keywords: [], negatives: [] },
  notes: '', created_by: uid,
});

function LinesField({ label, value, onChange, max, disabled }: { label: string; value: string[]; onChange: (v: string[]) => void; max?: number; disabled: boolean }) {
  const [txt, setTxt] = useState(value.join('\n'));
  useEffect(() => setTxt(value.join('\n')), [value]);
  const over = max ? value.filter((x) => x.length > max).length : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground"><span>{label}</span><span>{value.length} ligne(s){max ? ` · max ${max} car.` : ''}{over > 0 && <span className="text-destructive"> · {over} trop longue(s)</span>}</span></div>
      <Textarea rows={4} value={txt} disabled={disabled} onChange={(e) => setTxt(e.target.value)} onBlur={() => onChange(lines(txt))} />
    </div>
  );
}

export function CampaignBuilder({ canWrite }: { canWrite: boolean }) {
  const { user } = useAuth() as any;
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [cur, setCur] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [modelTitle, setModelTitle] = useState<Map<string, string>>(new Map());
  const [selections, setSelections] = useState<any[]>([]);
  const [statusCache, setStatusCache] = useState<Record<string, Map<string, string>>>({});
  const [snap, setSnap] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, offers, prods, man, sels, s] = await Promise.all([
        sb.from('google_ads_campaign_drafts').select('*').order('updated_at', { ascending: false }),
        fetchAll(() => sb.from('merchant_offers').select(OFFER_COLS).order('name')),
        fetchAll(() => sb.from('shopify_products').select('id,title,product_type').order('id')),
        sb.from('merchant_manual_matches').select('offer_id,shopify_variant_id'),
        sb.from('merchant_catalog_selections').select('*').order('updated_at', { ascending: false }),
        sb.from('google_ads_structure_snapshots').select('id,taken_at,data').in('status', ['success', 'partial']).order('taken_at', { ascending: false }).limit(1).maybeSingle(),
      ]);
      setDrafts(d.data ?? []); setSelections(sels.data ?? []); setSnap(s.data);
      const vids = (man.data ?? []).map((m: any) => m.shopify_variant_id);
      const vp = vids.length ? (await sb.from('shopify_variants').select('id,product_id').in('id', vids)).data ?? [] : [];
      const pOf = new Map<number, number>(vp.map((x: any) => [x.id, x.product_id]));
      const cat = buildCatalog(offers as Offer[], new Map(prods.map((p: any) => [p.id, p])),
        new Map((man.data ?? []).map((m: any) => [m.offer_id, { variant: m.shopify_variant_id, product: pOf.get(m.shopify_variant_id) ?? null }])), new Map());
      setVariants(cat.variants); setModelTitle(new Map(cat.models.map((m) => [m.key, m.title])));
    } catch (e: any) { toast.error(e.message ?? 'Chargement impossible'); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  // Prefill from Stratégie IA
  useEffect(() => {
    if (!user?.id) return;
    const raw = sessionStorage.getItem(BUILDER_PREFILL_KEY); if (!raw) return;
    sessionStorage.removeItem(BUILDER_PREFILL_KEY);
    try {
      const r = JSON.parse(raw); const b = blank(user.id);
      const t = /pmax|performance/i.test(r.type ?? '') ? 'PERFORMANCE_MAX' : /search|recherche/i.test(r.type ?? '') ? 'SEARCH' : 'SHOPPING';
      setCur({ ...b, name: r.title ?? 'Projet IA', campaign_type: t, bidding: { ...b.bidding, strategy: BIDS[t][0] }, countries: r.country ? csv(r.country) : b.countries,
        daily_budget: r.monthly_budget_eur ? Math.round(r.monthly_budget_eur / 30.4) : b.daily_budget, source: 'ia', source_ref: r,
        notes: [r.objective && `Objectif : ${r.objective}`, r.products && `Produits proposés : ${r.products}`, r.settings && `Paramètres proposés : ${r.settings}`, r.overlap_check && `Chevauchement (IA) : ${r.overlap_check}`, r.evidence && `Chiffres : ${r.evidence}`].filter(Boolean).join('\n') });
      toast.info('Projet prérempli depuis la recommandation IA — à vérifier');
    } catch { /* ignore */ }
  }, [user?.id]);

  const ensureCountry = useCallback(async (c: string) => {
    if (statusCache[c]) return;
    const rows = await fetchAll(() => sb.from('merchant_offer_countries').select('offer_name,status').eq('country', c).order('offer_name'));
    setStatusCache((s) => ({ ...s, [c]: new Map(rows.map((r: any) => [r.offer_name, r.status])) }));
  }, [statusCache]);
  useEffect(() => { cur?.countries?.forEach((c: string) => ensureCountry(c)); }, [cur?.countries, ensureCountry]);

  const sel = selections.find((s) => s.id === cur?.products?.selection_id);
  const picked = useMemo(() => {
    if (!cur || cur.campaign_type === 'SEARCH' || !sel) return { all: [] as Variant[], eligible: [] as Variant[], perCountry: {} as Record<string, number> };
    const all = sel.kind === 'fixed' ? variants.filter((v) => sel.item_keys.includes(v.key))
      : variants.filter((v) => matchesRules(v, modelTitle.get(v.modelKey) ?? '', { ...(sel.rules ?? {}), eligibility: 'all' }));
    const perCountry: Record<string, number> = {};
    for (const c of cur.countries) perCountry[c] = all.filter((v) => variantStatus(v, statusCache[c]) === 'approved').length;
    const eligible = cur.products.eligible_only ? all.filter((v) => cur.countries.some((c: string) => variantStatus(v, statusCache[c]) === 'approved')) : all;
    return { all, eligible, perCountry };
  }, [cur, sel, variants, modelTitle, statusCache]);

  const set = (patch: Partial<Draft>) => setCur((c: Draft) => ({ ...c, ...patch, status: c.status === 'valide' ? 'brouillon' : c.status }));
  const setAd = (patch: any) => set({ ad_content: { ...cur.ad_content, ...patch } });
  const locked = !canWrite || cur?.status === 'archive';

  const runCheck = (d: Draft): Conflict[] => {
    const offerIds = [...new Set(picked.eligible.flatMap((v) => v.offers.map((o) => o.offer_id)))];
    const labels = [...new Set(picked.eligible.flatMap((v) => v.labels))];
    const productTypes = [...new Set(picked.eligible.map((v) => v.family))];
    const kw = (d.ad_content.keywords ?? []).map((k: string) => k.replace(/^[[\]"]+|[[\]"]+$/g, ''));
    const res = checkConflicts({ campaign_type: d.campaign_type, countries: d.countries, daily_budget: Number(d.daily_budget) || null, offerIds, keywords: kw, labels, productTypes }, snap,
      Number(localStorage.getItem('novaride.strategy.budget')) || 12000);
    const ad = d.ad_content;
    if (d.campaign_type === 'PERFORMANCE_MAX') {
      if ((ad.headlines ?? []).length < 3) res.push({ level: 'bloquant', message: 'PMax : au moins 3 titres (11+ recommandés).' });
      if ((ad.long_headlines ?? []).length < 1) res.push({ level: 'bloquant', message: 'PMax : au moins 1 titre long.' });
      if ((ad.descriptions ?? []).length < 2) res.push({ level: 'bloquant', message: 'PMax : au moins 2 descriptions.' });
      res.push({ level: 'info', message: 'Images et logo PMax à fournir au moment de la publication (non stockés dans le projet).' });
    }
    if (d.campaign_type === 'SEARCH') {
      if ((ad.headlines ?? []).length < 3) res.push({ level: 'bloquant', message: 'Search : au moins 3 titres.' });
      if ((ad.descriptions ?? []).length < 2) res.push({ level: 'bloquant', message: 'Search : au moins 2 descriptions.' });
    }
    for (const [k, max] of Object.entries(LIMITS)) if ((ad[k] ?? []).some((x: string) => x.length > max)) res.push({ level: 'bloquant', message: `Textes trop longs dans ${k === 'headlines' ? 'les titres' : k === 'long_headlines' ? 'les titres longs' : 'les descriptions'} (max ${max}).` });
    if (d.bidding.strategy === 'TARGET_ROAS' && !d.bidding.target_roas) res.push({ level: 'bloquant', message: 'ROAS cible manquant.' });
    if (d.products.eligible_only && picked.all.length > picked.eligible.length) res.push({ level: 'info', message: `${picked.all.length - picked.eligible.length} variantes de la sélection exclues car non éligibles dans les pays ciblés.` });
    return res;
  };

  const save = async (extra: Partial<Draft> = {}) => {
    if (!cur?.name?.trim()) { toast.error('Donnez un nom au projet'); return null; }
    setBusy(true);
    const payload = { ...cur, ...extra, daily_budget: Number(cur.daily_budget) || null,
      products: { ...cur.products, variant_keys: picked.eligible.map((v) => v.key), offer_ids: [...new Set(picked.eligible.flatMap((v) => v.offers.map((o) => o.offer_id)))], per_country: picked.perCountry } };
    delete payload.created_at; delete payload.updated_at;
    const q = payload.id ? sb.from('google_ads_campaign_drafts').update(payload).eq('id', payload.id).select().single() : sb.from('google_ads_campaign_drafts').insert(payload).select().single();
    const { data, error } = await q; setBusy(false);
    if (error) { toast.error(error.message); return null; }
    setCur(data); load(); return data;
  };
  const check = async () => { const c = runCheck(cur); await save({ conflict_check: { at: new Date().toISOString(), snapshot_at: snap?.taken_at ?? null, items: c } }); toast.success('Vérification enregistrée'); };
  const validate = async () => {
    const c = runCheck(cur);
    if (c.some((x) => x.level === 'bloquant')) { await save({ conflict_check: { at: new Date().toISOString(), snapshot_at: snap?.taken_at ?? null, items: c } }); toast.error('Points bloquants à corriger avant validation'); return; }
    await save({ status: 'valide', validated_by: user.id, validated_at: new Date().toISOString(), conflict_check: { at: new Date().toISOString(), snapshot_at: snap?.taken_at ?? null, items: c } });
    toast.success('Projet validé — rien n’a été envoyé à Google Ads');
  };
  const remove = async () => { if (!cur?.id || !confirm('Supprimer ce projet ?')) return; await sb.from('google_ads_campaign_drafts').delete().eq('id', cur.id); setCur(null); load(); };

  if (loading) return <Card><CardContent className="flex items-center gap-2 p-6 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Chargement du catalogue et des projets…</CardContent></Card>;
  const ad = cur?.ad_content ?? {};
  const checks: Conflict[] = cur?.conflict_check?.items ?? [];

  return (
    <div className="space-y-4">
      <Card><CardContent className="flex flex-wrap items-center gap-3 p-4 text-sm">
        <Lock className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1 text-muted-foreground">Projets uniquement : aucune campagne n’est créée ni modifiée dans Google Ads. Conflits vérifiés contre la dernière lecture de l’Audit ({snap ? new Date(snap.taken_at).toLocaleString('fr-FR') : 'aucune'}). Produits issus du Catalogue publicitaire.</span>
        {canWrite && <Button size="sm" onClick={() => setCur(blank(user.id))}><Plus className="mr-1 h-4 w-4" />Nouveau projet</Button>}
      </CardContent></Card>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Projets ({drafts.length})</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {drafts.length === 0 && <p className="text-xs text-muted-foreground">Aucun projet. Créez-en un ou partez d’une « Nouvelle campagne proposée » dans Stratégie IA.</p>}
            {drafts.map((d) => (
              <button key={d.id} onClick={() => setCur(d)} className={`w-full rounded border p-2 text-left text-sm hover:bg-muted/50 ${cur?.id === d.id ? 'border-primary' : ''}`}>
                <div className="font-medium">{d.name}</div>
                <div className="mt-1 flex flex-wrap gap-1"><Badge variant="outline">{TYPES[d.campaign_type]}</Badge><Badge variant={STATUS[d.status]?.v}>{STATUS[d.status]?.l}</Badge>{d.source === 'ia' && <Badge variant="secondary">IA</Badge>}</div>
                <div className="mt-1 text-xs text-muted-foreground">{d.countries.join(', ')} · {d.daily_budget ?? '—'} €/j</div>
              </button>))}
          </CardContent></Card>

        {!cur ? <Card><CardContent className="p-6 text-sm text-muted-foreground">Sélectionnez ou créez un projet.</CardContent></Card> : (
          <Card><CardHeader className="pb-2"><CardTitle className="flex flex-wrap items-center gap-2 text-base">{cur.id ? 'Modifier le projet' : 'Nouveau projet'}<Badge variant={STATUS[cur.status]?.v}>{STATUS[cur.status]?.l}</Badge></CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="md:col-span-2"><div className="text-xs text-muted-foreground">Nom</div><Input value={cur.name} disabled={locked} onChange={(e) => set({ name: e.target.value })} /></div>
                <div><div className="text-xs text-muted-foreground">Type</div>
                  <Select value={cur.campaign_type} disabled={locked} onValueChange={(v) => set({ campaign_type: v, bidding: { ...cur.bidding, strategy: BIDS[v][0] } })}>
                    <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(TYPES).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select></div>
                <div><div className="text-xs text-muted-foreground">Pays (codes, ex. FR, BE)</div><Input defaultValue={cur.countries.join(', ')} key={`c${cur.id}${cur.countries.join()}`} disabled={locked} onBlur={(e) => set({ countries: csv(e.target.value) })} /></div>
                <div><div className="text-xs text-muted-foreground">Langues (ex. fr, en)</div><Input defaultValue={cur.languages.join(', ')} key={`l${cur.id}`} disabled={locked} onBlur={(e) => set({ languages: csv(e.target.value).map((x) => x.toLowerCase()) })} /></div>
                <div><div className="text-xs text-muted-foreground">Budget quotidien (€)</div><Input type="number" min={0} value={cur.daily_budget ?? ''} disabled={locked} onChange={(e) => set({ daily_budget: e.target.value })} />
                  <div className="text-xs text-muted-foreground">≈ {Math.round((Number(cur.daily_budget) || 0) * 30.4)} €/mois</div></div>
                <div><div className="text-xs text-muted-foreground">Enchères</div>
                  <Select value={cur.bidding.strategy} disabled={locked} onValueChange={(v) => set({ bidding: { ...cur.bidding, strategy: v } })}>
                    <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{BIDS[cur.campaign_type].map((b) => <SelectItem key={b} value={b}>{BID_L[b]}</SelectItem>)}</SelectContent></Select></div>
                {['MAXIMIZE_CONVERSION_VALUE', 'TARGET_ROAS'].includes(cur.bidding.strategy) && <div><div className="text-xs text-muted-foreground">ROAS cible (%, facultatif)</div><Input type="number" value={cur.bidding.target_roas ?? ''} disabled={locked} onChange={(e) => set({ bidding: { ...cur.bidding, target_roas: e.target.value ? Number(e.target.value) : null } })} /></div>}
                {cur.bidding.strategy === 'MAXIMIZE_CONVERSIONS' && <div><div className="text-xs text-muted-foreground">CPA cible (€, facultatif)</div><Input type="number" value={cur.bidding.target_cpa ?? ''} disabled={locked} onChange={(e) => set({ bidding: { ...cur.bidding, target_cpa: e.target.value ? Number(e.target.value) : null } })} /></div>}
              </div>
              <p className="text-xs text-muted-foreground">Objectif d’enchères : uniquement les achats (catégorie PURCHASE), comme les campagnes actives — les microconversions wetracked.io ne doivent pas piloter les enchères.</p>

              {cur.campaign_type !== 'SEARCH' && (
                <div className="space-y-2 rounded border p-3">
                  <div className="font-medium">Produits Merchant</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select value={cur.products.selection_id ?? ''} disabled={locked} onValueChange={(v) => set({ products: { ...cur.products, selection_id: v } })}>
                      <SelectTrigger className="w-72"><SelectValue placeholder="Sélection du Catalogue publicitaire" /></SelectTrigger>
                      <SelectContent>{selections.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.kind === 'fixed' ? 'fixe' : 'dynamique'})</SelectItem>)}</SelectContent></Select>
                    <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={!!cur.products.eligible_only} disabled={locked} onChange={(e) => set({ products: { ...cur.products, eligible_only: e.target.checked } })} />Éligibles uniquement</label>
                  </div>
                  {selections.length === 0 && <p className="text-xs text-muted-foreground">Créez d’abord une sélection dans l’onglet Catalogue publicitaire.</p>}
                  {sel && <div className="text-xs">{picked.all.length} variantes dans la sélection · <b>{picked.eligible.length} retenues</b> · {Object.entries(picked.perCountry).map(([c, n]) => `${c} : ${statusCache[c] ? `${n} éligibles` : '…'}`).join(' · ')}</div>}
                  {picked.eligible.length > 0 && <ul className="max-h-32 overflow-auto text-xs text-muted-foreground">{picked.eligible.slice(0, 40).map((v) => <li key={v.key}>{v.title} — {v.color}{v.sku ? ` · ${v.sku}` : ''}</li>)}{picked.eligible.length > 40 && <li>… et {picked.eligible.length - 40} autres</li>}</ul>}
                </div>)}

              {cur.campaign_type !== 'SHOPPING' && (
                <div className="space-y-3 rounded border p-3">
                  <div className="font-medium">Éléments publicitaires</div>
                  <div><div className="text-xs text-muted-foreground">URL finale</div><Input value={ad.final_url ?? ''} disabled={locked} onChange={(e) => setAd({ final_url: e.target.value })} /></div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <LinesField label="Titres (un par ligne)" value={ad.headlines ?? []} max={30} disabled={locked} onChange={(v) => setAd({ headlines: v })} />
                    <LinesField label="Descriptions" value={ad.descriptions ?? []} max={90} disabled={locked} onChange={(v) => setAd({ descriptions: v })} />
                    {cur.campaign_type === 'PERFORMANCE_MAX' && <>
                      <LinesField label="Titres longs" value={ad.long_headlines ?? []} max={90} disabled={locked} onChange={(v) => setAd({ long_headlines: v })} />
                      <LinesField label="Thèmes de recherche (signaux)" value={ad.search_themes ?? []} disabled={locked} onChange={(v) => setAd({ search_themes: v })} />
                    </>}
                    {cur.campaign_type === 'SEARCH' && <>
                      <LinesField label='Mots-clés ("expression", [exact], sinon large)' value={ad.keywords ?? []} disabled={locked} onChange={(v) => setAd({ keywords: v })} />
                      <LinesField label="Mots-clés négatifs" value={ad.negatives ?? []} disabled={locked} onChange={(v) => setAd({ negatives: v })} />
                    </>}
                  </div>
                </div>)}
              {cur.campaign_type === 'SHOPPING' && <p className="text-xs text-muted-foreground">Shopping n’utilise pas de textes : les annonces viennent des fiches Merchant. Priorité et subdivision des groupes de produits définies à la publication.</p>}

              <div><div className="text-xs text-muted-foreground">Notes / justification</div><Textarea rows={4} value={cur.notes ?? ''} disabled={locked} onChange={(e) => set({ notes: e.target.value })} /></div>

              {cur.conflict_check && <div className="space-y-1 rounded border p-3">
                <div className="font-medium">Vérification du {new Date(cur.conflict_check.at).toLocaleString('fr-FR')}{cur.conflict_check.snapshot_at && <span className="text-xs text-muted-foreground"> · structure lue le {new Date(cur.conflict_check.snapshot_at).toLocaleString('fr-FR')}</span>}</div>
                {checks.length === 0 && <p className="text-xs">Aucun conflit détecté.</p>}
                {checks.map((c, i) => <div key={i} className="flex gap-2 text-xs"><Badge variant={c.level === 'bloquant' ? 'destructive' : c.level === 'attention' ? 'default' : 'outline'}>{c.level}</Badge><span>{c.campaign && <b>{c.campaign} : </b>}{c.message}</span></div>)}
                <p className="text-xs text-muted-foreground">Chevauchements estimés depuis les groupes de fiches et les produits diffusés sur 90 j : hypothèses à confirmer.</p>
              </div>}

              {canWrite && <div className="flex flex-wrap gap-2">
                <Button onClick={() => save().then((d) => d && toast.success('Projet enregistré'))} disabled={busy || locked}><Save className="mr-1 h-4 w-4" />Enregistrer</Button>
                <Button variant="outline" onClick={check} disabled={busy || locked}><ShieldCheck className="mr-1 h-4 w-4" />Vérifier les conflits</Button>
                <Button variant="outline" onClick={validate} disabled={busy || locked || cur.status === 'valide'}><CheckCircle2 className="mr-1 h-4 w-4" />Valider le projet</Button>
                {cur.id && <Button variant="ghost" onClick={() => save({ status: cur.status === 'archive' ? 'brouillon' : 'archive' })} disabled={busy}>{cur.status === 'archive' ? 'Désarchiver' : 'Archiver'}</Button>}
                {cur.id && <Button variant="ghost" onClick={remove}><Trash2 className="mr-1 h-4 w-4" />Supprimer</Button>}
              </div>}
              <p className="text-xs text-muted-foreground">Toute modification d’un projet validé le repasse en brouillon. Publication Google Ads désactivée.</p>
            </CardContent></Card>)}
      </div>
    </div>
  );
}
