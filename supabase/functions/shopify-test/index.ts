// Shopify read-only connection test (admin only). Reads 5 products and 5 orders, stores nothing.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const API_VERSION = "2025-07";
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = req.headers.get("Authorization") ?? "";
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: u } = await admin.auth.getUser(auth.replace("Bearer ", ""));
  if (!u?.user) return json({ status: "error", message: "Non authentifié" }, 401);
  const { data: role } = await admin.from("user_roles").select("role, approved").eq("user_id", u.user.id).maybeSingle();
  if (role?.role !== "admin" || !role?.approved) return json({ status: "error", message: "Réservé à l'administrateur" }, 403);

  const shop = (Deno.env.get("SHOPIFY_STORE_DOMAIN") ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const clientId = Deno.env.get("SHOPIFY_CLIENT_ID");
  const clientSecret = Deno.env.get("SHOPIFY_CLIENT_SECRET");
  if (!shop || !clientId || !clientSecret) return json({ status: "error", step: "config", message: "Secrets Shopify manquants" });
  // The shop domain is not secret: shown so the admin can check it. Never derived from the admin URL.
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop)) {
    return json({ status: "error", step: "config", shop_domain: shop, message: `Domaine invalide « ${shop} » : il doit être de la forme boutique.myshopify.com` });
  }

  // 1. Server-to-server token (client credentials grant). Redirects are not followed:
  // a redirected POST becomes a GET, which Shopify answers with 405.
  const tokUrl = `https://${shop}/admin/oauth/access_token`;
  let tokRes: Response;
  try {
    tokRes = await fetch(tokUrl, {
      method: "POST",
      redirect: "manual",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }).toString(),
    });
  } catch (e) {
    return json({ status: "error", step: "token", shop_domain: shop, message: `Boutique injoignable : ${(e as Error).message}` });
  }
  if (tokRes.status >= 300 && tokRes.status < 400) {
    return json({ status: "error", step: "token", shop_domain: shop, http: tokRes.status,
      message: `Shopify redirige vers ${tokRes.headers.get("location") ?? "?"} : le domaine .myshopify.com configuré n'est probablement pas celui de la boutique` });
  }
  const tokText = await tokRes.text();
  let tok: any = {};
  try { tok = JSON.parse(tokText); } catch { /* not json */ }
  if (!tokRes.ok || !tok.access_token) {
    const hint = tokRes.status === 405 ? " — méthode refusée par Shopify : vérifier le domaine .myshopify.com"
      : tokRes.status === 400 || tokRes.status === 401 ? " — vérifier l'ID client / secret client et que l'application est installée sur cette boutique"
      : tokRes.status === 404 ? " — boutique introuvable à ce domaine" : "";
    const body = tokText.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);
    const raw = String(tok.error_description ?? tok.error ?? (body || tokRes.statusText));
    return json({ status: "error", step: "token", shop_domain: shop, http: tokRes.status, message: raw + hint });
  }

  // Temporary read-only diagnostic: granted scopes + one order older than 60 days.
  const reqBody = await req.json().catch(() => ({}));
  if (reqBody?.mode === "diag") {
    const cutoff = new Date(Date.now() - 61 * 86400e3).toISOString();
    const gq = async (query: string) => {
      const r = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
        method: "POST", headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": tok.access_token },
        body: JSON.stringify({ query }),
      });
      return { http: r.status, body: await r.json().catch(() => ({})) };
    };
    const inst = await gq(`{ currentAppInstallation { accessScopes { handle } } }`);
    const granted: string[] = inst.body?.data?.currentAppInstallation?.accessScopes?.map((s: any) => s.handle) ?? [];
    const old = await gq(`{ orders(first: 1, sortKey: CREATED_AT, reverse: true, query: "created_at:<'${cutoff}'") { nodes { id name createdAt } } }`);
    const oldOrder = old.body?.data?.orders?.nodes?.[0] ?? null;
    const oldError = old.body?.errors ? JSON.stringify(old.body.errors).slice(0, 500) : null;
    const hasAll = granted.includes("read_all_orders");
    const action = hasAll
      ? (oldOrder ? "Aucune action : l'historique complet est accessible." : "Droit accordé, mais aucune commande de plus de 60 jours trouvée.")
      : "Shopify n'a pas accordé read_all_orders à cette installation. 1) Dans le Dev Dashboard Shopify, demander l'accès protégé « Read all orders » (API access requests) et attendre l'approbation. 2) Puis, dans l'admin de la boutique, accepter la mise à jour des autorisations de Novaride Intelligence (ou réinstaller via le lien de la v3).";
    return json({ status: "diag", token_scope: tok.scope, granted_scopes: granted, scopes_http: inst.http,
      scopes_error: inst.body?.errors ? JSON.stringify(inst.body.errors).slice(0, 300) : null,
      cutoff, old_order: oldOrder, old_http: old.http, old_error: oldError, has_read_all_orders: hasAll, action });
  }

  // 2. Read 5 products and 5 orders.
  const query = `{
    shop { name myshopifyDomain currencyCode }
    products(first: 5, sortKey: UPDATED_AT, reverse: true) { nodes { id title status totalInventory } }
    orders(first: 5, sortKey: CREATED_AT, reverse: true) { nodes { id name createdAt displayFinancialStatus
      totalPriceSet { shopMoney { amount currencyCode } } shippingAddress { countryCodeV2 } } }
  }`;
  const gRes = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": tok.access_token },
    body: JSON.stringify({ query }),
  });
  const g = await gRes.json().catch(() => ({}));
  if (!gRes.ok || g.errors) {
    return json({ status: "error", step: "graphql", http: gRes.status, message: JSON.stringify(g.errors ?? g).slice(0, 500), scopes: tok.scope });
  }
  return json({ status: "success", scopes: tok.scope, shop: g.data?.shop, products: g.data?.products?.nodes ?? [], orders: g.data?.orders?.nodes ?? [] });
});
