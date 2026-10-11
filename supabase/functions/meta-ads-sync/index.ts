// Meta Ads read-only sync (Graph API GET insights only — never mutates campaigns; token has ads_read only).
// Upserts per (campaign, day) and per (campaign, day, country) so reruns never duplicate.
// Manual: { from, to, run_id? } chunked by 31 days, returns next_from to continue. Cron: last 14 days.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const GRAPH = "https://graph.facebook.com/v21.0";
const BUDGET_MS = 100_000;
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const isDate = (s: unknown) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const addDays = (d: string, n: number) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const minD = (a: string, b: string) => (a < b ? a : b);

async function graphAll(path: string, token: string, params: Record<string, string>) {
  const url = new URL(`${GRAPH}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", token);
  let next: string | null = url.toString();
  const rows: any[] = [];
  while (next) {
    const res = await fetch(next);
    const t = await res.text();
    let j: any; try { j = JSON.parse(t); } catch { j = null; }
    if (!res.ok || j?.error) {
      const e = j?.error;
      const msg = e ? `${e.message} (code ${e.code}${e.error_subcode ? "/" + e.error_subcode : ""})` : t.slice(0, 300);
      throw new Error(`Meta HTTP ${res.status} : ${msg}`.replace(token, "***"));
    }
    rows.push(...(j.data ?? []));
    next = j.paging?.next ?? null;
  }
  return rows;
}

// One purchase figure per row: omni_purchase if present, else purchase — never both (avoids double count).
const pick = (arr: any[] | undefined) => {
  const o = arr?.find((a) => a.action_type === "omni_purchase");
  const p = o ?? arr?.find((a) => a.action_type === "purchase");
  return p ? Number(p.value) || 0 : 0;
};
const m = (r: any) => ({
  spend: Number(r.spend ?? 0), impressions: Number(r.impressions ?? 0), clicks: Number(r.clicks ?? 0),
  purchases: pick(r.actions), purchase_value: pick(r.action_values),
});

async function upsert(db: any, table: string, rows: any[], onConflict: string) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from(table).upsert(rows.slice(i, i + 500), { onConflict });
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
  const token = Deno.env.get("META_ADS_ACCESS_TOKEN");
  const rawAcc = Deno.env.get("META_ADS_ACCOUNT_ID");
  if (!token || !rawAcc) return json({ status: "error", message: "Secrets Meta Ads manquants" }, 500);
  const act = rawAcc.startsWith("act_") ? rawAcc : `act_${rawAcc}`;

  const today = new Date().toISOString().slice(0, 10);
  let from: string, to: string;
  if (isCron) { const n = Math.min(14, Math.max(1, Number(body.days) || 14)); from = addDays(today, -(n - 1)); to = today; }
  else {
    if (!isDate(body.from) || !isDate(body.to) || body.from > body.to) return json({ status: "error", message: "Période invalide" }, 400);
    // Meta keeps insights for 37 months max.
    from = body.from < addDays(today, -1095) ? addDays(today, -1095) : body.from; to = minD(body.to, today);
  }

  let run: any;
  if (body?.run_id) {
    const { data } = await db.from("meta_ads_sync_runs").select("*").eq("id", body.run_id).maybeSingle();
    if (!data) return json({ status: "error", message: "Synchronisation introuvable" }, 404);
    run = data;
  } else {
    const { data, error } = await db.from("meta_ads_sync_runs").insert({ mode: isCron ? "cron" : "manual",
      period_from: from, period_to: to, triggered_by: userId }).select().single();
    if (error) return json({ status: "error", message: error.message }, 500);
    run = data;
  }

  const started = Date.now();
  try {
    const camps = await graphAll(`/${act}/campaigns`, token, { fields: "id,name,status,objective", limit: "500" });
    await upsert(db, "meta_ads_campaigns", camps.map((c) => ({ id: Number(c.id), account_id: act, name: c.name,
      status: c.status, objective: c.objective, synced_at: new Date().toISOString() })), "id");
    const known = new Set(camps.map((c) => Number(c.id)));

    let cursor = from;
    let campaignRows = run.campaign_rows ?? 0, countryRows = run.country_rows ?? 0;
    const base = { level: "campaign", time_increment: "1", limit: "500",
      fields: "campaign_id,campaign_name,spend,impressions,clicks,actions,action_values" };
    while (cursor <= to && Date.now() - started < BUDGET_MS) {
      const end = minD(addDays(cursor, 30), to);
      const time_range = JSON.stringify({ since: cursor, until: end });
      const daily = await graphAll(`/${act}/insights`, token, { ...base, time_range });
      // Deleted campaigns are not listed by /campaigns: keep their name from insights.
      const extra = daily.filter((r) => !known.has(Number(r.campaign_id)));
      if (extra.length) {
        const uniq = new Map(extra.map((r) => [Number(r.campaign_id), r.campaign_name]));
        await upsert(db, "meta_ads_campaigns", [...uniq].map(([id, name]) => ({ id, account_id: act, name, status: "DELETED_OR_ARCHIVED" })), "id");
        uniq.forEach((_, id) => known.add(id));
      }
      await upsert(db, "meta_ads_campaign_daily", daily.map((r) => ({ account_id: act, campaign_id: Number(r.campaign_id),
        day: r.date_start, ...m(r), synced_at: new Date().toISOString() })), "campaign_id,day");
      campaignRows += daily.length;

      const geo = await graphAll(`/${act}/insights`, token, { ...base, time_range, breakdowns: "country" });
      await upsert(db, "meta_ads_country_daily", geo.map((r) => ({ account_id: act, campaign_id: Number(r.campaign_id),
        day: r.date_start, country_code: r.country ?? "unknown", ...m(r), synced_at: new Date().toISOString() })), "campaign_id,day,country_code");
      countryRows += geo.length;
      cursor = addDays(end, 1);
    }
    const done = cursor > to;
    await db.from("meta_ads_sync_runs").update({ campaigns: camps.length, campaign_rows: campaignRows, country_rows: countryRows,
      status: done ? "success" : "running", finished_at: done ? new Date().toISOString() : null,
      message: done ? null : `Repris à partir du ${cursor}` }).eq("id", run.id);
    return json({ status: done ? "success" : "partial", run_id: run.id, next_from: done ? null : cursor, to,
      campaigns: camps.length, campaign_rows: campaignRows, country_rows: countryRows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("meta-ads-sync", msg);
    await db.from("meta_ads_sync_runs").update({ status: "error", message: msg.slice(0, 1000), finished_at: new Date().toISOString() }).eq("id", run.id);
    return json({ status: "error", run_id: run.id, message: msg }, 502);
  }
});
