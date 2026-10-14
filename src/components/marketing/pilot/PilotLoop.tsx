import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, Download, Check, X, ListPlus, ShieldCheck, Play, Hammer } from 'lucide-react';
import { toast } from 'sonner';
import { createFromRecommendation } from '@/components/marketing/tasks/taskApi';
import { notifyTasksChanged } from '@/components/marketing/tasks/MarketingTasks';
import { PilotDecisionCharts, DecisionData } from './PilotDecisionCharts';
import { Daily, shiftDay } from './decisionData';

const sb = supabase as any;
const eur = (n: number | null | undefined) => (n == null || !isFinite(n) ? '—' : `${Math.round(n).toLocaleString('fr-FR')} €`);
const KIND: Record<string, string> = { budget: 'Budget', bidding: 'Enchères', products: 'Produits', targeting: 'Ciblage', pause: 'Pause', new_campaign: 'Nouvelle campagne' };
const STATUS: Record<string, { l: string; v: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  proposee: { l: 'Proposée', v: 'outline' }, acceptee: { l: 'Acceptée', v: 'secondary' }, en_approbation: { l: "En attente d'approbation", v: 'secondary' },
  executee: { l: 'Appliquée dans Google Ads', v: 'default' }, appliquee_manuel: { l: 'Appliquée manuellement', v: 'default' },
  transformee: { l: 'Transformée en tâche/projet', v: 'secondary' }, rejetee: { l: 'Rejetée', v: 'destructive' },
};
const AUTO = new Set(['budget', 'bidding', 'pause']);
const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

type Metrics = { cost: number; conv: number; value: number; clicks: number; days: number };
function sum(rows: any[]): Metrics {
  const m = { cost: 0, conv: 0, value: 0, clicks: 0, days: new Set(rows.map((r) => r.day)).size };
  for (const r of rows) { m.cost += Number(r.cost); m.conv += Number(r.conversions); m.value += Number(r.conversions_value); m.clicks += Number(r.clicks); }
  return m;
}
const pct = (a: number, b: number) => (b ? `${a >= b ? '+' : ''}${Math.round(((a - b) / b) * 100)} %` : '—');

/** Before/after comparison on equal windows around the execution date (attributed Google values, not Shopify revenue). */
function Followup({ a }: { a: any }) {
  const [res, setRes] = useState<{ before: Metrics; after: Metrics; n: number } | null>(null);
  useEffect(() => {
    if (!a.campaign_id || !a.executed_at) return;
    const ex = new Date(a.executed_at); const day = (d: Date) => d.toISOString().slice(0, 10);
    const elapsed = Math.floor((Date.now() - ex.getTime()) / 864e5);
    const n = Math.min(30, Math.max(0, elapsed));
    if (n < 1) { setRes({ before: sum([]), after: sum([]), n: 0 }); return; }
    const start = new Date(ex.getTime() - n * 864e5), end = new Date(ex.getTime() + n * 864e5);
    sb.from('google_ads_campaign_daily').select('day,cost,conversions,conversions_value,clicks').eq('campaign_id', a.campaign_id).gte('day', day(start)).lte('day', day(end)).then(({ data }: any) => {
      const exd = day(ex); const rows = data ?? [];
      setRes({ n, before: sum(rows.filter((r: any) => r.day < exd)), after: sum(rows.filter((r: any) => r.day > exd)) });
    });
  }, [a.campaign_id, a.executed_at]);
  if (!a.campaign_id) return <p className="text-xs text-muted-foreground">Suivi : campagne non identifiée (suivre via l'Audit).</p>;
  if (!res) return null;
  if (res.n < 1) return <p className="text-xs text-muted-foreground">Suivi : premiers résultats dès demain (fenêtres égales avant/après).</p>;
  const { before: b, after: f } = res;
  const row = (l: string, x: string, y: string, d: string) => <tr className="border-t"><td className="p-1">{l}</td><td className="p-1">{x}</td><td className="p-1">{y}</td><td className="p-1">{d}</td></tr>;
  return (
    <div className="rounded bg-muted/40 p-2 text-xs">
      <div className="mb-1 font-medium">Suivi : {res.n} j après vs {res.n} j avant {res.n < 14 && <span className="font-normal text-muted-foreground">· apprentissage en cours, trop tôt pour conclure</span>}</div>
      <table className="w-full"><thead><tr className="text-left text-muted-foreground"><th className="p-1"></th><th className="p-1">Avant</th><th className="p-1">Après</th><th className="p-1">Écart</th></tr></thead><tbody>
        {row('Dépense', eur(b.cost), eur(f.cost), pct(f.cost, b.cost))}
        {row('Clics', String(b.clicks), String(f.clicks), pct(f.clicks, b.clicks))}
        {row('Conversions attribuées', b.conv.toFixed(1), f.conv.toFixed(1), pct(f.conv, b.conv))}
        {row('Valeur attribuée', eur(b.value), eur(f.value), pct(f.value, b.value))}
        {row('ROAS attribué', b.cost ? `${(b.value / b.cost).toFixed(2)}` : '—', f.cost ? `${(f.value / f.cost).toFixed(2)}` : '—', b.cost && f.cost ? pct(f.value / f.cost, b.value / b.cost) : '—')}
      </tbody></table>
      <p className="mt-1 text-muted-foreground">Valeurs attribuées par Google (pas le CA Shopify) ; saisonnalité et enchères concurrentes jouent aussi.</p>
    </div>
  );
}

export function PilotLoop({ canWrite }: { canWrite: boolean }) {
  const [rows, setRows] = useState<any[]>([]);
  const [publish, setPublish] = useState<Record<string, any>>({});
  const [analysis, setAnalysis] = useState<any>(null);
  const [snapCamps, setSnapCamps] = useState<any[]>([]);
  const [status, setStatus] = useState<{ write_enabled: boolean; is_admin: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<'open' | 'done' | 'all'>('open');
  const [decisionData, setDecisionData] = useState<DecisionData | null>(null);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const decisionRequest = useRef(false);
  const loadDecisionData = async () => {
    if (decisionData || decisionRequest.current) return;
    decisionRequest.current = true;
    setDecisionLoading(true); setDecisionError(null);
    try {
      const end = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
      const [daily, campaigns, snapshots] = await Promise.all([
        (async () => {
          const rows: Daily[] = [];
          for (let page = 0; ; page++) {
            const { data, error } = await sb.from('google_ads_campaign_daily')
              .select('campaign_id,day,cost,conversions,conversions_value,clicks,synced_at')
              .gte('day', shiftDay(end, -179)).lte('day', end)
              .order('day').order('campaign_id').order('customer_id').range(page * 1000, page * 1000 + 999);
            if (error) throw error;
            rows.push(...(data ?? []));
            if (!data || data.length < 1000) return rows;
          }
        })(),
        sb.from('google_ads_campaigns').select('id,name,channel_type').order('id'),
        sb.from('google_ads_structure_snapshots').select('taken_at,data').in('status', ['success', 'partial']).order('taken_at', { ascending: false }).limit(30),
      ]);
      if (campaigns.error) throw campaigns.error;
      if (snapshots.error) throw snapshots.error;
      const history = (snapshots.data ?? []).map((s: any) => ({ taken_at: s.taken_at, campaigns: Array.isArray(s.data?.campaigns) ? s.data.campaigns : null }));
      const known = new Map((campaigns.data ?? []).map((c: any) => [String(c.id), { id: c.id, name: c.name ?? String(c.id), type: c.channel_type }]));
      for (const s of [...history].reverse()) for (const c of s.campaigns ?? []) known.set(String(c.id), c);
      setDecisionData({ rows: daily, campaigns: [...known.values()] as DecisionData['campaigns'], snapshots: history });
    } catch { setDecisionError('Impossible de charger les données de décision.'); }
    finally { decisionRequest.current = false; setDecisionLoading(false); }
  };

  const load = useCallback(async () => {
    const [{ data: p }, { data: an }, { data: snap }] = await Promise.all([
      sb.from('google_ads_pilot_actions').select('*').order('created_at', { ascending: false }).limit(200),
      sb.from('marketing_ai_analyses').select('id, result, created_at').eq('kind', 'strategy').order('created_at', { ascending: false }).limit(5),
      sb.from('google_ads_structure_snapshots').select('data').in('status', ['success', 'partial']).order('taken_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    setRows(p ?? []);
    setAnalysis((an ?? []).find((x: any) => Array.isArray(x.result?.pilot_actions)) ?? null);
    setSnapCamps(snap?.data?.campaigns ?? []);
    const ids = (p ?? []).map((x: any) => x.publish_action_id).filter(Boolean);
    if (ids.length) { const { data: pa } = await sb.from('google_ads_publish_actions').select('id,status,summary,preflight,error').in('id', ids); setPublish(Object.fromEntries((pa ?? []).map((x: any) => [x.id, x]))); }
  }, []);
  useEffect(() => { load(); if (canWrite) supabase.functions.invoke('google-ads-publish', { body: { mode: 'status' } }).then(({ data }) => data && setStatus(data)); }, [load, canWrite]);

  const call = async (body: any) => {
    const { data, error } = await supabase.functions.invoke('google-ads-publish', { body });
    if (error) { let m = error.message; try { m = (await (error as any).context?.json())?.error ?? m; } catch { /* */ } throw new Error(m); }
    return data;
  };
  const run = async (id: string, fn: () => Promise<void>) => { setBusy(id); try { await fn(); } catch (e: any) { toast.error(e.message ?? 'Erreur'); } setBusy(null); load(); };

  const importable = useMemo(() => {
    if (!analysis) return [];
    const existing = new Set(rows.map((r) => r.dedupe_key));
    return (analysis.result.pilot_actions as any[]).map((x) => {
      const camp = x.campaign ? snapCamps.find((c) => norm(c.name) === norm(x.campaign)) : null;
      return { x, camp, key: `${x.kind}|${camp?.id ?? norm(x.campaign)}|${x.proposed_daily_budget_eur ?? ''}|${x.proposed_target_roas_pct ?? ''}|${norm(x.title).slice(0, 60)}` };
    }).filter((i) => !existing.has(i.key));
  }, [analysis, rows, snapCamps]);

  const doImport = () => run('import', async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw new Error('Veuillez vous reconnecter.');
    const ins = importable.map(({ x, camp, key }) => ({
      analysis_id: analysis.id, kind: x.kind, campaign_id: camp?.id ?? null, campaign_name: camp?.name ?? x.campaign, title: x.title,
      current_value: x.current, proposed_value: x.proposed, proposed_daily_budget: x.proposed_daily_budget_eur, proposed_target_roas: x.proposed_target_roas_pct,
       estimated_impact: x.estimated_impact, evidence: x.evidence, risks: x.risks, confidence: x.confidence, dedupe_key: key, created_by: u.user.id,
    }));
    if (!ins.length) return;
    const { error } = await sb.from('google_ads_pilot_actions').insert(ins);
    if (error) throw error;
    toast.success(`${ins.length} proposition(s) importée(s) — aucun appel IA`);
  });
  const setSt = (a: any, st: string, extra: any = {}) => run(a.id, async () => { const { error } = await sb.from('google_ads_pilot_actions').update({ status: st, ...extra }).eq('id', a.id); if (error) throw error; });
  const toTask = (a: any) => run(a.id, async () => {
    const r = await createFromRecommendation({ title: a.title, detail: [a.proposed_value, a.evidence && `Chiffres : ${a.evidence}`].filter(Boolean).join('\n\n'), expected_impact: a.estimated_impact, justification: `Risques : ${a.risks} · Confiance ${a.confidence}`, category: 'Google Ads', country: null, campaign: a.campaign_name, urgency: 'cette_semaine', priority: null } as any, a.analysis_id);
    await sb.from('google_ads_pilot_actions').update({ status: 'transformee', task_id: r?.id ?? null }).eq('id', a.id);
    notifyTasksChanged(); toast.success('Tâche créée');
  });
  const toDraft = (a: any) => {
    sessionStorage.setItem('novaride.builder.prefill', JSON.stringify({ title: a.title, type: 'Shopping', detail: a.proposed_value, settings: a.proposed_value, products: '', evidence: a.evidence, risks: a.risks, monthly_budget_eur: a.proposed_daily_budget ? a.proposed_daily_budget * 30 : null }));
    sb.from('google_ads_pilot_actions').update({ status: 'transformee' }).eq('id', a.id).then(load);
    window.dispatchEvent(new Event('novaride:open-builder'));
  };

  const shown = rows.filter((r) => filter === 'all' || (filter === 'open' ? ['proposee', 'acceptee', 'en_approbation'].includes(r.status) : ['executee', 'appliquee_manuel'].includes(r.status)));

  return (
    <div className="space-y-4">
      <Card><CardContent className="space-y-2 p-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          {canWrite && <Button size="sm" onClick={doImport} disabled={!importable.length || busy === 'import'}><Download className="mr-1 h-4 w-4" />Importer {importable.length} proposition(s) de la dernière Stratégie IA</Button>}
          {(['open', 'done', 'all'] as const).map((f) => <Button key={f} size="sm" variant={filter === f ? 'secondary' : 'ghost'} onClick={() => setFilter(f)}>{f === 'open' ? 'À décider' : f === 'done' ? 'Appliquées et suivi' : 'Toutes'}</Button>)}
        </div>
        <p className="text-xs text-muted-foreground">
          Les propositions viennent de la dernière analyse Stratégie IA (aucun nouvel appel IA). Budget, ROAS cible et pause : modification préparée côté serveur, vérifiée par Google sans rien écrire, puis appliquée seulement par un administrateur qui tape PUBLIER. Produits et ciblages : tâche ; nouvelles campagnes : Constructeur. Meta reste piloté par Crush AI.
          {analysis ? ` · Analyse du ${new Date(analysis.created_at).toLocaleString('fr-FR')}` : ' · Aucune analyse avec propositions : relancez « Forcer une nouvelle analyse » dans Stratégie IA.'}
          {status && ` · Écriture Google Ads ${status.write_enabled ? 'activée' : 'désactivée côté serveur'}`}
        </p>
      </CardContent></Card>

      {shown.length === 0 && <Card><CardContent className="pt-6 text-sm text-muted-foreground">Aucune proposition dans cette vue.</CardContent></Card>}
      {shown.map((a) => {
        const pa = a.publish_action_id ? publish[a.publish_action_id] : null; const st = STATUS[a.status] ?? { l: a.status, v: 'outline' as const };
        return (
          <Card key={a.id}><CardHeader className="pb-2"><CardTitle className="flex flex-wrap items-center gap-2 text-base">
            {a.title}<Badge variant="outline">{KIND[a.kind] ?? a.kind}</Badge><Badge variant={st.v}>{st.l}</Badge><Badge variant="outline">Confiance {a.confidence}</Badge>
          </CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="grid gap-1 md:grid-cols-2">
                <div><span className="text-muted-foreground">Campagne : </span>{a.campaign_name ?? 'Nouvelle'}{a.kind !== 'new_campaign' && !a.campaign_id && <span className="text-destructive"> (introuvable dans la structure)</span>}</div>
                <div><span className="text-muted-foreground">Actuel → proposé : </span>{a.current_value ?? '—'} → {a.proposed_value}{a.proposed_daily_budget != null && ` (${eur(a.proposed_daily_budget)}/jour)`}{a.proposed_target_roas != null && ` (ROAS cible ${a.proposed_target_roas} %)`}</div>
              </div>
              <p><span className="text-muted-foreground">Impact estimé : </span>{a.estimated_impact}</p>
              <p><span className="text-muted-foreground">Chiffres : </span>{a.evidence}</p>
              <p className="text-xs"><span className="text-muted-foreground">Risques : </span>{a.risks}</p>
              <PilotDecisionCharts action={a} data={decisionData} loading={decisionLoading} error={decisionError} onLoad={loadDecisionData} />
              {pa && <div className="rounded border p-2 text-xs"><b>Modification préparée :</b> {pa.summary} · {pa.status}{pa.preflight?.errors?.length ? ` · Google : ${pa.preflight.errors.join(' | ')}` : ''}{pa.error ? ` · ${pa.error}` : ''}</div>}
              {['executee', 'appliquee_manuel'].includes(a.status) && <Followup a={a} />}
              {canWrite && <div className="flex flex-wrap items-center gap-2">
                {a.status === 'proposee' && <><Button size="sm" onClick={() => setSt(a, 'acceptee')} disabled={busy === a.id}><Check className="mr-1 h-4 w-4" />Accepter</Button>
                  <Button size="sm" variant="ghost" onClick={() => { const n = prompt('Motif du rejet ?') ?? ''; setSt(a, 'rejetee', { note: n }); }}><X className="mr-1 h-4 w-4" />Rejeter</Button></>}
                {a.status === 'acceptee' && <>
                  {AUTO.has(a.kind) && a.campaign_id && <Button size="sm" onClick={() => run(a.id, async () => { const d = await call({ mode: 'plan_change', pilot_action_id: a.id }); if (d?.blockers) toast.error(d.blockers.join(' ')); else toast.success('Modification préparée : lancez la vérification Google'); })} disabled={busy === a.id}><Hammer className="mr-1 h-4 w-4" />Préparer la modification</Button>}
                  {a.kind === 'new_campaign' ? <Button size="sm" variant="outline" onClick={() => toDraft(a)}>Préparer un projet de campagne</Button>
                    : <Button size="sm" variant="outline" onClick={() => toTask(a)} disabled={busy === a.id}><ListPlus className="mr-1 h-4 w-4" />Créer une tâche</Button>}
                  <Button size="sm" variant="ghost" onClick={() => setSt(a, 'appliquee_manuel', { executed_at: new Date().toISOString() })}>Appliquée manuellement</Button>
                </>}
                {a.status === 'en_approbation' && pa && <>
                  {['prevue', 'echec_verification', 'verifiee'].includes(pa.status) && <Button size="sm" variant="outline" onClick={() => run(a.id, async () => { const d = await call({ mode: 'preflight', action_id: pa.id }); d.ok ? toast.success('Google valide la modification (rien écrit)') : toast.error(d.errors.join(' | ')); })} disabled={busy === a.id}><ShieldCheck className="mr-1 h-4 w-4" />Vérifier avec Google</Button>}
                  {pa.status === 'verifiee' && status?.is_admin && <>
                    <Input className="h-8 w-32" placeholder="Tapez PUBLIER" value={confirm[a.id] ?? ''} onChange={(e) => setConfirm({ ...confirm, [a.id]: e.target.value })} />
                    <Button size="sm" disabled={confirm[a.id] !== 'PUBLIER' || busy === a.id} onClick={() => run(a.id, async () => { await call({ mode: 'execute', action_id: pa.id, confirm: 'PUBLIER' }); toast.success('Modification appliquée dans Google Ads'); })}><Play className="mr-1 h-4 w-4" />Appliquer</Button></>}
                  <Button size="sm" variant="ghost" onClick={() => run(a.id, async () => { await call({ mode: 'reject', action_id: pa.id }); })}>Annuler</Button>
                </>}
                {busy === a.id && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>}
            </CardContent></Card>
        );
      })}
    </div>
  );
}
