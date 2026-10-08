import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, PlugZap, CheckCircle2, ShieldAlert, AlertTriangle } from 'lucide-react';
import { WorkshopDisclosure } from '@/components/planatelier/WorkshopDisclosure';
import { PlanAtelierBoard } from '@/components/planatelier/PlanAtelierBoard';

type Result = {
  status: 'success' | 'auth_error' | 'api_error' | 'introspection_unavailable' | 'config_error';
  message: string;
  endpoint?: string;
  httpStatus?: number;
  errors?: string[];
  supportQuestions?: string[];
  attempts?: { endpoint: string; httpStatus: number | null; note: string }[];
  schema?: { queries: string[]; mutations: string[]; typesCount: number; objectTypes: string[] };
};

export function PlanAtelierPage() {
  const { isAdmin: isAdminRole, getTabPermission } = useAuth();
  const { userRole, user } = useAuth();
  const localPerm = getTabPermission('plan-atelier');
  // The server answer is the source of truth; fall back to the local permission while it loads.
  const [server, setServer] = useState<{ role: string | null; permission: string; error?: string } | null>(null);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    const check = async () => {
      const { data, error } = await supabase.functions.invoke('erplain-sync', { body: { action: 'access' } });
      if (!alive) return;
      if (error) setServer((s) => ({ role: s?.role ?? null, permission: s?.permission ?? localPerm, error: error.message }));
      else setServer({ role: (data as any)?.role ?? null, permission: (data as any)?.permission ?? 'hidden' });
    };
    check();
    const t = setInterval(check, 15000);
    const onFocus = () => check();
    window.addEventListener('focus', onFocus);
    return () => { alive = false; clearInterval(t); window.removeEventListener('focus', onFocus); };
  }, [user?.id]);
  const perm = server && !server.error ? server.permission : localPerm;
  const isAdmin = isAdminRole || perm === 'write';
  const canRead = isAdmin || perm === 'read';
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [sdl, setSdl] = useState<string | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [steps, setSteps] = useState<any[]>([]);

  const loadSchema = async () => {
    setSchemaLoading(true); setSchemaError(null); setSteps([]); setSdl(null);
    const { data, error } = await supabase.functions.invoke('erplain-sync', { body: { action: 'schema_detail' } });
    const d = data as any;
    if (error) {
      const status = (error as any)?.context?.status;
      setSchemaError(`Appel de la fonction impossible${status ? ` (HTTP ${status})` : ''} : ${error.message}`);
    } else {
      setSteps(d?.steps ?? []);
      if (d?.status !== 'success') setSchemaError(`Échec à l'étape « ${d?.failedStep ?? '?'} » : ${d?.message ?? 'Erreur inconnue'}`);
      else { setSdl(d.sdl); if (d.partial) setSchemaError(`Résultat partiel (${d.typesCount} types lus) — voir les étapes en échec ci-dessous.`); }
    }
    setSchemaLoading(false);
  };

  const test = async () => {
    setLoading(true); setResult(null);
    const { data, error } = await supabase.functions.invoke('erplain-sync', { body: { action: 'test' } });
    if (error) {
      const status = (error as any)?.context?.status;
      setResult({ status: 'api_error', message: status === 403 ? 'Accès refusé : droit d’écriture sur Plan atelier requis.' : 'Appel de la fonction impossible : ' + error.message });
    } else setResult(data as Result);
    setLoading(false);
  };

  const ok = result?.status === 'success';
  const auth = result?.status === 'auth_error';

  return (
    <div className="workshop-theme space-y-5">
      <div>
        <h1 className="page-title">Plan atelier</h1>
        <p className="text-sm text-muted-foreground">Production · Commandes et ordres de fabrication</p>
      </div>
      <PlanAtelierBoard isAdmin={isAdmin} canRead={canRead} />
      <WorkshopDisclosure title="Connexion Erplain et diagnostic">
      <p className="text-xs text-muted-foreground">Votre rôle : <strong>{server?.role ?? userRole}</strong> — droit sur Plan atelier : <strong>{isAdminRole ? 'admin' : perm === 'write' ? 'écriture' : perm === 'read' ? 'lecture (consultation seule, boutons désactivés)' : 'masqué'}</strong>{server?.error ? ` — vérification serveur impossible : ${server.error}` : ''}</p>
      <Card>
        <CardHeader><CardTitle className="text-base">Connexion Erplain</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={test} disabled={loading || !isAdmin} data-readonly-allow="true">
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PlugZap className="h-4 w-4 mr-2" />}
            Tester la connexion Erplain
          </Button>
          {!isAdmin && <p className="text-sm text-muted-foreground">Réservé aux utilisateurs avec droit d'écriture sur Plan atelier.</p>}

          {result && (
            <div className={`rounded-md border p-4 space-y-3 ${ok ? 'border-primary/40 bg-primary/5' : 'border-destructive/40 bg-destructive/5'}`}>
              <div className="flex items-center gap-2 font-medium">
                {ok ? <CheckCircle2 className="h-5 w-5 text-primary" /> : auth ? <ShieldAlert className="h-5 w-5 text-destructive" /> : <AlertTriangle className="h-5 w-5 text-destructive" />}
                {ok ? 'Connexion réussie' : auth ? "Erreur d'authentification" : 'Erreur API'}
              </div>
              <p className="text-sm">{result.message}</p>
              {result.endpoint && <p className="text-xs text-muted-foreground">Endpoint : {result.endpoint} {result.httpStatus ? `(HTTP ${result.httpStatus})` : ''}</p>}
              {result.errors?.length ? <ul className="text-xs list-disc pl-5">{result.errors.map((e, i) => <li key={i}>{e}</li>)}</ul> : null}
              {result.attempts?.length ? (
                <ul className="text-xs text-muted-foreground list-disc pl-5">
                  {result.attempts.map((a, i) => <li key={i}>{a.endpoint} — {a.httpStatus ?? 'n/a'} — {a.note}</li>)}
                </ul>
              ) : null}
              {result.schema && (
                <div className="space-y-3 text-sm">
                  <p>{result.schema.typesCount} types, {result.schema.queries.length} queries, {result.schema.mutations.length} mutations disponibles.</p>
                  <div>
                    <p className="font-medium mb-1">Queries</p>
                    <div className="flex flex-wrap gap-1">{result.schema.queries.map(q => <Badge key={q} variant="secondary">{q}</Badge>)}</div>
                  </div>
                  <div>
                    <p className="font-medium mb-1">Mutations (non utilisées)</p>
                    <div className="flex flex-wrap gap-1">{result.schema.mutations.map(m => <Badge key={m} variant="outline">{m}</Badge>)}</div>
                  </div>
                </div>
              )}
              {result.supportQuestions?.length ? (
                <div className="text-sm">
                  <p className="font-medium">À demander au support Erplain :</p>
                  <ul className="list-disc pl-5">{result.supportQuestions.map((q, i) => <li key={i}>{q}</li>)}</ul>
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Schéma détaillé Erplain</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Lit tous les champs, arguments et statuts disponibles, pour construire la synchronisation sans inventer de nom.</p>
          <div className="flex gap-2">
            <Button onClick={loadSchema} disabled={schemaLoading || !isAdmin} data-readonly-allow="true">
              {schemaLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Lire le schéma détaillé
            </Button>
            {sdl && <Button variant="outline" data-readonly-allow="true" onClick={() => { navigator.clipboard.writeText(sdl); }}>Copier</Button>}
            {sdl && <Button variant="outline" data-readonly-allow="true" onClick={() => {
              const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([sdl], { type: 'text/plain' })); a.download = 'erplain-schema.graphql'; a.click();
            }}>Télécharger</Button>}
          </div>
          {schemaError && <p className="text-sm text-destructive">{schemaError}</p>}
          {steps.length > 0 && (
            <details className="text-xs" open={!!schemaError}>
              <summary className="cursor-pointer text-muted-foreground" data-readonly-allow="true">Étapes ({steps.length})</summary>
              <ul className="mt-2 space-y-1">
                {steps.map((s, i) => (
                  <li key={i} className={s.ok ? 'text-muted-foreground' : 'text-destructive'}>
                    {s.ok ? '✓' : '✗'} {s.step} — HTTP {s.httpStatus ?? 'n/a'} — {s.ms} ms{s.bytes ? ` — ${Math.round(s.bytes / 1024)} Ko` : ''}
                    {s.errors?.length ? <ul className="pl-4 list-disc">{s.errors.map((e: string, j: number) => <li key={j}>{e}</li>)}</ul> : null}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {sdl && <pre className="text-xs max-h-[500px] overflow-auto rounded-md border bg-muted p-3 whitespace-pre">{sdl}</pre>}
        </CardContent>
      </Card>
      </WorkshopDisclosure>
    </div>
  );
}
