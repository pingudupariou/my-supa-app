// Merchant Center read-only connection test (admin only). Uses the GA4 service account.
// Only GET calls to the Merchant API; stores nothing, never logs the key.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

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
  if (!res.ok || !b.access_token) throw Object.assign(new Error(`Jeton Google refusé : ${b.error_description ?? b.error ?? res.statusText}`), { http: res.status, step: "token" });
  return b.access_token as string;
}

async function get(token: string, url: string, step: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const b = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = b?.error?.message ?? res.statusText;
    throw Object.assign(new Error(msg), { http: res.status, step });
  }
  return b;
}

function hint(http?: number, msg = "") {
  if (/not registered|register/i.test(msg)) return "Le projet Google Cloud doit être enregistré une fois auprès de la Merchant API (enregistrement développeur).";
  if (/has not been used|disabled|SERVICE_DISABLED/i.test(msg)) return "Activer « Merchant API » dans le projet Google Cloud du compte de service, puis réessayer après quelques minutes.";
  if (http === 403 || http === 401) return "Ajouter l'e-mail du compte de service dans Merchant Center → Paramètres → Personnes et accès (accès Standard).";
  if (http === 404) return "Compte introuvable : vérifier MERCHANT_CENTER_ID.";
  return "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: u } = await db.auth.getUser((req.headers.get("Authorization") ?? "").replace("Bearer ", ""));
  if (!u?.user) return json({ status: "error", message: "Non authentifié" }, 401);
  const { data: role } = await db.from("user_roles").select("role, approved").eq("user_id", u.user.id).maybeSingle();
  if (role?.role !== "admin" || !role?.approved) return json({ status: "error", message: "Réservé à l'administrateur" }, 403);

  const merchantId = (Deno.env.get("MERCHANT_CENTER_ID") ?? "").trim();
  let sa: any = {};
  try { sa = JSON.parse(Deno.env.get("GA4_SERVICE_ACCOUNT_JSON") ?? ""); } catch { /* handled below */ }
  if (!sa.client_email || !sa.private_key) return json({ status: "error", step: "config", message: "Clé du compte de service (GA4_SERVICE_ACCOUNT_JSON) absente ou invalide" });
  if (!/^\d+$/.test(merchantId)) return json({ status: "error", step: "config", service_account: sa.client_email, message: "MERCHANT_CENTER_ID manquant ou non numérique" });

  const body = await req.json().catch(() => ({}));

  if (body?.action === "register") {
    // One-time developer registration of the service account's GCP project. Requires explicit confirmation.
    if (body.confirm !== "ENREGISTRER") return json({ status: "error", step: "confirmation", message: "Confirmation explicite requise" }, 400);
    const email = String(body.developer_email ?? "").trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ status: "error", step: "config", message: "Adresse de contact invalide" }, 400);
    try {
      const token = await saToken(sa);
      const res = await fetch(`https://merchantapi.googleapis.com/accounts/v1/accounts/${merchantId}/developerRegistration:registerGcp`, {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ developerEmail: email }) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = b?.error?.message ?? res.statusText;
        const action = res.status === 403 || res.status === 401
          ? "Le compte de service doit avoir l'accès Administrateur dans Merchant Center le temps de l'enregistrement (repasser en Standard ensuite)."
          : /email/i.test(msg) ? "Google refuse cette adresse : utiliser un e-mail de compte Google valide." : hint(res.status, msg);
        return json({ status: "error", step: "enregistrement", http: res.status, service_account: sa.client_email, message: msg, action });
      }
      return json({ status: "registered", service_account: sa.client_email, google_response: b });
    } catch (e) {
      const err = e as Error & { http?: number; step?: string };
      return json({ status: "error", step: err.step ?? "enregistrement", http: err.http, message: err.message });
    }
  }

  try {
    const token = await saToken(sa);
    const account = await get(token, `https://merchantapi.googleapis.com/accounts/v1/accounts/${merchantId}`, "compte").catch((e) => ({ _error: e.message }));
    const offers: any[] = [];
    let pageToken = "";
    for (let p = 0; p < 4; p++) { // test: max 1 000 offers
      const b = await get(token, `https://merchantapi.googleapis.com/products/v1/accounts/${merchantId}/products?pageSize=250${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`, "produits");
      offers.push(...(b.products ?? []));
      pageToken = b.nextPageToken ?? "";
      if (!pageToken) break;
    }

    const countries = new Map<string, { approved: number; pending: number; disapproved: number }>();
    const labels = [0, 1, 2, 3, 4].map(() => new Set<string>());
    let withColor = 0, withGroup = 0, withIssues = 0;
    const shopifyVariantIds: number[] = [], skus: string[] = [];
    const sample = offers.slice(0, 15).map((o) => ({ offer_id: o.offerId, feed_label: o.feedLabel, title: (o.productAttributes ?? o.attributes)?.title }));
    for (const o of offers) {
      const a = o.productAttributes ?? o.attributes ?? {};
      if (a.color) withColor++;
      if (a.itemGroupId) withGroup++;
      if (o.productStatus?.itemLevelIssues?.length) withIssues++;
      [0, 1, 2, 3, 4].forEach((i) => { const v = a[`customLabel${i}`]; if (v && labels[i].size < 20) labels[i].add(v); });
      for (const d of o.productStatus?.destinationStatuses ?? []) {
        for (const [k, key] of [["approvedCountries", "approved"], ["pendingCountries", "pending"], ["disapprovedCountries", "disapproved"]] as const)
          for (const c of d[k] ?? []) {
            const e = countries.get(c) ?? { approved: 0, pending: 0, disapproved: 0 };
            e[key]++; countries.set(c, e);
          }
      }
      const m = String(o.offerId ?? "").match(/^shopify_[A-Z]{2}_\d+_(\d+)$/i);
      if (m) shopifyVariantIds.push(Number(m[1])); else if (o.offerId) skus.push(String(o.offerId));
    }

    // Shopify matching (read-only on our own tables).
    const ids = [...new Set(shopifyVariantIds)];
    let matchedById = 0, matchedBySku = 0;
    for (let i = 0; i < ids.length; i += 500) {
      const { data } = await db.from("shopify_variants").select("id").in("id", ids.slice(i, i + 500));
      matchedById += data?.length ?? 0;
    }
    const skuList = [...new Set(skus)].slice(0, 1000);
    if (skuList.length) {
      const { data } = await db.from("shopify_variants").select("sku").in("sku", skuList);
      matchedBySku = new Set((data ?? []).map((r: any) => r.sku)).size;
    }

    return json({
      status: "success",
      merchant_id: merchantId,
      service_account: sa.client_email,
      account_name: (account as any)?.accountName ?? null,
      account_note: (account as any)?._error ? `Nom du compte non lisible : ${(account as any)._error}` : null,
      offers_read: offers.length,
      truncated: !!pageToken,
      countries: [...countries.entries()].map(([country, v]) => ({ country, ...v })).sort((a, b) => b.approved - a.approved),
      custom_labels: labels.map((s, i) => ({ label: `custom_label_${i}`, values: [...s] })),
      with_color: withColor, with_item_group: withGroup, with_issues: withIssues,
      shopify_format_offers: shopifyVariantIds.length,
      matched_by_variant_id: matchedById,
      other_offers: skus.length,
      matched_by_sku: matchedBySku,
      sample,
    });
  } catch (e) {
    const err = e as Error & { http?: number; step?: string };
    return json({ status: "error", step: err.step ?? "merchant", http: err.http, service_account: sa.client_email, message: err.message, action: hint(err.http, err.message) });
  }
});
