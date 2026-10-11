import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ListPlus, Loader2, RotateCcw, ScanSearch } from 'lucide-react';
import { toast } from 'sonner';
import { createFromRecommendation } from '../tasks/taskApi';
import { notifyTasksChanged } from '../tasks/MarketingTasks';

type Finding = { kind: string; scope: string; title: string; fact: string; hypothesis: string | null; confidence: string };
type Action = { priority: number; urgency?: string; category: string; title: string; detail: string; country: string | null; campaign: string | null; expected_impact: string; confidence: string; justification: string };
type Result = { summary: string; findings: Finding[]; actions: Action[]; data_limits: string[] };

const KIND: Record<string, string> = { anomalie: 'Anomalie', tendance: 'Tendance', opportunite: 'Opportunité', ecart_donnees: 'Écart de données' };
const URG: Record<string, string> = { immediate: 'Immédiat', cette_semaine: 'Cette semaine', ce_mois: 'Ce mois', a_surveiller: 'À surveiller' };

/** Diagnostic IA : envoie uniquement le résumé chiffré du cockpit ; résultat mis en cache côté serveur. */
export function AiDiagnosis({ summary, from, to, filters, canWrite = false }: { summary: unknown; from: string; to: string; filters: unknown; canWrite?: boolean }) {
  const [made, setMade] = useState<Record<number, string>>({});
  const toTask = async (a: Action, i: number) => {
    try { const r = await createFromRecommendation(a, res?.id ?? null); setMade((m) => ({ ...m, [i]: r.duplicate ? 'Déjà suivie (récurrence +1)' : 'Tâche créée' })); toast.success(r.duplicate ? 'Une tâche ouverte existe déjà : récurrence enregistrée' : 'Tâche créée'); notifyTasksChanged(); }
    catch (e: any) { toast.error(e.message ?? 'Erreur'); }
  };
  const [res, setRes] = useState<{ id?: string | null; result: Result; cached: boolean; created_at: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const run = async (force = false) => {
    setLoading(true); setErr(''); setMade({});
    const { data, error } = await supabase.functions.invoke('marketing-ai', { body: { summary, from, to, filters, force } });
    setLoading(false);
    if (error) {
      let msg = error.message; try { msg = (await (error as any).context?.json())?.error ?? msg; } catch { /* */ }
      setErr(msg); return;
    }
    if (data?.error) { setErr(data.error); return; }
    setRes(data);
  };
  const r = res?.result;
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
          <div className="text-sm text-muted-foreground max-w-2xl">Analyse la période et les filtres affichés, à partir des chiffres du cockpit uniquement. Une analyse identique déjà faite est réaffichée sans coût.</div>
          <div className="flex gap-2">
            <Button onClick={() => run(false)} disabled={loading}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanSearch className="mr-2 h-4 w-4" />}Analyser la période</Button>
            {res && <Button variant="outline" onClick={() => run(true)} disabled={loading}><RotateCcw className="mr-2 h-4 w-4" />Relancer</Button>}
          </div>
        </CardContent>
      </Card>
      {loading && <p className="text-sm text-muted-foreground">Analyse en cours, cela peut prendre jusqu'à une minute…</p>}
      {err && <Card className="border-destructive"><CardContent className="pt-6 text-sm text-destructive">{err}</CardContent></Card>}
      {r && (<>
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Synthèse</CardTitle>
          <p className="text-xs text-muted-foreground">{res!.cached ? 'Analyse en cache' : 'Nouvelle analyse'} · {new Date(res!.created_at).toLocaleString('fr-FR')}</p></CardHeader>
          <CardContent className="text-sm">{r.summary}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Actions prioritaires</CardTitle></CardHeader>
          <CardContent className="space-y-3">{[...r.actions].sort((a, b) => a.priority - b.priority).map((a, i) => (
            <div key={i} className="rounded-md border p-3 text-sm space-y-1">
              <div className="flex flex-wrap items-center gap-2"><Badge>{a.priority}</Badge><span className="font-medium">{a.title}</span><Badge variant="secondary">{a.category}</Badge>
                {a.country && <Badge variant="outline">{a.country}</Badge>}{a.campaign && <Badge variant="outline">{a.campaign}</Badge>}{a.urgency && <Badge variant={a.urgency === 'immediate' ? 'destructive' : 'outline'}>Urgence : {URG[a.urgency] ?? a.urgency}</Badge>}<Badge variant="outline">Confiance {a.confidence}</Badge>
                {canWrite && <Button size="sm" variant="outline" className="ml-auto" disabled={!!made[i]} onClick={() => toTask(a, i)}><ListPlus className="mr-1 h-4 w-4" />{made[i] ?? 'Créer une tâche'}</Button>}</div>
              <p>{a.detail}</p>
              <p className="text-muted-foreground"><span className="font-medium text-foreground">Impact attendu :</span> {a.expected_impact}</p>
              <p className="text-muted-foreground"><span className="font-medium text-foreground">Justification :</span> {a.justification}</p>
            </div>))}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Constats</CardTitle></CardHeader>
          <CardContent className="space-y-3">{r.findings.map((f, i) => (
            <div key={i} className="rounded-md border p-3 text-sm space-y-1">
              <div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">{KIND[f.kind] ?? f.kind}</Badge><Badge variant="outline">{f.scope}</Badge><span className="font-medium">{f.title}</span><Badge variant="outline">Confiance {f.confidence}</Badge></div>
              <p><span className="font-medium">Fait mesuré :</span> {f.fact}</p>
              {f.hypothesis && <p className="text-muted-foreground"><span className="font-medium text-foreground">Hypothèse :</span> {f.hypothesis}</p>}
            </div>))}</CardContent></Card>
        {r.data_limits.length > 0 && <Card><CardHeader className="pb-2"><CardTitle className="text-base">Limites des données</CardTitle></CardHeader>
          <CardContent><ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">{r.data_limits.map((d, i) => <li key={i}>{d}</li>)}</ul></CardContent></Card>}
      </>)}
    </div>
  );
}
