// Merchant Center read-only sync (GET products only). Upsert by product resource name → no duplicates.
// Chunked: resumes from page_token stored in merchant_sync_runs. Offers absent from a COMPLETE run are removed.
// Shopify matching is strict: exact variant ID in offer ID, then unique exact SKU. Never by title.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BUDGET_MS = 90_000;
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function pemToDer(pem: string): ArrayBuffer {
  const bin = atob(pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, ""));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}
const b64url = (data: string | ArrayBuffer): string => {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  let s = ""; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
async function saToken(sa: { client_email: string; private_key: string }) {
  const now = Math.floor(Date.now() / 1000);
  const h = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const c = b64url(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/content",
    aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const key = await crypto.subtle.importKey("pkcs8", pemToDer(sa.private_key), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${h}.${c}`));
  const res = await fetch("https://oauth2.googleapis.com/token", { method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${h}.${c}.${b64url(sig)}` }).toString() });
  const b = await res.json().catch(() => ({}));
  if (!res.ok || !b.access_token) throw new Error(`Jeton Google refusé : ${b.error_description ?? b.error ?? res.status}`);
  return b.access_token as string;
}

const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();
const RANK: Record<string, number> = { approved: 3, pending: 2, disapproved: 1 };

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
  const merchantId = (Deno.env.get("MERCHANT_CENTER_ID") ?? "").trim();
  let sa: any = {};
  try { sa = JSON.parse(Deno.env.get("GA4_SERVICE_ACCOUNT_JSON") ?? ""); } catch { /* */ }
  if (!sa.client_email || !/^\d+$/.test(merchantId)) return json({ status: "error", message: "Configuration Merchant Center incomplète" }, 500);

  // Resume a running run (< 30 min) or start a new one.
  const since = new Date(Date.now() - 30 * 60_000).toISOString();
  let { data: run } = await db.from("merchant_sync_runs").select("*").eq("status", "running").gte("started_at", since)
    .order("started_at", { ascending: false }).limit(1).maybeSingle();
  if (!run) {
    if (isCron) {
      const today = new Date().toISOString().slice(0, 10);
      const { data: done } = await db.from("merchant_sync_runs").select("id").eq("status", "success").gte("started_at", today).limit(1);
      if (done?.length && !body.force) return json({ status: "skipped", message: "Déjà synchronisé aujourd'hui" });
    }
    await db.from("merchant_sync_runs").update({ status: "error", error: "Interrompue", finished_at: new Date().toISOString() }).eq("status", "running");
    const { data, error } = await db.from("merchant_sync_runs").insert({ mode: isCron ? "cron" : "manual", triggered_by: userId }).select().single();
    if (error) return json({ status: "error", message: error.message }, 500);
    run = data;
  }

  const started = Date.now();
  try {
    // Shopify variants in memory for strict matching.
    const variants = new Map<number, number | null>();
    const skuMap = new Map<string, { id: number; pid: number | null }[]>();
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from("shopify_variants").select("id, product_id, sku").range(from, from + 999);
      if (error) throw new Error(error.message);
      for (const v of data ?? []) {
        variants.set(Number(v.id), v.product_id);
        const k = norm(v.sku);
        if (k) skuMap.set(k, [...(skuMap.get(k) ?? []), { id: Number(v.id), pid: v.product_id }]);
      }
      if (!data || data.length < 1000) break;
    }
    const products = new Set([...variants.values()].filter(Boolean).map(Number));

    const token = await saToken(sa);
    let pageToken: string = run.page_token ?? "";
    let read = run.offers_read, matched = run.matched;
    do {
      const url = `https://merchantapi.googleapis.com/products/v1/accounts/${merchantId}/products?pageSize=1000${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`Merchant API HTTP ${res.status} : ${b?.error?.message ?? res.statusText}`);
      const offers: any[] = b.products ?? [];
      const rows: any[] = [], countries: any[] = [];
      for (const o of offers) {
        const a = o.productAttributes ?? o.attributes ?? {};
        const offerId = String(o.offerId ?? "");
        let vid: number | null = null, pid: number | null = null, method = "none";
        const m = offerId.match(/shopify_[a-z]{2,3}_(\d+)_(\d+)/i);
        if (m && variants.has(Number(m[2]))) { vid = Number(m[2]); pid = variants.get(vid) ?? Number(m[1]); method = "variant_id"; }
        // Format "<productId>_<sku>" (other Shopify feeds): exact SKU inside the same Shopify product.
        const ps = offerId.match(/^(\d{8,})_(.+)$/);
        if (!vid && ps) {
          const hit = (skuMap.get(norm(ps[2])) ?? []).filter((h) => Number(h.pid) === Number(ps[1]));
          if (hit.length === 1) { vid = hit[0].id; pid = hit[0].pid; method = "product_sku"; }
        }
        if (!vid) {
          for (const k of [norm(a.sku), norm(offerId), norm(a.mpn)]) {
            const hit = k ? skuMap.get(k) : undefined;
            if (hit?.length === 1) { vid = hit[0].id; pid = hit[0].pid; method = "sku"; break; }
            if (hit && hit.length > 1) { method = "sku_ambiguous"; break; }
          }
        }
        if (!vid && method === "none") {
          const gp = m ? Number(m[1]) : ps ? Number(ps[1]) : /^\d+$/.test(String(a.itemGroupId ?? "")) ? Number(a.itemGroupId) : null;
          if (gp && products.has(gp)) { pid = gp; method = "product_only"; }
        }
        if (vid) matched++;
        const price = a.price?.amountMicros ? Number(a.price.amountMicros) / 1e6 : null;
        rows.push({ name: o.name, offer_id: offerId, feed_label: o.feedLabel ?? null, content_language: o.contentLanguage ?? null,
          title: a.title ?? null, sku: a.sku ?? null, gtin: Array.isArray(a.gtins) ? a.gtins[0] : a.gtin ?? null, mpn: a.mpn ?? null,
          brand: a.brand ?? null, color: a.color ?? null, size: a.size ?? null, item_group_id: a.itemGroupId ?? null,
          product_type: Array.isArray(a.productTypes) ? a.productTypes[0] : a.productType ?? null,
          image_link: a.imageLink ?? null, link: a.link ?? null, price, currency: a.price?.currencyCode ?? null,
          availability: a.availability ?? null,
          custom_label_0: a.customLabel0 ?? null, custom_label_1: a.customLabel1 ?? null, custom_label_2: a.customLabel2 ?? null,
          custom_label_3: a.customLabel3 ?? null, custom_label_4: a.customLabel4 ?? null,
          issues: (o.productStatus?.itemLevelIssues ?? []).map((i: any) => ({ code: i.code, severity: i.severity, description: i.description,
            countries: i.applicableCountries, destination: i.reportingContext })),
          shopify_variant_id: vid, shopify_product_id: pid, match_method: method, last_run_id: run.id, synced_at: new Date().toISOString() });
        // One row per offer × country: best status across destinations, details kept in jsonb (no double counting).
        const per = new Map<string, Record<string, string>>();
        for (const d of o.productStatus?.destinationStatuses ?? []) {
          for (const [k, st] of [["approvedCountries", "approved"], ["pendingCountries", "pending"], ["disapprovedCountries", "disapproved"]] as const)
            for (const c of d[k] ?? []) { const e = per.get(c) ?? {}; e[d.reportingContext ?? "?"] = st; per.set(c, e); }
        }
        for (const [country, dest] of per) {
          const best = Object.values(dest).sort((x, y) => RANK[y] - RANK[x])[0];
          countries.push({ offer_name: o.name, country, status: best, destinations: dest });
        }
      }
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await db.from("merchant_offers").upsert(rows.slice(i, i + 500), { onConflict: "name" });
        if (error) throw new Error(`merchant_offers: ${error.message}`);
      }
      const names = rows.map((r) => r.name);
      for (let i = 0; i < names.length; i += 200) await db.from("merchant_offer_countries").delete().in("offer_name", names.slice(i, i + 200));
      for (let i = 0; i < countries.length; i += 500) {
        const { error } = await db.from("merchant_offer_countries").upsert(countries.slice(i, i + 500), { onConflict: "offer_name,country" });
        if (error) throw new Error(`merchant_offer_countries: ${error.message}`);
      }
      read += offers.length;
      pageToken = b.nextPageToken ?? "";
      await db.from("merchant_sync_runs").update({ page_token: pageToken || null, offers_read: read, matched }).eq("id", run.id);
    } while (pageToken && Date.now() - started < BUDGET_MS);

    if (pageToken) return json({ status: "partial", run_id: run.id, offers_read: read, matched });
    // Complete read: remove offers no longer in Merchant Center.
    const { data: gone } = await db.from("merchant_offers").delete().neq("last_run_id", run.id).select("name");
    await db.from("merchant_sync_runs").update({ status: "success", removed: gone?.length ?? 0, finished_at: new Date().toISOString() }).eq("id", run.id);
    return json({ status: "success", run_id: run.id, offers_read: read, matched, removed: gone?.length ?? 0 });
  } catch (e) {
    const msg = (e as Error).message;
    await db.from("merchant_sync_runs").update({ status: "error", error: msg, finished_at: new Date().toISOString() }).eq("id", run.id);
    return json({ status: "error", run_id: run.id, message: msg }, 500);
  }
});
