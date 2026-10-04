// Erplain connection, schema reading, read-only data sync and workshop plan.
// The only mutation ever sent is CreateManufacturingOrder, and only when the server secret
// ERPLAIN_ALLOW_WRITE is "true" and the admin explicitly confirms. Otherwise it is a dry run.
import { createClient } from "npm:@supabase/supabase-js@2";
import { DATASETS, FILTER_TYPES, makeGql, pageQuery, whereColumns } from "./erplain.ts";
import { computePlan, moPayload } from "./plan.ts";

const DEFAULT_ENDPOINT = "https://api.erplain.app/graphql";

async function loadAll(admin: any, table: string) {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from(table).select("*").range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

async function loadPlanData(admin: any) {
  const [lines, stocks, mos, boms, routings] = await Promise.all(
    ["erplain_order_lines", "erplain_stock_levels", "erplain_manufacturing_orders", "erplain_boms", "erplain_routings"].map((t) => loadAll(admin, t)));
  return { lines, stocks, mos, boms, routings };
}

async function handleData(action: string, body: any, admin: any, token: string, userId: string): Promise<Response> {
  const t0 = Date.now();
  const steps: any[] = [];
  const { data: rootRow } = await admin.from("erplain_schema_cache").select("data").eq("type_name", "__root").maybeSingle();
  const endpoint = rootRow?.data?.endpoint ?? DEFAULT_ENDPOINT;
  const gql = makeGql(token, endpoint, t0 + 105000, (s) => steps.push(s));

  if (action === "plan") {
    const data = await loadPlanData(admin);
    const { data: run } = await admin.from("erplain_sync_runs").select("*").order("started_at", { ascending: false }).limit(1).maybeSingle();
    const { data: subs } = await admin.from("erplain_mo_submissions").select("*").order("created_at", { ascending: false });
    const plan = computePlan(data, { includePending: !!body.includePending, selectedLineIds: Array.isArray(body.selectedLineIds) ? body.selectedLineIds : null });
    return json({ status: "success", lastRun: run, ...plan, submissions: subs ?? [],
      writeEnabled: Deno.env.get("ERPLAIN_ALLOW_WRITE") === "true",
      counts: { lines: data.lines.length, stocks: data.stocks.length, mos: data.mos.length, boms: data.boms.length, routings: data.routings.length } });
  }

  if (action === "sync") {
    // Resume the last unfinished run, or start a new one.
    let { data: run } = await admin.from("erplain_sync_runs").select("*").eq("status", "running").order("started_at", { ascending: false }).limit(1).maybeSingle();
    if (body.restart && run) { await admin.from("erplain_sync_runs").update({ status: "abandoned", finished_at: new Date().toISOString() }).eq("id", run.id); run = null; }
    if (!run) {
      const { data: created, error } = await admin.from("erplain_sync_runs").insert({ cursor: { ds: 0, page: 1 }, started_by: userId }).select().single();
      if (error) return json({ status: "api_error", message: error.message });
      run = created;
    }
    const cursor = { ...run.cursor };
    const counts = { ...run.counts };
    const notes: string[] = [...(run.notes ?? [])];
    let failure: string | null = null;
    let timedOut = false;

    while (cursor.ds < DATASETS.length) {
      const ds = DATASETS[cursor.ds];
      if (cursor.filter === undefined) {
        const ft = FILTER_TYPES[ds.key];
        if (ft) {
          const cols = await whereColumns(admin, gql, ft.type);
          if (cols === "timeout") { timedOut = true; break; }
          cursor.filter = cols ? ft.build(cols) : null;
          notes.push(cursor.filter ? `${ds.root} : filtre statut appliqué côté Erplain.` : `${ds.root} : colonne STATUS absente du schéma, lecture complète puis filtre local.`);
        } else cursor.filter = null;
      }
      cursor.size = cursor.size ?? ds.size;
      const r = await gql(`${ds.root} page ${cursor.page} (×${cursor.size})`, pageQuery(ds, cursor.filter, cursor.size, cursor.page));
      if (r.timeout) { timedOut = true; break; }
      if (r.complexity && cursor.size > 1) { cursor.size = Math.max(1, Math.floor(cursor.size / 2)); continue; }
      if (r.errors.length && cursor.filter && cursor.page === 1 && !cursor.filterFailed) {
        notes.push(`${ds.root} : filtre statut refusé (${r.errors[0]}), lecture sans filtre.`);
        cursor.filter = null; cursor.filterFailed = true; continue;
      }
      const page = r.data?.[ds.root];
      if (r.errors.length || !page) {
        failure = `${ds.root} page ${cursor.page} : HTTP ${r.httpStatus ?? "n/a"} — ${r.errors.join(" | ") || "réponse vide"}`;
        break;
      }
      const rows = (page.data ?? []).flatMap((item: any) => ds.rows(item, run.id));
      if (rows.length) {
        const { error } = await admin.from(ds.table).upsert(rows, { onConflict: ds.idCol });
        if (error) { failure = `Enregistrement ${ds.table} : ${error.message}`; break; }
      }
      counts[ds.key] = (counts[ds.key] ?? 0) + (page.data ?? []).length;
      if (ds.key === "orders") counts.order_lines = (counts.order_lines ?? 0) + rows.length;
      if (page.paginatorInfo?.hasMorePages) { cursor.page++; }
      else {
        // Dataset complete: remove rows no longer returned by Erplain.
        await admin.from(ds.table).delete().or(`run_id.is.null,run_id.neq.${run.id}`);
        cursor.ds++; cursor.page = 1; cursor.size = undefined; cursor.filter = undefined; cursor.filterFailed = undefined;
      }
      await admin.from("erplain_sync_runs").update({ cursor, counts, notes }).eq("id", run.id);
    }
    const done = cursor.ds >= DATASETS.length;
    const status = failure ? "failed" : done ? "completed" : "running";
    await admin.from("erplain_sync_runs").update({ cursor, counts, notes, status, error: failure,
      finished_at: done || failure ? new Date().toISOString() : null }).eq("id", run.id);
    return json({ status: failure ? "api_error" : "success", done, timedOut, failure, runId: run.id, counts, notes,
      current: DATASETS[cursor.ds]?.root ?? null, page: cursor.page, steps: steps.slice(-30), durationMs: Date.now() - t0 });
  }

  if (["mo_refresh", "mo_update", "mo_delete", "mo_transition"].includes(action)) return await handleMo(action, body, admin, gql, steps);

  // create_mo: re-check everything server-side, never trust the client figures.
  const wanted: string = String(body.key ?? "");
  const confirm = body.confirm === true;
  const { data: lastRun } = await admin.from("erplain_sync_runs").select("*").eq("status", "completed").order("finished_at", { ascending: false }).limit(1).maybeSingle();
  if (!lastRun || Date.now() - new Date(lastRun.finished_at).getTime() > 10 * 60 * 1000)
    return json({ status: "blocked", message: "Données Erplain trop anciennes (plus de 10 min) : actualisez depuis Erplain avant l'envoi." });

  // Fresh read of open MOs (duplicate protection against MOs created meanwhile in Erplain).
  const mosDs = DATASETS.find((d) => d.key === "mos")!;
  const cols = await whereColumns(admin, gql, FILTER_TYPES.mos.type);
  const filter = Array.isArray(cols) ? FILTER_TYPES.mos.build(cols) : null;
  const freshMos: any[] = [];
  for (let page = 1, size = 10; ; ) {
    const r = await gql(`OF actuels page ${page}`, pageQuery(mosDs, filter, size, page));
    if (r.complexity && size > 1) { size = Math.max(1, Math.floor(size / 2)); continue; }
    const pg = r.data?.ManufacturingOrders;
    if (r.timeout || r.errors.length || !pg) return json({ status: "blocked", message: `Relecture des OF impossible : ${r.errors.join(" | ") || "délai dépassé"}`, steps });
    freshMos.push(...(pg.data ?? []).flatMap((m: any) => mosDs.rows(m, lastRun.id)));
    if (!pg.paginatorInfo?.hasMorePages) break;
    page++;
  }
  const data = await loadPlanData(admin);
  data.mos = freshMos;
  const plan = computePlan(data, { includePending: !!body.includePending, selectedLineIds: Array.isArray(body.selectedLineIds) ? body.selectedLineIds : null });
  const p = plan.proposals.find((x: any) => x.idempotency_key === wanted || x.key === body.groupKey);
  if (!p) return json({ status: "blocked", message: "Proposition introuvable après relecture : le besoin a changé ou est couvert." });
  if (p.idempotency_key !== wanted) return json({ status: "blocked", message: "Les lignes de commande concernées ont changé depuis l'affichage. Rechargez le plan." });
  if (p.status !== "ready") return json({ status: "blocked", message: p.status === "shortage" ? "Composants insuffisants : OF bloqué." : p.status === "covered" ? "Besoin déjà couvert par le stock ou les OF existants." : `Données incomplètes : ${p.issues.join(" ")}` });
  if (Number(body.quantity) !== p.to_build) return json({ status: "blocked", message: `La quantité à fabriquer a changé (${p.to_build}). Rechargez le plan.` });
  const linked = freshMos.filter((m) => !["completed", "cancelled"].includes(m.status) && m.order_line_item_ids.some((id: number) => p.free_line_ids.includes(id)));
  if (linked.length) return json({ status: "blocked", message: `Lignes déjà liées à l'OF ${linked.map((m) => m.label ?? m.id).join(", ")}.` });

  const { data: prev } = await admin.from("erplain_mo_submissions").select("*").eq("idempotency_key", p.idempotency_key).maybeSingle();
  if (prev && ["sending", "created", "unknown"].includes(prev.status))
    return json({ status: "blocked", message: `Déjà envoyé (statut ${prev.status}${prev.erplain_mo_id ? `, OF Erplain ${prev.erplain_mo_id}` : ""}).`, submission: prev });

  const input = moPayload(p);
  const writeEnabled = Deno.env.get("ERPLAIN_ALLOW_WRITE") === "true";
  const mutation = `mutation CreateMO($input: ManufacturingOrderInput!) { CreateManufacturingOrder(input: $input) { id label status } }`;
  const row = { idempotency_key: p.idempotency_key, variant_id: p.variant_id, location_id: p.location_id, quantity: p.to_build,
    order_line_item_ids: p.free_line_ids, payload: input, created_by: userId, updated_at: new Date().toISOString() };

  if (!writeEnabled || !confirm) {
    await admin.from("erplain_mo_submissions").upsert({ ...row, status: "prepared", steps: [{ step: "simulation", at: new Date().toISOString() }] }, { onConflict: "idempotency_key" });
    return json({ status: "dry_run", writeEnabled, message: writeEnabled ? "Simulation : confirmez pour envoyer." : "Simulation uniquement : l'envoi réel est désactivé sur le serveur.", mutation, variables: { input } });
  }

  // Lock (unique key) before sending.
  const { error: lockErr } = await admin.from("erplain_mo_submissions").upsert({ ...row, status: "sending", steps: [{ step: "envoi", at: new Date().toISOString() }] }, { onConflict: "idempotency_key" });
  if (lockErr) return json({ status: "blocked", message: lockErr.message });
  const r = await gql("CreateManufacturingOrder", mutation, { input });
  const mo = r.data?.CreateManufacturingOrder;
  if (mo?.id) {
    await admin.from("erplain_mo_submissions").update({ status: "created", erplain_mo_id: mo.id, updated_at: new Date().toISOString(),
      steps: [{ step: "envoi", at: new Date().toISOString() }, { step: "créé", id: mo.id, label: mo.label, status: mo.status }] }).eq("idempotency_key", p.idempotency_key);
    const { data: sub } = await admin.from("erplain_mo_submissions").select("*").eq("idempotency_key", p.idempotency_key).single();
    const refreshed = await refreshMo(admin, gql, sub);
    return json({ status: "created", mo, ...refreshed });
  }
  // Unknown outcome (timeout/network) must not be retried blindly.
  const st = r.errors.length && r.httpStatus && r.httpStatus < 500 ? "failed" : "unknown";
  await admin.from("erplain_mo_submissions").update({ status: st, error: r.errors.join(" | ") || "Réponse vide", updated_at: new Date().toISOString() }).eq("idempotency_key", p.idempotency_key);
  return json({ status: "api_error", message: `Création refusée ou incertaine (HTTP ${r.httpStatus ?? "n/a"}) : ${r.errors.join(" | ")}` });
}

const MO_QUERY = `query MO($id: ID) { ManufacturingOrder(id: $id) { id label status quantity remaining_to_produce actually_produced due_at notes
  variant { id sku } location { id } bill_of_material { id } manufacturing_routing { id } order_line_items { id }
  lines { id variant_id planned_quantity remaining_to_produce reserved } steps { id status manufacturing_routing_step_id } } }`;
const EDITABLE = ["unpublished", "draft"];
const TRANSITIONS: Record<string, string[]> = { released: ["unpublished", "draft"], in_progress: ["released"] };

// Re-read one MO from Erplain, store its content/status and verify components + routing were carried over.
async function refreshMo(admin: any, gql: any, sub: any) {
  const r = await gql(`Relecture OF ${sub.erplain_mo_id}`, MO_QUERY, { id: String(sub.erplain_mo_id) });
  if (r.errors.length || r.timeout) return { refreshError: r.errors.join(" | ") || "délai dépassé" };
  const m = r.data?.ManufacturingOrder;
  if (!m) {
    await admin.from("erplain_mo_submissions").update({ erplain_status: "absent", deleted_at: new Date().toISOString(), erplain_synced_at: new Date().toISOString() }).eq("id", sub.id);
    return { refreshError: "OF introuvable dans Erplain (supprimé ?)." };
  }
  const { data: bom } = await admin.from("erplain_boms").select("components").eq("id", sub.payload?.bill_of_material?.id).maybeSingle();
  const { data: rt } = sub.payload?.manufacturing_routing ? await admin.from("erplain_routings").select("steps").eq("id", sub.payload.manufacturing_routing.id).maybeSingle() : { data: null };
  const expectedComp = (bom?.components ?? []).map((c: any) => Number(c.component_id)).sort();
  const gotComp = (m.lines ?? []).map((l: any) => Number(l.variant_id)).sort();
  const checks = {
    bom: String(m.bill_of_material?.id ?? "") === String(sub.payload?.bill_of_material?.id ?? ""),
    components: expectedComp.length > 0 && expectedComp.every((c: number) => gotComp.includes(c)),
    components_detail: `${gotComp.length} ligne(s) composant reprises / ${expectedComp.length} attendue(s)`,
    routing: sub.payload?.manufacturing_routing ? String(m.manufacturing_routing?.id ?? "") === String(sub.payload.manufacturing_routing.id) : null,
    steps_detail: sub.payload?.manufacturing_routing ? `${(m.steps ?? []).length} étape(s) / ${(rt?.steps ?? []).length} dans la gamme` : "pas de gamme",
    quantity: Number(m.quantity) === Number(sub.quantity),
    order_lines: (sub.order_line_item_ids ?? []).every((id: number) => (m.order_line_items ?? []).some((x: any) => Number(x.id) === Number(id))),
  };
  await admin.from("erplain_mo_submissions").update({ erplain_status: m.status, erplain_snapshot: m, checks, erplain_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", sub.id);
  return { erplain: m, checks };
}

async function handleMo(action: string, body: any, admin: any, gql: any, steps: any[]) {
  const { data: sub } = await admin.from("erplain_mo_submissions").select("*").eq("id", String(body.submissionId ?? "")).maybeSingle();
  if (!sub?.erplain_mo_id) return json({ status: "blocked", message: "OF Erplain inconnu pour cet envoi." });
  const fresh = await refreshMo(admin, gql, sub);
  if (action === "mo_refresh" || (fresh as any).refreshError) return json({ status: (fresh as any).refreshError ? "api_error" : "success", message: (fresh as any).refreshError, ...fresh });
  const cur = (fresh as any).erplain.status;
  const writeEnabled = Deno.env.get("ERPLAIN_ALLOW_WRITE") === "true";
  let mutation = "", variables: any = {}, allowed = false, why = "";
  if (action === "mo_delete") {
    allowed = EDITABLE.includes(cur); why = `Suppression possible seulement aux statuts ${EDITABLE.join("/")} (actuel : ${cur}).`;
    mutation = `mutation Del($id: ID!) { DeleteManufacturingOrder(id: $id) }`; variables = { id: String(sub.erplain_mo_id) };
  } else if (action === "mo_update") {
    allowed = EDITABLE.includes(cur); why = `Modification possible seulement aux statuts ${EDITABLE.join("/")} (actuel : ${cur}).`;
    const input: any = {};
    if (body.quantity != null) { const q = Number(body.quantity); if (!(q > 0)) return json({ status: "blocked", message: "Quantité invalide." }); input.quantity = q; }
    if (typeof body.notes === "string") input.notes = body.notes.slice(0, 2000);
    if (typeof body.due_at === "string" && body.due_at) input.due_at = body.due_at;
    if (!Object.keys(input).length) return json({ status: "blocked", message: "Rien à modifier." });
    mutation = `mutation Upd($id: ID!, $input: ManufacturingOrderInput!) { UpdateManufacturingOrder(id: $id, input: $input) { id status quantity } }`; variables = { id: String(sub.erplain_mo_id), input };
  } else {
    const target = String(body.target ?? "");
    allowed = (TRANSITIONS[target] ?? []).includes(cur); why = `Passage à « ${target} » impossible depuis « ${cur} ».`;
    mutation = `mutation Upd($id: ID!, $input: ManufacturingOrderInput!) { UpdateManufacturingOrder(id: $id, input: $input) { id status } }`; variables = { id: String(sub.erplain_mo_id), input: { status: target } };
  }
  if (!allowed) return json({ status: "blocked", message: why, ...fresh });
  if (!writeEnabled || body.confirm !== true) return json({ status: "dry_run", writeEnabled, message: writeEnabled ? "Simulation : confirmez pour envoyer." : "Simulation uniquement : l'envoi réel est désactivé sur le serveur.", mutation, variables, ...fresh });
  const r = await gql(action, mutation, variables);
  if (r.errors.length || r.timeout) return json({ status: "api_error", message: `Refusé par Erplain (HTTP ${r.httpStatus ?? "n/a"}) : ${r.errors.join(" | ") || "délai dépassé"}`, steps });
  const { data: sub2 } = await admin.from("erplain_mo_submissions").select("*").eq("id", sub.id).single();
  const after = await refreshMo(admin, gql, sub2);
  if (action === "mo_delete") await admin.from("erplain_mo_submissions").update({ status: "deleted", deleted_at: new Date().toISOString() }).eq("id", sub.id);
  return json({ status: "success", message: "Fait dans Erplain.", ...after });
}

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
    let body: any = {};
    try { body = (await req.json()) ?? {}; action = body.action ?? "test"; } catch { /* no body */ }

    if (["sync", "plan", "create_mo", "mo_refresh", "mo_update", "mo_delete", "mo_transition"].includes(action)) {
      return await handleData(action, body, admin, token, claims.claims.sub as string);
    }

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

      // Targeted missing definitions needed for the OF planning (read first, with their direct deps)
      const failed = new Set<string>();
      const relevant: string[] = [];
      const SEEDS = ["PaginatorInfo", "LineItemOrder", "LineItem", "OrderStatus", "ShippingStatus", "DeliveryStatus",
        "StockAllocationStatus", "BillOfMaterial", "BillOfMaterialPaginator", "QueryBillOfMaterialsWhereWhereConditions",
        "ManufacturingOrderStatus", "ManufacturingOrderOperationType", "ManufacturingOrderLine", "ManufacturingOrderStep",
        "ManufacturingRoutingStep", "ManufacturingOrderInput", "TransitionManufacturingOrderStepInput"];
      if (!stopped) {
        let frontier = [...SEEDS];
        const seenSeed = new Set<string>();
        for (let depth = 0; depth < 3 && frontier.length && !stopped; depth++) {
          const next: string[] = [];
          for (const n of frontier) {
            if (seenSeed.has(n) || BUILTIN.has(n) || n.startsWith("__")) continue;
            seenSeed.add(n);
            if (!cache.has(n)) {
              const r = await readType(n);
              if (r === "timeout") { stopped = true; break; }
              if (r === "fail") { failed.add(n); continue; }
            }
            const t = cache.get(n);
            for (const f of [...(t.fields ?? []), ...(t.inputFields ?? [])]) {
              const r = named(f.type);
              // follow input objects / enums always, objects only for BOM/OF/line structures
              if (r && (t.kind === "INPUT_OBJECT" || /Status|Type$|Input$|BillOfMaterial|ManufacturingOrder|Routing|Component/i.test(r))) next.push(r);
            }
          }
          frontier = next;
        }
      }

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
