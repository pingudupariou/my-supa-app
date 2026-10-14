import { Fragment, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Loader2, ArrowLeft, AlertTriangle } from 'lucide-react';
import type { ErplainVariantRow } from './useErplainCatalog';

const eur = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${v.toFixed(2)} €`);

const METHODS: { key: string; label: string; help: string }[] = [
  { key: 'cump_finished', label: 'CUMP produit fini', help: 'unit_cost du produit fini' },
  { key: 'components_plus_mfg', label: 'Composants + frais de fabrication confirmés', help: 'coût composants + unit_manufacturing_cost, si la documentation confirme que ce dernier ne contient que la fabrication' },
  { key: 'confirmed_full', label: 'Coût complet confirmé', help: 'unit_manufacturing_cost seul, si la documentation confirme qu\'il inclut déjà les composants' },
];

export function ErplainProducts({ variants, onCostRead }: { variants: ErplainVariantRow[]; onCostRead?: (at: string) => void }) {
  const [search, setSearch] = useState('');
  const [onlyBom, setOnlyBom] = useState(true);
  const [detail, setDetail] = useState<any | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return variants
      .filter(v => (!onlyBom || v.bom || v.bomCount > 0))
      .filter(v => !q || `${v.sku ?? ''} ${v.label ?? ''}`.toLowerCase().includes(q))
      .sort((a, b) => (a.label ?? '').localeCompare(b.label ?? ''))
      .slice(0, 300);
  }, [variants, search, onlyBom]);

  const open = async (id: string) => {
    setLoadingId(id); setError(null);
    const { data, error } = await supabase.functions.invoke('erplain-sync', { body: { action: 'costflow_variant', variantId: id } });
    setLoadingId(null);
    if (error || data?.status !== 'success') { setError(data?.message || error?.message || 'Lecture Erplain impossible'); return; }
    setDetail(data); onCostRead?.(data.readAt);
  };

  if (detail) {
    const v = detail.variant;
    return (
      <div className="space-y-4" data-readonly-allow="true">
        <Button variant="ghost" size="sm" onClick={() => setDetail(null)}><ArrowLeft className="h-4 w-4 mr-1" /> Retour</Button>
        <Card>
          <CardHeader><CardTitle className="text-base">{v.label} <span className="text-muted-foreground font-mono text-sm">{v.sku}</span></CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            <div><p className="text-muted-foreground text-xs">CUMP produit fini</p><p className="font-mono-numbers font-medium">{eur(v.unit_cost)}</p></div>
            <div><p className="text-muted-foreground text-xs">Dernier prix d'achat</p><p className="font-mono-numbers">{eur(v.last_purchased_price)}</p></div>
            <div><p className="text-muted-foreground text-xs">unit_manufacturing_cost</p><p className="font-mono-numbers">{eur(v.unit_manufacturing_cost)}</p></div>
            <div><p className="text-muted-foreground text-xs">Coût composants</p><p className="font-mono-numbers font-medium">{detail.totals.componentsCump === null ? <span className="text-destructive">Incomplet ({eur(detail.totals.partialCump)} partiel)</span> : eur(detail.totals.componentsCump)}</p></div>
            <div><p className="text-muted-foreground text-xs">Nomenclature</p><p>{detail.bom?.label ?? '—'}</p></div>
          </CardContent>
        </Card>
        {detail.analysis && <CostMethodCard detail={detail} onSaved={() => open(v.id)} />}
        <div className="text-xs text-muted-foreground rounded border p-3 space-y-1">
          <p>Coûts lus en direct dans Erplain le {new Date(detail.readAt).toLocaleString('fr-FR')} (variante #{v.id}{v.sku ? '' : ', sans SKU'}).</p>
          <p><b>Champs :</b> CUMP = <code>unit_cost</code> · dernier prix d'achat = <code>last_purchased_price</code> · coût de fabrication = <code>unit_manufacturing_cost</code> (signification non documentée par Erplain : jamais ajouté sans méthode confirmée).</p>
          <p><b>Coût composants :</b> Σ (quantité × <code>unit_cost</code>) des composants directs de la nomenclature retenue. Un sous-ensemble compte une fois à son propre CUMP ; ses composants sont informatifs. Un coût absent reste « — » : le total est alors marqué incomplet, jamais complété par zéro.</p>
        </div>
        {(detail.warnings.length > 0 || detail.totals.missing > 0) && (
          <div className="text-sm text-destructive flex flex-col gap-1">
            {detail.warnings.map((w: string) => <span key={w} className="flex gap-1 items-center"><AlertTriangle className="h-4 w-4" />{w}</span>)}
            {detail.totals.missing > 0 && <span className="flex gap-1 items-center"><AlertTriangle className="h-4 w-4" />{detail.totals.missing} composant(s) sans CUMP, exclus du total.</span>}
          </div>
        )}
        <div className="border rounded overflow-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Composant</TableHead><TableHead>SKU</TableHead><TableHead className="text-right">Qté</TableHead>
              <TableHead className="text-right">CUMP</TableHead><TableHead className="text-right">Dernier achat</TableHead><TableHead className="text-right">Total ligne</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {detail.lines.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Aucune nomenclature retenue.</TableCell></TableRow>}
              {detail.lines.map((l: any) => (
                <Fragment key={l.id}>
                  <TableRow>
                    <TableCell className="font-medium">{l.label} {l.isSubAssembly && <Badge variant="secondary" className="ml-1">Sous-ensemble</Badge>}</TableCell>
                    <TableCell className="font-mono text-xs">{l.sku}</TableCell>
                    <TableCell className="text-right font-mono-numbers">{l.quantity}</TableCell>
                    <TableCell className="text-right font-mono-numbers">{eur(l.unit_cost)}</TableCell>
                    <TableCell className="text-right font-mono-numbers">{eur(l.last_purchased_price)}</TableCell>
                    <TableCell className="text-right font-mono-numbers font-medium">{l.unit_cost === null ? '—' : eur(l.quantity * l.unit_cost)}</TableCell>
                  </TableRow>
                  {l.children.map((c: any) => (
                    <TableRow key={`${l.id}-${c.id}`} className="text-muted-foreground text-xs">
                      <TableCell className="pl-8">↳ {c.label}</TableCell><TableCell className="font-mono">{c.sku}</TableCell>
                      <TableCell className="text-right">{c.quantity}</TableCell><TableCell className="text-right">{eur(c.unit_cost)}</TableCell>
                      <TableCell colSpan={2} className="text-right italic">info, non additionné</TableCell>
                    </TableRow>
                  ))}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground">CUMP = coût moyen pondéré Erplain. Un sous-ensemble compte une seule fois, à son propre CUMP. Lecture seule.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-readonly-allow="true">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher SKU ou nom..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button variant={onlyBom ? 'default' : 'outline'} size="sm" onClick={() => setOnlyBom(!onlyBom)}>
          {onlyBom ? 'Produits fabriqués' : 'Toutes les variantes'}
        </Button>
        <span className="text-xs text-muted-foreground">{rows.length} affichés (max 300)</span>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="border rounded overflow-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Produit / variante</TableHead><TableHead>SKU</TableHead><TableHead>Nomenclature</TableHead>
            <TableHead className="text-right">Composants</TableHead><TableHead className="text-right">Utilisé dans</TableHead>
            <TableHead className="text-right">Stock réel</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Aucune donnée Erplain. Lancez une synchronisation depuis le Plan atelier.</TableCell></TableRow>}
            {rows.map(v => (
              <TableRow key={v.id} className="cursor-pointer hover:bg-muted/50" onClick={() => open(v.id)}>
                <TableCell className="font-medium">{v.label ?? '—'}</TableCell>
                <TableCell className="font-mono text-xs">{v.sku ?? '—'}</TableCell>
                <TableCell>{v.bom ? v.bom.label ?? 'Par défaut' : v.bomCount > 1 ? <Badge variant="destructive">Ambiguë ({v.bomCount})</Badge> : '—'}</TableCell>
                <TableCell className="text-right font-mono-numbers">{v.bom?.components ?? '—'}</TableCell>
                <TableCell className="text-right font-mono-numbers">{v.usedIn || '—'}</TableCell>
                <TableCell className="text-right font-mono-numbers">{v.on_hand}</TableCell>
                <TableCell>{loadingId === v.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="text-xs text-primary">Coûts →</span>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function CostMethodCard({ detail, onSaved }: { detail: any; onSaved: () => void }) {
  const a = detail.analysis; const v = detail.variant;
  const [method, setMethod] = useState<string>(a.method?.method ?? '');
  const [source, setSource] = useState<string>(a.method?.source ?? '');
  const [saving, setSaving] = useState(false); const [err, setErr] = useState<string | null>(null);
  const save = async (m: string | null) => {
    setSaving(true); setErr(null);
    const { data, error } = await supabase.functions.invoke('erplain-sync', { body: { action: 'costflow_set_method', variantId: v.id, method: m, source } });
    setSaving(false);
    if (error || data?.status !== 'success') { setErr(data?.message || data?.error || error?.message || 'Enregistrement impossible'); return; }
    onSaved();
  };
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Coût de revient complet</CardTitle></CardHeader>
      <CardContent className="text-sm space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><p className="text-muted-foreground text-xs">Coût de revient complet</p><p className="font-mono-numbers font-semibold">{a.cost.value === null ? <span className="text-destructive">{a.cost.status === 'unconfirmed' ? 'Coût complet non confirmé' : 'Donnée manquante'}</span> : eur(a.cost.value)}</p></div>
          <div className="md:col-span-2"><p className="text-muted-foreground text-xs">Méthode et source</p><p className="text-xs">{a.cost.formula}{a.method ? <> · source : « {a.method.source} » ({new Date(a.method.updated_at).toLocaleDateString('fr-FR')})</> : null}</p></div>
          <div><p className="text-muted-foreground text-xs">Écart CUMP − coût composants</p><p className="font-mono-numbers">{eur(a.gapCump)}</p></div>
        </div>
        <p className="text-xs text-muted-foreground">Un écart entre CUMP et coût composants peut venir de fabrications ou achats passés à d'autres prix, d'une nomenclature modifiée, d'un produit aussi acheté fini, d'ajustements de stock — ou de frais de fabrication inclus dans le CUMP. Aucune conclusion n'est tirée automatiquement.</p>
        <div className="rounded border p-3 space-y-2" data-readonly-allow="false">
          <p className="text-xs font-medium">Choisir une méthode documentée</p>
          {METHODS.map(m => (
            <label key={m.key} className="flex gap-2 items-start text-xs cursor-pointer">
              <input type="radio" name="cost-method" checked={method === m.key} onChange={() => setMethod(m.key)} className="mt-0.5" />
              <span><b>{m.label}</b> — {m.help}</span>
            </label>
          ))}
          <Input placeholder="Source : doc Erplain, réponse du support, vérification interne…" value={source} onChange={e => setSource(e.target.value)} className="h-8 text-xs" />
          <div className="flex gap-2">
            <Button size="sm" disabled={!method || source.trim().length < 3 || saving} onClick={() => save(method)}>{saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Enregistrer la méthode'}</Button>
            {a.method && <Button size="sm" variant="outline" disabled={saving} onClick={() => save(null)}>Retirer</Button>}
          </div>
          {err && <p className="text-xs text-destructive">{err}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
