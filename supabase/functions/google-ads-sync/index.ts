// Google Ads read-only sync (GAQL search only — never mutates campaigns).
// Upserts per (campaign, day) and per (campaign, day, country) so reruns never duplicate.
// Manual: { from, to, run_id? } chunked by 31 days, returns next_from to continue. Cron: last 14 days.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const GATEWAY = "https://connector-gateway.lovable.dev/google_ads";
const API = "v25";
const BUDGET_MS = 100_000;
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const isDate = (s: unknown) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const addDays = (d: string, n: number) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const minD = (a: string, b: string) => (a < b ? a : b);

async function search(customer: string, query: string) {
  const rows: any[] = [];
  let pageToken: string | undefined;
  do {
    const res = await fetch(`${GATEWAY}/${API}/customers/${customer}/googleAds:search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
        "X-Connection-Api-Key": Deno.env.get("GOOGLE_ADS_API_KEY")!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(pageToken ? { query, pageToken } : { query }),
    });
    const t = await res.text();
    if (!res.ok) throw new Error(`Google Ads HTTP ${res.status} : ${t.slice(0, 500)}`);
    const j = JSON.parse(t);
    rows.push(...(j.results ?? []));
    pageToken = j.nextPageToken;
  } while (pageToken);
  return rows;
}

const m = (r: any) => ({
  cost: Number(r.metrics?.costMicros ?? 0) / 1e6,
  clicks: Number(r.metrics?.clicks ?? 0),
  impressions: Number(r.metrics?.impressions ?? 0),
  conversions: Number(r.metrics?.conversions ?? 0),
  conversions_value: Number(r.metrics?.conversionsValue ?? 0),
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
  if (!Deno.env.get("LOVABLE_API_KEY") || !Deno.env.get("GOOGLE_ADS_API_KEY"))
    return json({ status: "error", message: "Connexion Google Ads absente" }, 500);

  const customer = (Deno.env.get("GOOGLE_ADS_CUSTOMER_ID") ?? "6294818144").replace(/-/g, "");
  const today = new Date().toISOString().slice(0, 10);
  let from: string, to: string;
  if (isCron) { from = addDays(today, -14); to = today; }
  else {
    if (!isDate(body.from) || !isDate(body.to) || body.from > body.to) return json({ status: "error", message: "Période invalide" }, 400);
    from = body.from; to = minD(body.to, today);
  }

  let run: any;
  if (body?.run_id) {
    const { data } = await db.from("google_ads_sync_runs").select("*").eq("id", body.run_id).maybeSingle();
    if (!data) return json({ status: "error", message: "Synchronisation introuvable" }, 404);
    run = data;
  } else {
    const { data, error } = await db.from("google_ads_sync_runs").insert({ mode: isCron ? "cron" : "manual",
      period_from: from, period_to: to, triggered_by: userId }).select().single();
    if (error) return json({ status: "error", message: error.message }, 500);
    run = data;
  }

  const started = Date.now();
  try {
    // Campaigns (name, status, type) — includes removed ones so history keeps its labels.
    const camps = await search(customer, "SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type FROM campaign");
    await upsert(db, "google_ads_campaigns", camps.map((r) => ({ id: Number(r.campaign.id), customer_id: Number(customer),
      name: r.campaign.name, status: r.campaign.status, channel_type: r.campaign.advertisingChannelType, synced_at: new Date().toISOString() })), "id");

    const countryCodes = new Map<number, string>();
    let cursor = from;
    let campaignRows = run.campaign_rows ?? 0, countryRows = run.country_rows ?? 0;
    while (cursor <= to && Date.now() - started < BUDGET_MS) {
      const end = minD(addDays(cursor, 30), to);
      const range = `segments.date BETWEEN '${cursor}' AND '${end}'`;
      const daily = await search(customer, `SELECT campaign.id, segments.date, metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions, metrics.conversions_value FROM campaign WHERE ${range}`);
      await upsert(db, "google_ads_campaign_daily", daily.map((r) => ({ customer_id: Number(customer), campaign_id: Number(r.campaign.id),
        day: r.segments.date, ...m(r), synced_at: new Date().toISOString() })), "campaign_id,day");
      campaignRows += daily.length;

      // Country: physical location only (LOCATION_OF_PRESENCE) — avoids counting the same click twice.
      const geo = await search(customer, `SELECT campaign.id, segments.date, geographic_view.country_criterion_id, geographic_view.location_type, metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions, metrics.conversions_value FROM geographic_view WHERE ${range} AND geographic_view.location_type = 'LOCATION_OF_PRESENCE'`);
      const agg = new Map<string, any>();
      for (const r of geo) {
        const cid = Number(r.geographicView?.countryCriterionId ?? 0);
        const k = `${r.campaign.id}|${r.segments.date}|${cid}`;
        const cur = agg.get(k) ?? { customer_id: Number(customer), campaign_id: Number(r.campaign.id), day: r.segments.date, country_id: cid,
          cost: 0, clicks: 0, impressions: 0, conversions: 0, conversions_value: 0 };
        const v = m(r);
        for (const f of ["cost", "clicks", "impressions", "conversions", "conversions_value"] as const) cur[f] += v[f];
        agg.set(k, cur);
      }
      const missing = [...new Set([...agg.values()].map((x) => x.country_id))].filter((id) => id && !countryCodes.has(id));
      if (missing.length) {
        const g = await search(customer, `SELECT geo_target_constant.id, geo_target_constant.country_code FROM geo_target_constant WHERE geo_target_constant.id IN (${missing.join(",")})`);
        for (const x of g) countryCodes.set(Number(x.geoTargetConstant.id), x.geoTargetConstant.countryCode);
      }
      const rows = [...agg.values()].map((x) => ({ ...x, country_code: countryCodes.get(x.country_id) ?? null, synced_at: new Date().toISOString() }));
      await upsert(db, "google_ads_country_daily", rows, "campaign_id,day,country_id");
      countryRows += rows.length;
      cursor = addDays(end, 1);
    }
    const done = cursor > to;
    await db.from("google_ads_sync_runs").update({ campaigns: camps.length, campaign_rows: campaignRows, country_rows: countryRows,
      status: done ? "success" : "running", finished_at: done ? new Date().toISOString() : null,
      message: done ? null : `Repris à partir du ${cursor}` }).eq("id", run.id);
    return json({ status: done ? "success" : "partial", run_id: run.id, next_from: done ? null : cursor, to,
      campaigns: camps.length, campaign_rows: campaignRows, country_rows: countryRows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("google-ads-sync", msg);
    await db.from("google_ads_sync_runs").update({ status: "error", message: msg.slice(0, 1000), finished_at: new Date().toISOString() }).eq("id", run.id);
    return json({ status: "error", run_id: run.id, message: msg }, 502);
  }
});
