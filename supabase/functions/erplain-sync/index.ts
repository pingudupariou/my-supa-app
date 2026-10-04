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

    let action = "test";
    try { action = (await req.json())?.action ?? "test"; } catch { /* no body */ }

    if (action === "schema_detail") {
      const t0 = Date.now();
      const TR = `kind name ofType { kind name ofType { kind name ofType { kind name } } }`;
      const TYPE_BODY = `kind name description
        fields(includeDeprecated: true) { name description args { name description type { ${TR} } } type { ${TR} } }
        inputFields { name description type { ${TR} } }
        enumValues(includeDeprecated: true) { name description }`;
      const steps: { step: string; endpoint?: string; httpStatus: number | null; ms: number; bytes?: number; errors?: string[]; ok: boolean }[] = [];
      const gql = async (step: string, endpoint: string, query: string) => {
        const s = Date.now();
        try {
          const r = await fetch(endpoint, { method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ query }), signal: AbortSignal.timeout(20000) });
          const text = await r.text();
          let body: any = null; try { body = JSON.parse(text); } catch { /* */ }
          const errors = body ? (body.errors ?? []).map((e: any) => String(e?.message ?? "")).slice(0, 8) : [`Réponse non JSON: ${text.slice(0, 200)}`];
          const ok = r.ok && !!body?.data;
          steps.push({ step, endpoint, httpStatus: r.status, ms: Date.now() - s, bytes: text.length, errors: errors.length ? errors : undefined, ok });
          if (!ok) console.error(`erplain schema step "${step}" failed`, r.status, errors.join(" | ").slice(0, 500));
          return ok ? body.data : null;
        } catch (e) {
          const msg = String((e as Error).message).slice(0, 200);
          steps.push({ step, endpoint, httpStatus: null, ms: Date.now() - s, errors: [msg], ok: false });
          console.error(`erplain schema step "${step}" exception`, msg);
          return null;
        }
      };

      // Step 1: find working endpoint (same as test)
      let endpoint = ""; let root: any = null;
      for (const ep of ENDPOINTS) {
        root = await gql("racine", ep, `{ __schema { queryType { name } mutationType { name } } }`);
        if (root) { endpoint = ep; break; }
      }
      if (!root) return json({ status: "api_error", failedStep: "racine", message: "Lecture des types racines impossible.", steps });

      const types = new Map<string, any>();
      const fetchTypes = async (names: string[], label: string) => {
        for (let i = 0; i < names.length; i += 8) {
          if (Date.now() - t0 > 100000) { steps.push({ step: "arrêt (délai)", httpStatus: null, ms: 0, ok: false, errors: ["Limite de temps atteinte, résultat partiel"] }); return false; }
          const batch = names.slice(i, i + 8);
          const q = `{ ${batch.map((n, k) => `t${k}: __type(name: ${JSON.stringify(n)}) { ${TYPE_BODY} }`).join(" ")} }`;
          const d = await gql(`${label} [${batch.join(", ")}]`, endpoint, q);
          if (d) batch.forEach((_, k) => { if (d[`t${k}`]) types.set(d[`t${k}`].name, d[`t${k}`]); });
        }
        return true;
      };
      const rootNames = [root.__schema.queryType?.name, root.__schema.mutationType?.name].filter(Boolean);
      await fetchTypes(rootNames, "Query/Mutation");
      if (!types.size) return json({ status: "api_error", failedStep: "Query/Mutation", message: "Champs racines illisibles.", steps });

      const named = (t: any): string | null => { while (t?.ofType) t = t.ofType; return t?.name ?? null; };
      const refs = (t: any): string[] => {
        const out: string[] = [];
        for (const f of [...(t.fields ?? []), ...(t.inputFields ?? [])]) {
          const n = named(f.type); if (n) out.push(n);
          for (const a of f.args ?? []) { const m = named(a.type); if (m) out.push(m); }
        }
        return out;
      };
      const KW = /order|stock|inventor|manufactur|production|work|bom|nomencl|component|routing|gamme|operation|variant|location|warehouse|product|item|reserv|ship|deliver|status|page|connection|edge|filter/i;
      const BUILTIN = new Set(["String", "Int", "Float", "Boolean", "ID"]);
      // Relevant root fields only (query side), plus all their arg/return types
      const q = types.get(root.__schema.queryType.name);
      let frontier = new Set<string>();
      for (const f of q?.fields ?? []) if (KW.test(f.name)) {
        const n = named(f.type); if (n) frontier.add(n);
        for (const a of f.args ?? []) { const m = named(a.type); if (m) frontier.add(m); }
      }
      for (let depth = 0; depth < 4 && frontier.size; depth++) {
        const todo = [...frontier].filter((n) => !types.has(n) && !BUILTIN.has(n) && !n.startsWith("__")).slice(0, 120);
        if (!todo.length) break;
        if (!(await fetchTypes(todo, `types niveau ${depth + 1}`))) break;
        const next = new Set<string>();
        for (const n of todo) { const t = types.get(n); if (t) refs(t).forEach((r) => (depth < 1 || KW.test(r) || types.get(r)?.kind === "ENUM" || true) && next.add(r)); }
        frontier = next;
        if (types.size > 400) break;
      }

      const fmt = (t: any): string => !t ? "?" : t.kind === "NON_NULL" ? fmt(t.ofType) + "!" : t.kind === "LIST" ? `[${fmt(t.ofType)}]` : t.name;
      const lines: string[] = [`# Endpoint: ${endpoint}`, `# Types lus: ${types.size}`, ""];
      const order = [...rootNames, ...[...types.keys()].filter((n) => !rootNames.includes(n)).sort()];
      for (const n of order) {
        const t = types.get(n); if (!t) continue;
        if (t.kind === "SCALAR") { lines.push(`scalar ${t.name}`); continue; }
        if (t.kind === "ENUM") { lines.push(`enum ${t.name} {`); (t.enumValues ?? []).forEach((v: any) => lines.push(`  ${v.name}${v.description ? "  # " + v.description : ""}`)); lines.push("}"); continue; }
        const kw = t.kind === "INPUT_OBJECT" ? "input" : t.kind === "INTERFACE" ? "interface" : t.kind === "UNION" ? "union" : "type";
        lines.push(`${kw} ${t.name} {${t.description ? "  # " + t.description : ""}`);
        for (const f of t.fields ?? t.inputFields ?? []) {
          const args = f.args?.length ? `(${f.args.map((a: any) => `${a.name}: ${fmt(a.type)}`).join(", ")})` : "";
          lines.push(`  ${f.name}${args}: ${fmt(f.type)}${f.description ? "  # " + f.description : ""}`);
        }
        lines.push("}");
      }
      const failed = steps.filter((s) => !s.ok && s.step !== "racine");
      return json({ status: "success", partial: failed.length > 0, endpoint, typesCount: types.size,
        durationMs: Date.now() - t0, sdl: lines.join("\n"), steps });
    }


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
