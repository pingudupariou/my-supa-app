import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, AlertTriangle } from 'lucide-react';
import type { CostFlowProduct } from '@/hooks/useCostFlowData';

const eur = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${v.toFixed(2)} €`);
const STATUS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  matched: { label: 'Correspondance', variant: 'default' },
  ambiguous: { label: 'Ambiguë', variant: 'destructive' },
  erplain_only: { label: 'Erplain seul', variant: 'outline' },
  ref_not_in_bom: { label: 'Réf. connue, hors nomenclature', variant: 'secondary' },
  manual_only: { label: 'Manuel seul', variant: 'secondary' },
};

export function ErplainComparison({ products }: { products: CostFlowProduct[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [result, setResult] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < 3 ? [...s, id] : s));

  const run = async (nextChoices = choices) => {
    setLoading(true); setError(null);
    const { data, error } = await supabase.functions.invoke('erplain-sync', { body: { action: 'costflow_preview', productIds: selected, variantChoices: nextChoices } });
    setLoading(false);
    if (error || data?.status !== 'success') { setError(data?.message || error?.message || 'Lecture Erplain impossible'); return; }
    setResult(data.products);
  };

  return (
    <div className="space-y-4" data-readonly-allow="true">
      <Card>
        <CardHeader><CardTitle className="text-base">Aperçu Erplain — comparaison avec les données manuelles</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">Lecture seule : rien n'est modifié dans Erplain ni dans CostFlow. Choisissez jusqu'à 3 produits.</p>
          <div className="flex flex-wrap gap-2 max-h-40 overflow-auto">
            {products.map((p) => (
              <Button key={p.id} size="sm" variant={selected.includes(p.id) ? 'default' : 'outline'} onClick={() => toggle(p.id)}>{p.name}</Button>
            ))}
          </div>
          <Button disabled={!selected.length || loading} onClick={() => { setChoices({}); run({}); }}>
            {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Comparer avec Erplain
          </Button>
          {error && <p className="text-destructive">{error}</p>}
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">Champs de coût Erplain lus</summary>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              <li><b>unit_cost</b> — coût unitaire moyen pondéré (CUMP) du stock : base de comparaison.</li>
              <li><b>last_purchased_price</b> / <b>last_cost</b> — dernier prix d'achat / dernier coût d'entrée.</li>
              <li><b>initial_cost</b> — coût saisi à la création de l'article.</li>
              <li><b>unit_manufacturing_cost</b> — coût de fabrication (gamme) d'un assemblage.</li>
              <li>Le schéma Erplain ne documente pas ces champs : signification à confirmer sur ces 3 produits.</li>
              <li>Sous-ensembles : comptés une seule fois avec leur propre coût ; leurs composants sont affichés pour information, jamais additionnés.</li>
            </ul>
          </details>
        </CardContent>
      </Card>

      {result?.map((p) => (
        <Card key={p.productId}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex flex-wrap items-center gap-2">
              {p.name}
              {p.variant ? <Badge variant="outline">Erplain #{p.variant.id} · {p.variant.sku || 'sans SKU'}</Badge> : <Badge variant="destructive">Variante non identifiée</Badge>}
              {p.matchStatus === 'exact' && <Badge>Nom exact</Badge>}
              {p.bom && <Badge variant="secondary">Nomenclature {p.bom.label || p.bom.id}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {p.error && <p className="text-destructive">{p.error}</p>}
            {!p.variant && p.candidates?.length > 0 && (
              <div className="space-y-1">
                <p className="text-muted-foreground">Correspondance ambiguë — choisissez la variante Erplain :</p>
                <div className="flex flex-wrap gap-2">
                  {p.candidates.map((c: any) => (
                    <Button key={c.id} size="sm" variant="outline" onClick={() => { const n = { ...choices, [p.productId]: c.id }; setChoices(n); run(n); }}>
                      #{c.id} {c.label} {c.sku ? `(${c.sku})` : ''} · {c.type}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            {!p.variant && !p.candidates?.length && !p.error && <p className="text-muted-foreground">Aucune variante Erplain trouvée pour ce nom.</p>}
            {p.warnings?.map((w: string) => <p key={w} className="text-warning flex gap-1"><AlertTriangle className="h-4 w-4" />{w}</p>)}
            {p.totals && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                <Stat label={`Manuel @${p.tier} (hors coef.)`} value={eur(p.totals.manual)} />
                <Stat label="Composants Erplain (CUMP)" value={eur(p.totals.erplainComponentsCump)} hint={p.totals.erplainCumpMissing ? `${p.totals.erplainCumpMissing} coût(s) manquant(s)` : undefined} />
                <Stat label="Écart" value={eur(p.totals.erplainComponentsCump - p.totals.manual)} />
                <Stat label="CUMP produit fini" value={eur(p.totals.variantCump)} />
                <Stat label="Coût fabrication" value={eur(p.totals.manufacturing)} />
              </div>
            )}
            {p.lines?.length > 0 && (
              <div className="border rounded overflow-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Statut</TableHead><TableHead>Erplain (ID · SKU)</TableHead><TableHead>Manuel (code)</TableHead>
                    <TableHead className="text-right">Qté E / M</TableHead><TableHead className="text-right">CUMP</TableHead>
                    <TableHead className="text-right">Dern. achat</TableHead><TableHead className="text-right">Fabrication</TableHead>
                    <TableHead className="text-right">Prix manuel</TableHead><TableHead className="text-right">Écart unit.</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {p.lines.map((l: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell><Badge variant={STATUS[l.status]?.variant}>{STATUS[l.status]?.label}</Badge>{l.missingCost && <Badge variant="destructive" className="ml-1">Coût manquant</Badge>}</TableCell>
                        <TableCell className="text-xs">
                          {l.erplain ? <>#{l.erplain.id} · {l.erplain.sku || '—'}<div className="text-muted-foreground">{l.erplain.label}{l.erplain.isSubAssembly && ' · sous-ensemble'}</div>
                            {l.erplain.children?.length > 0 && <div className="text-muted-foreground">↳ {l.erplain.children.length} composants (info, Σ CUMP {eur(l.erplain.childrenCump)})</div>}</> : '—'}
                          {l.ambiguousRefs && <div className="text-destructive">Plusieurs réf. manuelles : {l.ambiguousRefs.map((r: any) => r.code).join(', ')}</div>}
                        </TableCell>
                        <TableCell className="text-xs">{l.manual ? <>{l.manual.code}<div className="text-muted-foreground">{l.manual.name}</div></> : '—'}</TableCell>
                        <TableCell className={`text-right font-mono-numbers ${l.qtyGap ? 'negative-value' : ''}`}>{l.erplain?.quantity ?? '—'} / {l.manual?.quantity ?? '—'}</TableCell>
                        <TableCell className="text-right font-mono-numbers">{eur(l.erplain?.unit_cost)}</TableCell>
                        <TableCell className="text-right font-mono-numbers">{eur(l.erplain?.last_purchased_price ?? l.erplain?.last_cost)}</TableCell>
                        <TableCell className="text-right font-mono-numbers">{eur(l.erplain?.unit_manufacturing_cost)}</TableCell>
                        <TableCell className="text-right font-mono-numbers">{eur(l.manual?.unitPrice)}</TableCell>
                        <TableCell className="text-right font-mono-numbers">{eur(l.unitGap)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded border p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-mono-numbers font-semibold">{value}</div>
      {hint && <div className="text-xs text-destructive">{hint}</div>}
    </div>
  );
}
