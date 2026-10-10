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

  const shop = (Deno.env.get("SHOPIFY_STORE_DOMAIN") ?? "").trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const clientId = Deno.env.get("SHOPIFY_CLIENT_ID");
  const clientSecret = Deno.env.get("SHOPIFY_CLIENT_SECRET");
  if (!shop || !clientId || !clientSecret) return json({ status: "error", step: "config", message: "Secrets Shopify manquants" });

  // 1. Server-to-server token (client credentials grant).
  const tokRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }),
  });
  const tokText = await tokRes.text();
  let tok: any = {};
  try { tok = JSON.parse(tokText); } catch { /* not json */ }
  if (!tokRes.ok || !tok.access_token) {
    return json({ status: "error", step: "token", http: tokRes.status, message: tok.error_description ?? tok.error ?? tokText.slice(0, 300) });
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
