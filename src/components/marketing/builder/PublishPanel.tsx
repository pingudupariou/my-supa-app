import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

const sb = supabase as any;
const ST: Record<string, { l: string; v: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  prevue: { l: 'Préparée', v: 'outline' }, verifiee: { l: 'Vérifiée par Google', v: 'default' }, echec_verification: { l: 'Vérification refusée', v: 'destructive' },
  en_cours: { l: 'En cours', v: 'secondary' }, executee: { l: 'Publiée (en pause)', v: 'default' }, echouee: { l: 'Échec', v: 'destructive' }, refusee: { l: 'Refusée', v: 'secondary' },
};

async function call(body: any) {
  const { data, error } = await supabase.functions.invoke('google-ads-publish', { body });
  if (error) { let m = error.message; try { m = (await (error as any).context?.json())?.error ?? m; } catch { /* */ } throw new Error(m); }
  return data;
}

export function PublishPanel({ draft, onChanged }: { draft: any; onChanged: () => void }) {
  const [env, setEnv] = useState<{ write_enabled: boolean; is_admin: boolean } | null>(null);
  const [log, setLog] = useState<any[]>([]);
  const [eu, setEu] = useState<string>('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [blockers, setBlockers] = useState<string[]>([]);
  const load = useCallback(async () => {
    const { data } = await sb.from('google_ads_publish_actions').select('*').eq('draft_id', draft.id).order('created_at', { ascending: false }).limit(10);
    setLog(data ?? []);
  }, [draft.id]);
  useEffect(() => { load(); call({ mode: 'status' }).then(setEnv).catch(() => setEnv(null)); }, [load]);

  const run = async (body: any, ok: string) => {
    setBusy(true); setBlockers([]);
    try {
      const r = await call(body);
      if (r?.blockers?.length) setBlockers(r.blockers);
      else if (r?.errors?.length) toast.error(`Google a refusé : ${r.errors[0]}`);
      else toast.success(ok);
    } catch (e: any) { toast.error(e.message); }
    setBusy(false); setConfirm(''); load(); onChanged();
  };
  const cur = log.find((a) => !['refusee', 'executee', 'echouee'].includes(a.status));
  const preflightAge = cur?.preflight?.at ? (Date.now() - new Date(cur.preflight.at).getTime()) / 60000 : null;

  return (
    <div className="space-y-3 rounded border p-3">
      <div className="flex flex-wrap items-center gap-2 font-medium"><ShieldAlert className="h-4 w-4" />Publication supervisée
        <Badge variant={env?.write_enabled ? 'destructive' : 'outline'}>{env == null ? '…' : env.write_enabled ? 'Écriture activée côté serveur' : 'Écriture désactivée (aucune publication possible)'}</Badge></div>
      <p className="text-xs text-muted-foreground">4 étapes, chacune journalisée : préparer (opérations calculées par le serveur) → vérifier avec Google sans rien écrire → approbation explicite par un administrateur (saisir PUBLIER) → création de la campagne <b>en pause</b>. Toute modification du projet invalide la préparation.</p>

      {!cur && <div className="flex flex-wrap items-end gap-2">
        <div><div className="text-xs text-muted-foreground">Contient de la publicité politique UE ?</div>
          <Select value={eu} onValueChange={setEu}><SelectTrigger className="w-56"><SelectValue placeholder="Déclaration obligatoire" /></SelectTrigger>
            <SelectContent><SelectItem value="no">Non</SelectItem><SelectItem value="yes">Oui</SelectItem></SelectContent></Select></div>
        <Button size="sm" disabled={busy || !eu} onClick={() => run({ mode: 'plan', draft_id: draft.id, eu_political: eu === 'yes' }, 'Publication préparée (rien envoyé)')}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}1. Préparer la publication</Button>
      </div>}
      {blockers.length > 0 && <ul className="list-disc pl-5 text-xs text-destructive">{blockers.map((b, i) => <li key={i}>{b}</li>)}</ul>}

      {cur && <div className="space-y-2 rounded bg-muted/40 p-2 text-xs">
        <div className="flex flex-wrap items-center gap-2"><b>{cur.summary}</b><Badge variant={ST[cur.status]?.v}>{ST[cur.status]?.l}</Badge></div>
        <details><summary className="cursor-pointer">Voir les {cur.operations.length} opérations prévues</summary>
          <ol className="mt-1 max-h-40 list-decimal overflow-auto pl-5">{cur.operations.map((o: any, i: number) => <li key={i}>{o.description}</li>)}</ol></details>
        {cur.preflight && <div>{cur.preflight.ok ? `Vérification Google OK il y a ${Math.round(preflightAge!)} min (valable 30 min).` : <span className="text-destructive">Refus Google : {cur.preflight.errors.join(' · ')}</span>}</div>}
        {cur.error && <div className="text-destructive">{cur.error}</div>}
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => run({ mode: 'preflight', action_id: cur.id }, 'Google a validé les opérations (rien n’a été créé)')}>2. Vérifier avec Google (sans écriture)</Button>
          {env?.is_admin && cur.status === 'verifiee' && preflightAge! <= 30 && <>
            <Input className="h-8 w-32" placeholder="PUBLIER" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            <Button size="sm" variant="destructive" disabled={busy || confirm !== 'PUBLIER' || !env.write_enabled} onClick={() => run({ mode: 'execute', action_id: cur.id, confirm }, 'Campagne créée en pause dans Google Ads')}>3. Approuver et publier en pause</Button>
          </>}
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => run({ mode: 'reject', action_id: cur.id }, 'Publication refusée')}>Refuser</Button>
        </div>
        {!env?.is_admin && <div className="text-muted-foreground">L’approbation finale est réservée aux administrateurs.</div>}
      </div>}

      {log.length > 0 && <details className="text-xs"><summary className="cursor-pointer">Journal d’audit ({log.length})</summary>
        <ul className="mt-1 space-y-1">{log.map((a) => <li key={a.id} className="border-t pt-1">
          {new Date(a.created_at).toLocaleString('fr-FR')} · <Badge variant={ST[a.status]?.v}>{ST[a.status]?.l ?? a.status}</Badge> {a.summary}
          {a.approved_at && ` · décision ${new Date(a.approved_at).toLocaleString('fr-FR')}`}{a.executed_at && ` · exécutée ${new Date(a.executed_at).toLocaleString('fr-FR')}`}{a.error && <span className="text-destructive"> · {a.error}</span>}
        </li>)}</ul></details>}
    </div>
  );
}
