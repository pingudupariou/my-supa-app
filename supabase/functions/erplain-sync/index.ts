// Erplain connection test — READ-ONLY. Only runs a GraphQL introspection query.
// No mutation is ever sent to Erplain from this function.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Candidate endpoints (docs reference api.erplain.app/graphiql)
const ENDPOINTS = ["https://api.erplain.app/graphql", "https://api.erplain.app/api/graphql"];

const INTROSPECTION = `query IntrospectionLite {
  __schema {
    queryType { name fields { name } }
    mutationType { name fields { name } }
    types { name kind }
  }
}`;

const SUPPORT_QUESTIONS = [
  "URL exacte de l'endpoint GraphQL de production (ex. https://api.erplain.app/graphql ?)",
  "Format d'authentification attendu (header Authorization: Bearer <token> ?)",
  "Le token API fourni a-t-il les droits nécessaires (lecture stock, produits, ordres de fabrication) ?",
  "L'introspection GraphQL est-elle activée pour notre compte, ou pouvez-vous fournir le schéma (SDL) ?",
  "Noms exacts des queries et mutations liées aux ordres de fabrication / assemblages",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: cErr } = await anon.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (cErr || !claims?.claims) return json({ error: "Unauthorized" }, 401);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: role } = await admin.from("user_roles").select("role").eq("user_id", claims.claims.sub).maybeSingle();
    if (role?.role !== "admin") return json({ error: "Forbidden" }, 403);

    const token = Deno.env.get("ERPLAIN_API_TOKEN");
    if (!token) return json({ status: "config_error", message: "Secret ERPLAIN_API_TOKEN absent côté serveur." });

    const attempts: { endpoint: string; httpStatus: number | null; note: string }[] = [];
    for (const endpoint of ENDPOINTS) {
      let res: Response;
      try {
        res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ query: INTROSPECTION }),
        });
      } catch (e) {
        attempts.push({ endpoint, httpStatus: null, note: "Réseau: " + String((e as Error).message).slice(0, 150) });
        continue;
      }
      const text = await res.text();
      let body: any = null;
      try { body = JSON.parse(text); } catch { /* non-JSON */ }

      if (res.status === 401 || res.status === 403) {
        return json({ status: "auth_error", endpoint, httpStatus: res.status,
          message: "Erplain a refusé le token (authentification).", supportQuestions: SUPPORT_QUESTIONS, attempts });
      }
      if (res.status === 404 || !body) {
        attempts.push({ endpoint, httpStatus: res.status, note: body ? "Introuvable" : "Réponse non JSON" });
        continue;
      }
      const errMsgs: string[] = (body.errors ?? []).map((e: any) => String(e?.message ?? "")).slice(0, 5);
      if (!body.data?.__schema) {
        const isAuth = errMsgs.some((m) => /unauth|authenticat|token/i.test(m));
        return json({ status: isAuth ? "auth_error" : "introspection_unavailable", endpoint, httpStatus: res.status,
          message: isAuth ? "Erplain a refusé le token (authentification)." : "Connexion établie mais introspection GraphQL inaccessible.",
          errors: errMsgs, supportQuestions: SUPPORT_QUESTIONS, attempts });
      }
      const s = body.data.__schema;
      const userTypes = (s.types ?? []).filter((t: any) => !t.name.startsWith("__"));
      return json({
        status: "success", endpoint, httpStatus: res.status,
        message: "Connexion Erplain réussie, schéma GraphQL lu.",
        schema: {
          queries: (s.queryType?.fields ?? []).map((f: any) => f.name).sort(),
          mutations: (s.mutationType?.fields ?? []).map((f: any) => f.name).sort(),
          typesCount: userTypes.length,
          objectTypes: userTypes.filter((t: any) => t.kind === "OBJECT").map((t: any) => t.name).sort(),
        },
      });
    }
    return json({ status: "api_error", message: "Aucun endpoint GraphQL Erplain n'a répondu correctement.",
      attempts, supportQuestions: SUPPORT_QUESTIONS });
  } catch (e) {
    console.error("erplain-sync error:", (e as Error).message);
    return json({ status: "api_error", message: "Erreur interne de la fonction." }, 500);
  }
});
