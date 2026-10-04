import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, PlugZap, CheckCircle2, ShieldAlert, AlertTriangle } from 'lucide-react';

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
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const test = async () => {
    setLoading(true); setResult(null);
    const { data, error } = await supabase.functions.invoke('erplain-sync', { body: { action: 'test' } });
    if (error) {
      const status = (error as any)?.context?.status;
      setResult({ status: 'api_error', message: status === 403 ? 'Accès réservé aux administrateurs.' : 'Appel de la fonction impossible : ' + error.message });
    } else setResult(data as Result);
    setLoading(false);
  };

  const ok = result?.status === 'success';
  const auth = result?.status === 'auth_error';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Plan atelier</h1>
        <p className="text-sm text-muted-foreground">Connexion à Erplain (lecture seule — aucun ordre de fabrication n'est créé)</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Connexion Erplain</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={test} disabled={loading || !isAdmin} data-readonly-allow="true">
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PlugZap className="h-4 w-4 mr-2" />}
            Tester la connexion Erplain
          </Button>
          {!isAdmin && <p className="text-sm text-muted-foreground">Réservé aux administrateurs.</p>}

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
          {sdl && <pre className="text-xs max-h-[500px] overflow-auto rounded-md border bg-muted p-3 whitespace-pre">{sdl}</pre>}
        </CardContent>
      </Card>
    </div>
  );
}
  );
}
