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
      const BUDGET_MS = 110000;
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      const TR = `kind name ofType { kind name ofType { kind name ofType { kind name } } }`;
      const steps: { step: string; endpoint?: string; httpStatus: number | null; ms: number; bytes?: number; errors?: string[]; ok: boolean }[] = [];
      let lastCall = 0;
      let gap = 2000;
      const isComplexity = (errs: string[]) => errs.some((m) => /complex/i.test(m));

      // One sequential call: 2s between calls, 429 => Retry-After or exponential backoff.
      const gql = async (step: string, endpoint: string, query: string): Promise<{ data: any; errors: string[]; complexity: boolean; timeout?: boolean }> => {
        for (let attempt = 0; attempt < 4; attempt++) {
          const wait = lastCall + gap - Date.now();
          if (wait > 0) await sleep(wait);
          if (Date.now() - t0 > BUDGET_MS) return { data: null, errors: ["Délai d'exécution atteint"], complexity: false, timeout: true };
          const s = Date.now(); lastCall = s;
          try {
            const r = await fetch(endpoint, { method: "POST",
              headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ query }), signal: AbortSignal.timeout(20000) });
            const text = await r.text();
            if (r.status === 429) {
              const ra = Number(r.headers.get("Retry-After"));
              const delay = Number.isFinite(ra) && ra > 0 ? ra * 1000 : gap * 2;
              gap = Math.min(Math.max(gap * 1.5, 2000), 15000);
              steps.push({ step: `${step} (429, attente ${Math.round(delay / 1000)} s)`, endpoint, httpStatus: 429, ms: Date.now() - s, ok: false, errors: ["Trop de requêtes"] });
              console.error(`erplain schema 429 on "${step}", waiting ${delay}ms`);
              if (Date.now() - t0 + delay > BUDGET_MS) return { data: null, errors: ["Délai d'exécution atteint"], complexity: false, timeout: true };
              await sleep(delay);
              continue;
            }
            let body: any = null; try { body = JSON.parse(text); } catch { /* */ }
            const errors: string[] = body ? (body.errors ?? []).map((e: any) => String(e?.message ?? "")).slice(0, 8) : [`Réponse non JSON: ${text.slice(0, 200)}`];
            const ok = r.ok && !!body?.data && !errors.length;
            steps.push({ step, endpoint, httpStatus: r.status, ms: Date.now() - s, bytes: text.length, errors: errors.length ? errors : undefined, ok });
            if (!ok) console.error(`erplain schema step "${step}" failed`, r.status, errors.join(" | ").slice(0, 500));
            return { data: ok ? body.data : null, errors, complexity: isComplexity(errors) };
          } catch (e) {
            const msg = String((e as Error).message).slice(0, 200);
            steps.push({ step, endpoint, httpStatus: null, ms: Date.now() - s, errors: [msg], ok: false });
            console.error(`erplain schema step "${step}" exception`, msg);
            return { data: null, errors: [msg], complexity: false };
          }
        }
        return { data: null, errors: ["429 persistant"], complexity: false };
      };

      // Cache (resume without restarting)
      const cache = new Map<string, any>();
      const { data: cached } = await admin.from("erplain_schema_cache").select("type_name, data");
      (cached ?? []).forEach((c: any) => cache.set(c.type_name, c.data));
      const save = async (name: string, data: any) => {
        cache.set(name, data);
        await admin.from("erplain_schema_cache").upsert({ type_name: name, data, fetched_at: new Date().toISOString() });
      };

      // Step 1: endpoint + root names
      let endpoint = cache.get("__root")?.endpoint ?? "";
      if (!endpoint) {
        for (const ep of ENDPOINTS) {
          const r = await gql("racine", ep, `{ __schema { queryType { name } mutationType { name } } }`);
          if (r.data) { endpoint = ep; await save("__root", { endpoint: ep, query: r.data.__schema.queryType?.name, mutation: r.data.__schema.mutationType?.name }); break; }
        }
        if (!endpoint) return json({ status: "api_error", failedStep: "racine", message: "Lecture des types racines impossible.", steps });
      }
      const root = cache.get("__root");

      // Read ONE type, progressively simplified if complexity is exceeded.
      const readType = async (name: string): Promise<"ok" | "fail" | "timeout"> => {
        const n = JSON.stringify(name);
        const head = await gql(`${name} : nature`, endpoint, `{ __type(name: ${n}) { kind name description } }`);
        if (head.timeout) return "timeout";
        if (!head.data?.__type) return "fail";
        const t: any = { ...head.data.__type };
        const part = async (label: string, sel: string): Promise<any[] | null | "timeout"> => {
          const r = await gql(`${name} : ${label}`, endpoint, `{ __type(name: ${n}) { ${sel} } }`);
          if (r.timeout) return "timeout";
          if (!r.data?.__type) return r.complexity ? null : [];
          const key = Object.keys(r.data.__type)[0];
          return r.data.__type[key] ?? [];
        };
        if (t.kind === "ENUM") {
          const v = await part("valeurs", `enumValues(includeDeprecated: true) { name description }`);
          if (v === "timeout") return "timeout";
          t.enumValues = v ?? [];
        } else if (t.kind === "INPUT_OBJECT") {
          let v = await part("champs d'entrée", `inputFields { name description type { ${TR} } }`);
          if (v === "timeout") return "timeout";
          if (v === null) { v = await part("champs d'entrée (simplifié)", `inputFields { name type { ${TR} } }`); if (v === "timeout") return "timeout"; }
          t.inputFields = v ?? [];
        } else if (t.kind === "OBJECT" || t.kind === "INTERFACE") {
          let f = await part("champs", `fields(includeDeprecated: true) { name description type { ${TR} } }`);
          if (f === "timeout") return "timeout";
          if (f === null) { f = await part("champs (simplifié)", `fields(includeDeprecated: true) { name type { ${TR} } }`); if (f === "timeout") return "timeout"; }
          const a = await part("arguments", `fields(includeDeprecated: true) { name args { name type { ${TR} } } }`);
          if (a === "timeout") return "timeout";
          let argMap = new Map<string, any[]>();
          if (a === null) {
            // too complex: read args field-by-field is impossible via __type; fall back to arg names + shallow type
            const a2 = await part("arguments (simplifié)", `fields(includeDeprecated: true) { name args { name type { kind name ofType { kind name ofType { kind name } } } } }`);
            if (a2 === "timeout") return "timeout";
            (a2 ?? []).forEach((x: any) => argMap.set(x.name, x.args ?? []));
          } else (a ?? []).forEach((x: any) => argMap.set(x.name, x.args ?? []));
          t.fields = (f ?? []).map((x: any) => ({ ...x, args: argMap.get(x.name) ?? [] }));
        } else if (t.kind === "UNION") {
          const p = await part("types possibles", `possibleTypes { kind name }`);
          if (p === "timeout") return "timeout";
          t.possibleTypes = p ?? [];
        }
        await save(name, t);
        return "ok";
      };

      const named = (t: any): string | null => { while (t?.ofType) t = t.ofType; return t?.name ?? null; };
      const BUILTIN = new Set(["String", "Int", "Float", "Boolean", "ID"]);
      const KW = /order|stock|inventor|manufactur|production|assembl|bom|nomencl|component|routing|gamme|operation|variant|location|warehouse|reserv|shipment|deliver/i;
      const MAX_TYPES = 200;

      // Root Query (and Mutation names only, never executed)
      let stopped = false;
      for (const rn of [root.query, root.mutation].filter(Boolean)) {
        if (!cache.has(rn)) { const r = await readType(rn); if (r === "timeout") { stopped = true; break; } }
      }

      // BFS from relevant Query fields only
      const failed = new Set<string>();
      const relevant: string[] = [];
      if (!stopped && cache.has(root.query)) {
        const q = cache.get(root.query);
        const roots = (q.fields ?? []).filter((f: any) => KW.test(f.name));
        let frontier: string[] = [];
        for (const f of roots) {
          const n = named(f.type); if (n) frontier.push(n);
          for (const a of f.args ?? []) { const m = named(a.type); if (m) frontier.push(m); }
        }
        const seen = new Set<string>();
        for (let depth = 0; depth < 4 && frontier.length && !stopped; depth++) {
          const next: string[] = [];
          for (const n of frontier) {
            if (seen.has(n) || BUILTIN.has(n) || n.startsWith("__")) continue;
            seen.add(n);
            if (seen.size > MAX_TYPES) break;
            relevant.push(n);
            if (!cache.has(n)) {
              const r = await readType(n);
              if (r === "timeout") { stopped = true; break; }
              if (r === "fail") { failed.add(n); continue; }
            }
            const t = cache.get(n);
            // Dependencies: fields' return types, args' input types, input fields
            for (const f of [...(t.fields ?? []), ...(t.inputFields ?? [])]) {
              const r = named(f.type); if (r && (depth < 2 || KW.test(r) || /status|state|type|input|filter|page|connection|edge|node/i.test(r))) next.push(r);
              for (const a of f.args ?? []) { const m = named(a.type); if (m) next.push(m); }
            }
            (t.possibleTypes ?? []).forEach((p: any) => p.name && next.push(p.name));
          }
          frontier = next;
        }
      }

      const fmt = (t: any): string => !t ? "?" : t.kind === "NON_NULL" ? fmt(t.ofType) + "!" : t.kind === "LIST" ? `[${fmt(t.ofType)}]` : t.name;
      const complete = !stopped && failed.size === 0;
      const lines: string[] = [`# Endpoint: ${endpoint}`, `# Types lus: ${[...cache.keys()].filter((k) => k !== "__root").length}`,
        `# Statut: ${complete ? "complet" : "partiel — relancer pour reprendre"}`, ""];
      const typeNames = [root.query, root.mutation, ...[...cache.keys()].filter((k) => k !== "__root" && k !== root.query && k !== root.mutation).sort()].filter(Boolean);
      for (const n of typeNames) {
        const t = cache.get(n); if (!t) continue;
        if (n === root.mutation) {
          lines.push(`type ${n} {  # noms uniquement, jamais exécutées`);
          (t.fields ?? []).forEach((f: any) => lines.push(`  ${f.name}`)); lines.push("}"); continue;
        }
        if (t.kind === "SCALAR") { lines.push(`scalar ${t.name}`); continue; }
        if (t.kind === "ENUM") { lines.push(`enum ${t.name} {${t.description ? "  # " + t.description : ""}`); (t.enumValues ?? []).forEach((v: any) => lines.push(`  ${v.name}${v.description ? "  # " + v.description : ""}`)); lines.push("}"); continue; }
        if (t.kind === "UNION") { lines.push(`union ${t.name} = ${(t.possibleTypes ?? []).map((p: any) => p.name).join(" | ")}`); continue; }
        const kw = t.kind === "INPUT_OBJECT" ? "input" : t.kind === "INTERFACE" ? "interface" : "type";
        lines.push(`${kw} ${t.name} {${t.description ? "  # " + t.description : ""}`);
        for (const f of t.fields ?? t.inputFields ?? []) {
          const args = f.args?.length ? `(${f.args.map((a: any) => `${a.name}: ${fmt(a.type)}`).join(", ")})` : "";
          lines.push(`  ${f.name}${args}: ${fmt(f.type)}${f.description ? "  # " + f.description : ""}`);
        }
        lines.push("}");
      }
      if (failed.size) lines.push("", `# Types illisibles: ${[...failed].join(", ")}`);
      return json({ status: "success", partial: !complete, endpoint, typesCount: typeNames.length,
        failedTypes: [...failed], durationMs: Date.now() - t0, sdl: lines.join("\n"), steps });
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
