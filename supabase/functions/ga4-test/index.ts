// GA4 read-only connection test (admin only). Reads last 7 days: sessions by country
// and by traffic source. Stores nothing, never logs the service account key.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function pemToDer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

const b64url = (data: string | ArrayBuffer): string => {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

async function serviceAccountToken(sa: { client_email: string; private_key: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/analytics.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const key = await crypto.subtle.importKey(
    "pkcs8", pemToDer(sa.private_key), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${claims}`));
  const jwt = `${header}.${claims}.${b64url(sig)}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }).toString(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    throw new Error(`Jeton Google refusé (HTTP ${res.status}) : ${body.error_description ?? body.error ?? res.statusText}`);
  }
  return body.access_token;
}

async function runReport(token: string, propertyId: string, dimensions: string[]) {
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
      dimensions: dimensions.map((name) => ({ name })),
      metrics: [{ name: "sessions" }, { name: "totalUsers" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 25,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.message ?? res.statusText;
    throw Object.assign(new Error(`GA4 (HTTP ${res.status}) : ${msg}`), { http: res.status });
  }
  const dims = (body.dimensionHeaders ?? []).map((h: any) => h.name);
  const mets = (body.metricHeaders ?? []).map((h: any) => h.name);
  return (body.rows ?? []).map((r: any) => {
    const row: Record<string, string | number> = {};
    dims.forEach((d: string, i: number) => { row[d] = r.dimensionValues?.[i]?.value ?? ""; });
    mets.forEach((m: string, i: number) => { row[m] = Number(r.metricValues?.[i]?.value ?? 0); });
    return row;
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = req.headers.get("Authorization") ?? "";
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: u } = await admin.auth.getUser(auth.replace("Bearer ", ""));
  if (!u?.user) return json({ status: "error", message: "Non authentifié" }, 401);
  const { data: role } = await admin.from("user_roles").select("role, approved").eq("user_id", u.user.id).maybeSingle();
  if (role?.role !== "admin" || !role?.approved) return json({ status: "error", message: "Réservé à l'administrateur" }, 403);

  const saRaw = Deno.env.get("GA4_SERVICE_ACCOUNT_JSON");
  const propertyId = (Deno.env.get("GA4_PROPERTY_ID") ?? "").trim();
  if (!saRaw || !propertyId) return json({ status: "error", step: "config", message: "Secrets GA4_SERVICE_ACCOUNT_JSON ou GA4_PROPERTY_ID manquants" });
  if (!/^\d+$/.test(propertyId)) return json({ status: "error", step: "config", message: "GA4_PROPERTY_ID doit être numérique" });

  let sa: { client_email?: string; private_key?: string };
  try { sa = JSON.parse(saRaw); } catch {
    return json({ status: "error", step: "config", message: "GA4_SERVICE_ACCOUNT_JSON n'est pas un JSON valide" });
  }
  if (!sa.client_email || !sa.private_key) {
    return json({ status: "error", step: "config", message: "La clé JSON doit contenir client_email et private_key" });
  }

  try {
    const token = await serviceAccountToken(sa as { client_email: string; private_key: string });
    const [byCountry, bySource, totals] = await Promise.all([
      runReport(token, propertyId, ["country"]),
      runReport(token, propertyId, ["sessionSource", "sessionMedium"]),
      runReport(token, propertyId, []),
    ]);
    const totalSessions = Number((totals[0] as any)?.sessions ?? 0);
    const totalUsers = Number((totals[0] as any)?.totalUsers ?? 0);
    return json({
      status: "success",
      property_id: propertyId,
      service_account: sa.client_email,
      period: "7 derniers jours",
      total_sessions: totalSessions,
      total_users: totalUsers,
      by_country: byCountry,
      by_source: bySource,
    });
  } catch (e) {
    const err = e as Error & { http?: number };
    const hint = err.http === 403
      ? " — le compte de service n'a pas accès à cette propriété : ajouter son email en Lecteur dans l'admin GA4, et vérifier que l'API « Google Analytics Data API » est activée"
      : err.http === 404 ? " — propriété introuvable : vérifier GA4_PROPERTY_ID" : "";
    return json({ status: "error", step: "ga4", http: err.http, message: err.message + hint });
  }
});
