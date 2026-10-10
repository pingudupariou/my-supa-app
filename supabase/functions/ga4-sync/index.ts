// GA4 read-only sync (Data API runReport only). Each chunk of days is replaced atomically per table
// (delete days then insert) so reruns never duplicate and stale combinations disappear.
// Tables are kept per dimension set: cube (day×channel×country×device) sessions/events are additive inside the cube;
// source/medium is a separate table (never summed with the cube); users are per day only (not additive across dims).
// Manual: { from, to, run_id? } chunked by 31 days, returns next_from. Cron: last 7 days (GA4 finalises data in ~72h).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BUDGET_MS = 100_000;
const EVENTS = ["view_item", "add_to_cart", "begin_checkout", "purchase"];
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const isDate = (s: unknown) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const addDays = (d: string, n: number) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const minD = (a: string, b: string) => (a < b ? a : b);
const gaDay = (s: string) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;

const b64url = (data: string | ArrayBuffer) => {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  let s = ""; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
function pemToDer(pem: string) {
  const bin = atob(pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, ""));
  const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer;
}
async function saToken(sa: { client_email: string; private_key: string }) {
  const now = Math.floor(Date.now() / 1000);
  const h = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const c = b64url(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/analytics.readonly",
    aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const key = await crypto.subtle.importKey("pkcs8", pemToDer(sa.private_key), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${h}.${c}`));
  const res = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${h}.${c}.${b64url(sig)}` }).toString() });
  const b = await res.json().catch(() => ({}));
  if (!res.ok || !b.access_token) throw new Error(`Jeton Google refusé (HTTP ${res.status}) : ${b.error_description ?? b.error ?? ""}`);
  return b.access_token as string;
}

async function report(token: string, prop: string, from: string, to: string, dims: string[], mets: string[], filter?: unknown) {
  const out: Record<string, any>[] = [];
  let offset = 0;
  for (;;) {
    const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${prop}:runReport`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ dateRanges: [{ startDate: from, endDate: to }], dimensions: dims.map((name) => ({ name })),
        metrics: mets.map((name) => ({ name })), dimensionFilter: filter, limit: 100000, offset, keepEmptyRows: false }),
    });
    const b = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`GA4 HTTP ${res.status} : ${b?.error?.message ?? res.statusText}`);
    for (const r of b.rows ?? []) {
      const o: Record<string, any> = {};
      dims.forEach((d, i) => { o[d] = r.dimensionValues?.[i]?.value ?? ""; });
      mets.forEach((m, i) => { o[m] = Number(r.metricValues?.[i]?.value ?? 0); });
      out.push(o);
    }
    offset += (b.rows ?? []).length;
    if (!b.rows?.length || offset >= Number(b.rowCount ?? 0)) break;
  }
  return out;
}

async function replace(db: any, table: string, from: string, to: string, rows: any[]) {
  const { error: de } = await db.from(table).delete().gte("day", from).lte("day", to);
  if (de) throw new Error(`${table}: ${de.message}`);
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from(table).insert(rows.slice(i, i + 500));
    if (error) throw new Error(`${table}: ${error.message}`);
  }
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
  const prop = (Deno.env.get("GA4_PROPERTY_ID") ?? "").trim();
  let sa: any; try { sa = JSON.parse(Deno.env.get("GA4_SERVICE_ACCOUNT_JSON") ?? ""); } catch { sa = null; }
  if (!/^\d+$/.test(prop) || !sa?.client_email || !sa?.private_key) return json({ status: "error", message: "Configuration GA4 incomplète" }, 500);

  const today = new Date().toISOString().slice(0, 10);
  let from: string, to: string;
  if (isCron) { from = addDays(today, -7); to = today; }
  else {
    if (!isDate(body.from) || !isDate(body.to) || body.from > body.to) return json({ status: "error", message: "Période invalide" }, 400);
    from = body.from; to = minD(body.to, today);
  }

  let run: any;
  if (body?.run_id) {
    const { data } = await db.from("ga4_sync_runs").select("*").eq("id", body.run_id).maybeSingle();
    if (!data) return json({ status: "error", message: "Synchronisation introuvable" }, 404);
    run = data;
  } else {
    const { data, error } = await db.from("ga4_sync_runs").insert({ mode: isCron ? "cron" : "manual", period_from: from, period_to: to, triggered_by: userId }).select().single();
    if (error) return json({ status: "error", message: error.message }, 500);
    run = data;
  }

  const started = Date.now();
  let cube = run.cube_rows ?? 0, src = run.source_rows ?? 0, days = run.day_rows ?? 0;
  let cursor = from;
  try {
    const token = await saToken(sa);
    while (cursor <= to && Date.now() - started < BUDGET_MS) {
      const end = minD(addDays(cursor, 30), to);
      const now = new Date().toISOString();
      const dims = ["date", "sessionDefaultChannelGroup", "countryId", "deviceCategory"];
      const [sess, ev, srcRows, users] = await Promise.all([
        report(token, prop, cursor, end, [...dims, "country"], ["sessions", "engagedSessions", "newUsers", "purchaseRevenue"]),
        report(token, prop, cursor, end, [...dims, "eventName"], ["eventCount"],
          { filter: { fieldName: "eventName", inListFilter: { values: EVENTS } } }),
        report(token, prop, cursor, end, ["date", "sessionSource", "sessionMedium"], ["sessions", "ecommercePurchases", "purchaseRevenue"]),
        report(token, prop, cursor, end, ["date"], ["totalUsers", "newUsers", "sessions"]),
      ]);
      const map = new Map<string, any>();
      const key = (r: any) => `${r.date}|${r.sessionDefaultChannelGroup}|${r.countryId || "ZZ"}|${r.deviceCategory}`;
      const get = (r: any) => {
        const k = key(r);
        let x = map.get(k);
        if (!x) { x = { day: gaDay(r.date), channel: r.sessionDefaultChannelGroup || "(not set)", country_code: r.countryId || "ZZ", country: null,
          device: r.deviceCategory || "(not set)", sessions: 0, engaged_sessions: 0, new_users: 0, view_item: 0, add_to_cart: 0,
          begin_checkout: 0, purchases: 0, purchase_revenue: 0, synced_at: now }; map.set(k, x); }
        return x;
      };
      for (const r of sess) { const x = get(r); x.country = r.country || x.country; x.sessions += r.sessions; x.engaged_sessions += r.engagedSessions; x.new_users += r.newUsers; x.purchase_revenue += r.purchaseRevenue; }
      for (const r of ev) { const x = get(r); const f = r.eventName === "purchase" ? "purchases" : r.eventName; x[f] += r.eventCount; }
      await replace(db, "ga4_daily_cube", cursor, end, [...map.values()]);
      const sm = new Map<string, any>();
      for (const r of srcRows) {
        const k = `${r.date}|${r.sessionSource}|${r.sessionMedium}`;
        const x = sm.get(k) ?? { day: gaDay(r.date), source: r.sessionSource || "(not set)", medium: r.sessionMedium || "(not set)", sessions: 0, purchases: 0, purchase_revenue: 0, synced_at: now };
        x.sessions += r.sessions; x.purchases += r.ecommercePurchases; x.purchase_revenue += r.purchaseRevenue; sm.set(k, x);
      }
      await replace(db, "ga4_daily_source", cursor, end, [...sm.values()]);
      await replace(db, "ga4_daily_users", cursor, end, users.map((r) => ({ day: gaDay(r.date), total_users: r.totalUsers, new_users: r.newUsers, sessions: r.sessions, synced_at: now })));
      cube += map.size; src += sm.size; days += users.length;
      cursor = addDays(end, 1);
    }
    const done = cursor > to;
    await db.from("ga4_sync_runs").update({ cube_rows: cube, source_rows: src, day_rows: days, status: done ? "success" : "running",
      finished_at: done ? new Date().toISOString() : null, message: done ? null : `Repris à partir du ${cursor}` }).eq("id", run.id);
    return json({ status: done ? "success" : "partial", run_id: run.id, next_from: done ? null : cursor, to, cube_rows: cube, source_rows: src, day_rows: days });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("ga4-sync", msg);
    await db.from("ga4_sync_runs").update({ status: "error", message: msg.slice(0, 1000), finished_at: new Date().toISOString() }).eq("id", run.id);
    return json({ status: "error", run_id: run.id, message: msg }, 502);
  }
});
