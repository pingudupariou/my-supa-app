import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, ListPlus } from 'lucide-react';
import { toast } from 'sonner';
import { createFromRecommendation } from '@/components/marketing/tasks/taskApi';
import { notifyTasksChanged } from '@/components/marketing/tasks/MarketingTasks';

const BUDGET_KEY = 'novaride.strategy.budget';
const eur = (n: number | null | undefined) => (n == null ? '—' : `${Math.round(n).toLocaleString('fr-FR')} €`);
const VERDICT: Record<string, { l: string; v: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  renforcer: { l: 'Renforcer', v: 'default' }, maintenir: { l: 'Maintenir', v: 'secondary' }, surveiller: { l: 'Surveiller', v: 'outline' },
  reduire: { l: 'Réduire', v: 'destructive' }, restructurer: { l: 'Restructurer', v: 'outline' },
};
const SCEN: Record<string, string> = { prudent: 'Prudent', reference: 'Référence', croissance: 'Croissance' };

function Meta({ r }: { r: any }) {
  return (
    <div className="flex flex-wrap gap-1 text-xs">
      <Badge variant={r.priority === 'haute' ? 'default' : 'outline'}>Priorité {r.priority}</Badge>
      <Badge variant="outline">Confiance {r.confidence}</Badge>
      <Badge variant="outline">{r.platform}</Badge>
      {r.country && <Badge variant="outline">{r.country}</Badge>}
      {r.period && <Badge variant="outline">{r.period}</Badge>}
      {r.monthly_budget_eur != null && <Badge variant="secondary">{eur(r.monthly_budget_eur)}/mois</Badge>}
    </div>
  );
}

function Reco({ r, canWrite, analysisId, extra }: { r: any; canWrite: boolean; analysisId: string | null; extra?: React.ReactNode }) {
  const [busy, setBusy] = useState(false);
  const toTask = async () => {
    setBusy(true);
    try {
      const res = await createFromRecommendation({
        title: r.title, detail: [r.detail, extra ? null : null, r.evidence && `Chiffres : ${r.evidence}`, r.hypothesis && `Hypothèse : ${r.hypothesis}`].filter(Boolean).join('\n\n'),
        expected_impact: r.kpis?.length ? `Indicateurs de suivi : ${r.kpis.join(', ')}` : null,
        justification: `Risques : ${r.risks}${r.monthly_budget_eur != null ? ` · Budget proposé : ${eur(r.monthly_budget_eur)}/mois` : ''} · Confiance ${r.confidence}`,
        category: r.platform === 'Merchant Center' || r.platform === 'Transversal' ? 'Google Ads' : r.platform, country: r.country, campaign: r.campaign,
        urgency: r.urgency ?? (r.priority === 'haute' ? 'cette_semaine' : r.priority === 'basse' ? 'a_surveiller' : 'ce_mois'), priority: r.order,
      }, analysisId);
      toast.success(res.duplicate ? 'Tâche existante mise à jour (recommandation récurrente)' : 'Tâche créée'); notifyTasksChanged();
    } catch (e: any) { toast.error(e.message ?? 'Erreur'); }
    setBusy(false);
  };
  return (
    <div className="space-y-1 rounded border p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="font-medium">{r.order ? `${r.order}. ` : ''}{r.title}</div>
        {canWrite && <Button size="sm" variant="ghost" className="h-7 shrink-0" onClick={toTask} disabled={busy}><ListPlus className="mr-1 h-4 w-4" />Créer une tâche</Button>}
      </div>
      <Meta r={r} />
      {extra}
      {r.detail && <p>{r.detail}</p>}
      <p><span className="text-muted-foreground">Chiffres : </span>{r.evidence}</p>
      {r.hypothesis && <p className="text-muted-foreground"><i>Hypothèse : {r.hypothesis}</i></p>}
      <p className="text-xs"><span className="text-muted-foreground">Risques : </span>{r.risks}</p>
      {r.kpis?.length > 0 && <p className="text-xs"><span className="text-muted-foreground">Suivi : </span>{r.kpis.join(' · ')}</p>}
    </div>
  );
}

export function AiStrategy({ canWrite }: { canWrite: boolean }) {
  const [budget, setBudget] = useState(() => Number(localStorage.getItem(BUDGET_KEY)) || 12000);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [rel, setRel] = useState<any>(null);

  const poll = async (id: string) => {
    for (let i = 0; i < 75; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const { data: row } = await (supabase as any).from('marketing_ai_analyses').select('id, result, created_at, updated_at, model, filters').eq('id', id).maybeSingle();
      const st = row?.result?._status;
      if (st === 'running' && Date.now() - new Date(row.updated_at).getTime() > 6 * 60000) { setLoading(false); setErr("L'analyse précédente a été interrompue. Cliquez à nouveau sur « Analyser la stratégie »."); return; }
      if (st === 'running') continue;
      setLoading(false);
      if (!row || st === 'error') { setErr(row?.result?.message ?? 'Analyse échouée'); return; }
      setData({ ...row, cached: false }); return;
    }
    setLoading(false); setErr("L'analyse prend plus de temps que prévu. Revenez dans quelques minutes.");
  };
  const run = async (opts: { force?: boolean; cache_only?: boolean } = {}) => {
    setLoading(true); setErr(null);
    localStorage.setItem(BUDGET_KEY, String(budget));
    const { data: d, error } = await supabase.functions.invoke('marketing-strategy', { body: { monthly_budget: budget, ...opts } });
    if (error) { setLoading(false); let msg = error.message; try { msg = (await (error as any).context?.json())?.error ?? msg; } catch { /* */ } setErr(msg); return; }
    if (d?.reliability) setRel(d.reliability);
    if (d?.pending && d.id) return poll(d.id);
    setLoading(false);
    if (d?.result) setData(d);
  };
  useEffect(() => { run({ cache_only: true }); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const r = data?.result;
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div>
            <div className="text-xs text-muted-foreground">Enveloppe de référence Google + Meta (€/mois)</div>
            <Input type="number" className="w-40" value={budget} min={0} onChange={(e) => setBudget(Number(e.target.value))} />
          </div>
          <Button onClick={() => run()} disabled={loading}>{loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}Analyser la stratégie</Button>
          {r && <Button variant="outline" onClick={() => run({ force: true })} disabled={loading}>Forcer une nouvelle analyse</Button>}
          <p className="w-full text-xs text-muted-foreground">
            Analyse 7/30/90/180/365 j de Shopify, Google Ads (structure comprise), Meta, GA4 et Merchant Center. Même données = résultat en cache, sans nouveau coût. Recommandations uniquement : rien n'est modifié dans Google Ads, Meta (géré par Crush AI), Merchant Center ou Erplain.
            {data && ` · ${data.cached ? 'Résultat en cache' : 'Nouvelle analyse'} du ${new Date(data.created_at).toLocaleString('fr-FR')}`}
          </p>
          {loading && <p className="text-xs text-muted-foreground">Analyse approfondie en cours, cela peut prendre 1 à 3 minutes…</p>}
          {err && <p className="w-full text-sm text-destructive">{err}</p>}
        </CardContent>
      </Card>

      {rel && <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base">Fiabilité des données
          <Badge variant={rel.level === 'fiable' ? 'default' : rel.level === 'correcte' ? 'secondary' : 'destructive'}>{rel.level === 'fiable' ? 'Fiable' : rel.level === 'correcte' ? 'Correcte' : 'Fragile'} · {rel.score}/100</Badge></CardTitle></CardHeader>
        <CardContent className="grid gap-1 text-sm md:grid-cols-2">{rel.checks.map((c: any, i: number) => (
          <div key={i} className="flex gap-2"><span className={c.level === 'ok' ? 'text-primary' : c.level === 'warn' ? 'text-muted-foreground' : 'text-destructive'}>{c.level === 'ok' ? '●' : c.level === 'warn' ? '◐' : '○'}</span>
            <span><span className="font-medium">{c.label}</span> <span className="text-muted-foreground">— {c.detail}</span></span></div>))}</CardContent></Card>}

      {!r && !loading && <Card><CardContent className="pt-6 text-sm text-muted-foreground">Aucune analyse pour les données actuelles. Lance « Analyser la stratégie ».</CardContent></Card>}
      {r && <>
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Synthèse stratégique</CardTitle></CardHeader>
          <CardContent className="whitespace-pre-line text-sm">{r.summary}</CardContent></Card>

        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Plan d'action priorisé</CardTitle></CardHeader>
          <CardContent className="space-y-2">{[...(r.action_plan ?? [])].sort((a, b) => a.order - b.order).map((x: any, i: number) => <Reco key={i} r={x} canWrite={canWrite} analysisId={data.id} />)}</CardContent></Card>

        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Campagnes : renforcer, maintenir, surveiller, réduire</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">{(r.verdicts ?? []).map((v: any, i: number) => (
            <div key={i} className="rounded border p-2">
              <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{v.campaign}</span><Badge variant={VERDICT[v.verdict]?.v ?? 'outline'}>{VERDICT[v.verdict]?.l ?? v.verdict}</Badge><Badge variant="outline">{v.platform}</Badge><Badge variant="outline">Confiance {v.confidence}</Badge></div>
              <p className="mt-1">{v.evidence}</p>
              {v.bidding_advice && <p className="text-xs"><span className="text-muted-foreground">Enchères : </span>{v.bidding_advice}</p>}
            </div>))}</CardContent></Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card><CardHeader className="pb-2"><CardTitle className="text-base">Opportunités de croissance</CardTitle></CardHeader>
            <CardContent className="space-y-2">{(r.opportunities ?? []).map((x: any, i: number) => <Reco key={i} r={x} canWrite={canWrite} analysisId={data.id} />)}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-base">Nouvelles campagnes proposées</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(r.new_campaigns ?? []).length === 0 && <p className="text-sm text-muted-foreground">Aucune nouvelle campagne jugée utile.</p>}
              {(r.new_campaigns ?? []).map((x: any, i: number) => <Reco key={i} r={x} canWrite={canWrite} analysisId={data.id} extra={
                <div className="space-y-0.5 rounded bg-muted/40 p-2 text-xs">
                  <div><b>Type :</b> {x.type} · <b>Objectif :</b> {x.objective}</div>
                  <div><b>Produits Merchant :</b> {x.products}</div>
                  <div><b>Paramètres :</b> {x.settings}</div>
                  <div><b>Chevauchement :</b> {x.overlap_check}</div>
                  <div className="text-muted-foreground">Projet de campagne : sera transformable dans le futur constructeur (aucune création maintenant).</div>
                </div>} />)}
            </CardContent></Card>
        </div>

        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Scénarios budgétaires (référence {eur(data.filters?.monthly_budget ?? budget)}/mois)</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">{(r.scenarios ?? []).map((s: any) => (
            <div key={s.name} className="space-y-1 rounded border p-3 text-sm">
              <div className="font-semibold">{SCEN[s.name] ?? s.name}</div>
              <div>Google {eur(s.google_monthly_eur)} · Meta {eur(s.meta_monthly_eur)} · <b>Total {eur(s.google_monthly_eur + s.meta_monthly_eur)}</b></div>
              <ul className="list-disc pl-4 text-xs">{s.reallocations.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul>
              <p className="text-xs"><span className="text-muted-foreground">Attendu : </span>{s.expected}</p>
              <p className="text-xs"><span className="text-muted-foreground">Conditions : </span>{s.conditions}</p>
            </div>))}</CardContent></Card>

        {r.data_limits?.length > 0 && <Card><CardHeader className="pb-2"><CardTitle className="text-base">Données manquantes ou incertaines</CardTitle></CardHeader>
          <CardContent><ul className="list-disc pl-5 text-sm">{r.data_limits.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul></CardContent></Card>}
      </>}
    </div>
  );
}
