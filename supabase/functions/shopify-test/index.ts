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
