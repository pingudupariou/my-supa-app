// Shopify read-only sync into shopify_* tables. Chunked: each call works ~90 s, then returns
// status "partial" with run_id; the caller (page or daily cron) calls again to continue.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const API_VERSION = "2025-07";
const BUDGET_MS = 90_000;
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const gid = (s: string | null | undefined) => (s ? Number(String(s).split("/").pop()) : null);
const num = (m: any) => Number(m?.shopMoney?.amount ?? 0) || 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const PRODUCTS_Q = `query($after: String) { products(first: 50, after: $after) {
  pageInfo { hasNextPage endCursor }
  nodes { id title status productType vendor updatedAt
    variants(first: 50) { nodes { id sku title price inventoryItem { unitCost { amount } } } } } } }`;

const ORDERS_Q = `query($after: String, $q: String) { orders(first: 25, after: $after, query: $q, sortKey: UPDATED_AT) {
  pageInfo { hasNextPage endCursor }
  nodes { id name createdAt updatedAt processedAt cancelledAt test sourceName
    displayFinancialStatus displayFulfillmentStatus
    shippingAddress { countryCodeV2 } billingAddress { countryCodeV2 }
    currentSubtotalPriceSet { shopMoney { amount currencyCode } }
    currentTotalDiscountsSet { shopMoney { amount } }
    currentTotalTaxSet { shopMoney { amount } }
    currentTotalPriceSet { shopMoney { amount } }
    totalShippingPriceSet { shopMoney { amount } }
    totalRefundedSet { shopMoney { amount } }
    refunds { id createdAt totalRefundedSet { shopMoney { amount } } }
    lineItems(first: 50) { pageInfo { hasNextPage }
      nodes { id sku title variantTitle quantity currentQuantity
        product { id } variant { id }
        discountedTotalSet { shopMoney { amount } } } } } } }`;

async function getToken(shop: string) {
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST", redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ grant_type: "client_credentials",
      client_id: Deno.env.get("SHOPIFY_CLIENT_ID")!, client_secret: Deno.env.get("SHOPIFY_CLIENT_SECRET")! }).toString(),
  });
  const t = await res.json().catch(() => ({}));
  if (!res.ok || !t.access_token) throw new Error(`token HTTP ${res.status} : ${t.error_description ?? t.error ?? res.statusText}`);
  return { token: t.access_token as string, scope: String(t.scope ?? "") };
}

async function gql(shop: string, token: string, query: string, variables: Record<string, unknown>) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
      method: "POST", headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
      body: JSON.stringify({ query, variables }),
    });
    if (res.status === 429 || res.status >= 500) { await sleep(2000 * (attempt + 1)); continue; }
    const g = await res.json().catch(() => ({}));
    const throttled = g.errors?.some?.((e: any) => e?.extensions?.code === "THROTTLED");
    if (throttled) { await sleep(2000 * (attempt + 1)); continue; }
    if (!res.ok || g.errors) throw new Error(`Shopify HTTP ${res.status} : ${JSON.stringify(g.errors ?? g).slice(0, 400)}`);
    // Respect the cost bucket: pause when it runs low.
    const avail = g.extensions?.cost?.throttleStatus?.currentlyAvailable;
    if (typeof avail === "number" && avail < 300) await sleep(1500);
    return g.data;
  }
  throw new Error("Shopify : trop de requêtes (limite atteinte), réessayer plus tard");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const body = await req.json().catch(() => ({}));
  const isCron = body?.mode === "cron";
  let userId: string | null = null;

  if (!isCron) {
    const { data: u } = await db.auth.getUser((req.headers.get("Authorization") ?? "").replace("Bearer ", ""));
    if (!u?.user) return json({ status: "error", message: "Non authentifié" }, 401);
    userId = u.user.id;
    const { data: r } = await db.from("user_roles").select("role, approved").eq("user_id", userId).maybeSingle();
    let perm = "hidden";
    if (r?.approved && r.role === "admin") perm = "write";
    else if (r?.approved) {
      const { data: p } = await db.from("tab_permissions").select("permission").eq("role", r.role).eq("tab_key", "marketing-intelligence").maybeSingle();
      perm = p?.permission ?? "hidden";
    }
    if (perm !== "write") return json({ status: "error", message: "Droit d'écriture sur Marketing Intelligence requis" }, 403);
  }

  const shop = (Deno.env.get("SHOPIFY_STORE_DOMAIN") ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop)) return json({ status: "error", message: "Domaine Shopify invalide" });

  // Load or create the run.
  let run: any;
  if (body?.run_id) {
    const { data } = await db.from("shopify_sync_runs").select("*").eq("id", body.run_id).maybeSingle();
    run = data;
    if (!run) return json({ status: "error", message: "Synchronisation introuvable" }, 404);
    if (run.status !== "running") return json({ status: run.status, run });
  } else if (isCron) {
    // Continue an unfinished cron run, otherwise start an incremental one (orders updated since last success − 1 day).
    const { data: open } = await db.from("shopify_sync_runs").select("*").eq("status", "running").eq("mode", "cron")
      .order("id", { ascending: false }).limit(1).maybeSingle();
    if (open) run = open;
    else {
      const { data: recent } = await db.from("shopify_sync_runs").select("id").gte("started_at", new Date(Date.now() - 6 * 3600e3).toISOString())
        .eq("mode", "cron").limit(1);
      if (recent?.length) return json({ status: "skipped", message: "Synchronisation quotidienne déjà faite" });
      const { data: last } = await db.from("shopify_sync_runs").select("started_at").eq("status", "success")
        .order("started_at", { ascending: false }).limit(1).maybeSingle();
      const since = new Date(new Date(last?.started_at ?? Date.now() - 2 * 86400e3).getTime() - 86400e3);
      const { data } = await db.from("shopify_sync_runs").insert({ mode: "cron", period_label: "Commandes modifiées (quotidien)",
        period_from: since.toISOString(), phase: "orders" }).select().single();
      run = data;
    }
  } else {
    const from = body?.from ? new Date(body.from) : null;
    const to = body?.to ? new Date(body.to) : null;
    if ((from && isNaN(+from)) || (to && isNaN(+to))) return json({ status: "error", message: "Dates invalides" }, 400);
    const { data: running } = await db.from("shopify_sync_runs").select("id, updated_at").eq("status", "running");
    const stale = (running ?? []).filter((r: any) => Date.now() - new Date(r.updated_at).getTime() > 10 * 60e3);
    if (stale.length) await db.from("shopify_sync_runs").update({ status: "error", message: "Interrompue", finished_at: new Date().toISOString() }).in("id", stale.map((r: any) => r.id));
    if ((running ?? []).length > stale.length) return json({ status: "error", message: "Une synchronisation est déjà en cours" }, 409);
    const { data } = await db.from("shopify_sync_runs").insert({ mode: "manual", period_label: String(body?.label ?? "").slice(0, 60) || null,
      period_from: from?.toISOString() ?? null, period_to: to?.toISOString() ?? null, triggered_by: userId, phase: "products" }).select().single();
    run = data;
  }

  const started = Date.now();
  const errors: any[] = Array.isArray(run.errors) ? run.errors : [];
  const patch: any = {};
  try {
    const { token, scope } = await getToken(shop);
    // Orders older than 60 days need read_all_orders.
    const old = !run.period_from || Date.now() - new Date(run.period_from).getTime() > 60 * 86400e3;
    if (old && !scope.includes("read_all_orders") && !errors.some((e) => e.code === "read_all_orders")) {
      errors.push({ code: "read_all_orders", message: "L'application Shopify n'a pas le droit « read_all_orders » : seules les commandes des 60 derniers jours sont accessibles." });
    }
    let { phase, cursor, pages, orders_imported, orders_updated, products_synced } = run;

    while (Date.now() - started < BUDGET_MS && phase !== "done") {
      if (phase === "products") {
        const d = await gql(shop, token, PRODUCTS_Q, { after: cursor });
        const nodes = d.products.nodes;
        if (nodes.length) {
          await db.from("shopify_products").upsert(nodes.map((p: any) => ({ id: gid(p.id), title: p.title, status: p.status,
            product_type: p.productType, vendor: p.vendor, updated_at_shop: p.updatedAt, synced_at: new Date().toISOString() })));
          const vars = nodes.flatMap((p: any) => p.variants.nodes.map((v: any) => ({ id: gid(v.id), product_id: gid(p.id), sku: v.sku,
            title: v.title, price: Number(v.price) || null, unit_cost: v.inventoryItem?.unitCost ? Number(v.inventoryItem.unitCost.amount) : null,
            synced_at: new Date().toISOString() })));
          if (vars.length) await db.from("shopify_variants").upsert(vars);
        }
        products_synced += nodes.length; pages++;
        if (d.products.pageInfo.hasNextPage) cursor = d.products.pageInfo.endCursor;
        else { phase = "orders"; cursor = null; }
      } else {
        const parts: string[] = [];
        const field = run.mode === "cron" ? "updated_at" : "created_at";
        if (run.period_from) parts.push(`${field}:>='${run.period_from}'`);
        if (run.period_to) parts.push(`${field}:<='${run.period_to}'`);
        const d = await gql(shop, token, ORDERS_Q, { after: cursor, q: parts.join(" ") || null });
        const nodes = d.orders.nodes;
        if (nodes.length) {
          const ids = nodes.map((o: any) => gid(o.id));
          const { data: existing } = await db.from("shopify_orders").select("id").in("id", ids);
          const known = new Set((existing ?? []).map((e: any) => Number(e.id)));
          const rows = nodes.map((o: any) => {
            const total = num(o.currentTotalPriceSet), tax = num(o.currentTotalTaxSet);
            return { id: gid(o.id), name: o.name, created_at_shop: o.createdAt, updated_at_shop: o.updatedAt, processed_at: o.processedAt,
              cancelled_at: o.cancelledAt, test: !!o.test, source_name: o.sourceName,
              country_code: o.shippingAddress?.countryCodeV2 ?? o.billingAddress?.countryCodeV2 ?? null,
              currency: o.currentSubtotalPriceSet?.shopMoney?.currencyCode ?? null,
              subtotal: num(o.currentSubtotalPriceSet), total_discounts: num(o.currentTotalDiscountsSet), total_tax: tax,
              total_shipping: num(o.totalShippingPriceSet), total_price: total, total_refunded: num(o.totalRefundedSet),
              // Shopify "current" totals already reflect edits and refunds: net = TTC actuel − taxes.
              net_revenue: Math.round((total - tax) * 100) / 100,
              financial_status: o.displayFinancialStatus, fulfillment_status: o.displayFulfillmentStatus,
              synced_at: new Date().toISOString() };
          });
          const up = await db.from("shopify_orders").upsert(rows);
          if (up.error) throw new Error(`Enregistrement commandes : ${up.error.message}`);
          await db.from("shopify_order_lines").delete().in("order_id", ids);
          await db.from("shopify_refunds").delete().in("order_id", ids);
          const lines = nodes.flatMap((o: any) => {
            if (o.lineItems.pageInfo.hasNextPage) errors.push({ code: "lines", message: `${o.name} : plus de 50 lignes, lignes suivantes ignorées` });
            return o.lineItems.nodes.map((l: any) => {
              const disc = num(l.discountedTotalSet);
              return { id: gid(l.id), order_id: gid(o.id), product_id: gid(l.product?.id), variant_id: gid(l.variant?.id), sku: l.sku,
                title: l.title, variant_title: l.variantTitle, quantity: l.quantity, current_quantity: l.currentQuantity,
                net_amount: l.quantity ? Math.round(disc * l.currentQuantity / l.quantity * 100) / 100 : 0 };
            });
          });
          if (lines.length) await db.from("shopify_order_lines").upsert(lines);
          const refunds = nodes.flatMap((o: any) => (o.refunds ?? []).map((r: any) => ({ id: gid(r.id), order_id: gid(o.id),
            created_at_shop: r.createdAt, amount: num(r.totalRefundedSet) })));
          if (refunds.length) await db.from("shopify_refunds").upsert(refunds);
          for (const id of ids) known.has(id) ? orders_updated++ : orders_imported++;
        }
        pages++;
        if (d.orders.pageInfo.hasNextPage) cursor = d.orders.pageInfo.endCursor;
        else { phase = "done"; cursor = null; }
      }
      await db.from("shopify_sync_runs").update({ phase, cursor, pages, orders_imported, orders_updated, products_synced, errors }).eq("id", run.id);
    }
    Object.assign(patch, { phase, cursor, pages, orders_imported, orders_updated, products_synced, errors });
    if (phase === "done") Object.assign(patch, { status: errors.length ? "warning" : "success", finished_at: new Date().toISOString(),
      message: `${orders_imported} importée(s), ${orders_updated} mise(s) à jour` });
  } catch (e) {
    errors.push({ code: "error", message: (e as Error).message });
    Object.assign(patch, { status: "error", errors, message: (e as Error).message, finished_at: new Date().toISOString() });
  }
  const { data: saved } = await db.from("shopify_sync_runs").update(patch).eq("id", run.id).select().single();
  return json({ status: saved?.status === "running" ? "partial" : saved?.status, run: saved });
});
