// Google Ads read-only structure snapshot (GAQL search only — never mutates).
// Each section is read independently; a failing section is recorded in `errors` without blocking the others.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const GATEWAY = "https://connector-gateway.lovable.dev/google_ads";
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const day = (n: number) => new Date(Date.now() - n * 86400e3).toISOString().slice(0, 10);

async function search(customer: string, query: string) {
  const rows: any[] = [];
  let pageToken: string | undefined;
  do {
    const res = await fetch(`${GATEWAY}/v25/customers/${customer}/googleAds:search`, {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`, "X-Connection-Api-Key": Deno.env.get("GOOGLE_ADS_API_KEY")!, "Content-Type": "application/json" },
      body: JSON.stringify(pageToken ? { query, pageToken } : { query }),
    });
    const t = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status} : ${t.slice(0, 400)}`);
    const j = JSON.parse(t);
    rows.push(...(j.results ?? []));
    pageToken = j.nextPageToken;
  } while (pageToken);
  return rows;
}
const micros = (v: any) => (v == null ? null : Number(v) / 1e6);

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
  if (!Deno.env.get("LOVABLE_API_KEY") || !Deno.env.get("GOOGLE_ADS_API_KEY")) return json({ status: "error", message: "Connexion Google Ads absente" }, 500);
  const customer = (Deno.env.get("GOOGLE_ADS_CUSTOMER_ID") ?? "6294818144").replace(/-/g, "");

  const { data: snap, error: se } = await db.from("google_ads_structure_snapshots").insert({ mode: isCron ? "cron" : "manual", triggered_by: userId }).select().single();
  if (se) return json({ status: "error", message: se.message }, 500);

  const data: Record<string, any> = {};
  const errors: any[] = [];
  const section = async (name: string, fn: () => Promise<any>) => {
    try { data[name] = await fn(); } catch (e) { errors.push({ section: name, message: (e instanceof Error ? e.message : String(e)).slice(0, 500) }); }
  };
  const range90 = `segments.date BETWEEN '${day(90)}' AND '${day(1)}'`;

  await section("campaigns", async () => (await search(customer, `SELECT campaign.id, campaign.name, campaign.status, campaign.primary_status, campaign.advertising_channel_type, campaign.advertising_channel_sub_type, campaign.bidding_strategy_type, campaign.maximize_conversion_value.target_roas, campaign.maximize_conversions.target_cpa_micros, campaign.target_roas.target_roas, campaign.target_cpa.target_cpa_micros, campaign.start_date_time, campaign.end_date_time, campaign.shopping_setting.merchant_id, campaign.shopping_setting.feed_label, campaign_budget.amount_micros, campaign_budget.explicitly_shared, campaign_budget.name FROM campaign WHERE campaign.status != 'REMOVED'`)).map((r) => ({
    id: r.campaign.id, name: r.campaign.name, status: r.campaign.status, primary_status: r.campaign.primaryStatus,
    type: r.campaign.advertisingChannelType, sub_type: r.campaign.advertisingChannelSubType, bidding: r.campaign.biddingStrategyType,
    target_roas: r.campaign.maximizeConversionValue?.targetRoas ?? r.campaign.targetRoas?.targetRoas ?? null,
    target_cpa: micros(r.campaign.maximizeConversions?.targetCpaMicros ?? r.campaign.targetCpa?.targetCpaMicros),
    start: r.campaign.startDateTime ?? null, end: r.campaign.endDateTime ?? null,
    feed_label: r.campaign.shoppingSetting?.feedLabel ?? null, merchant_id: r.campaign.shoppingSetting?.merchantId ?? null,
    budget: micros(r.campaignBudget?.amountMicros), budget_shared: !!r.campaignBudget?.explicitlyShared, budget_name: r.campaignBudget?.name ?? null,
  })));

  await section("budget_lost", async () => (await search(customer, `SELECT campaign.id, metrics.search_budget_lost_impression_share, metrics.search_impression_share FROM campaign WHERE campaign.status = 'ENABLED' AND segments.date DURING LAST_30_DAYS`)).map((r) => ({
    campaign_id: r.campaign.id, lost_budget: r.metrics?.searchBudgetLostImpressionShare ?? null, impression_share: r.metrics?.searchImpressionShare ?? null,
  })));

  // Conversion setup (read-only): which actions are primary / counted in "Conversions" used for bidding.
  await section("conversion_actions", async () => (await search(customer, `SELECT conversion_action.id, conversion_action.name, conversion_action.category, conversion_action.type, conversion_action.status, conversion_action.primary_for_goal, conversion_action.include_in_conversions_metric, conversion_action.counting_type, conversion_action.value_settings.default_value, conversion_action.value_settings.always_use_default_value FROM conversion_action WHERE conversion_action.status != 'REMOVED'`)).map((r) => ({
    id: r.conversionAction.id, name: r.conversionAction.name, category: r.conversionAction.category, type: r.conversionAction.type, status: r.conversionAction.status,
    primary: r.conversionAction.primaryForGoal ?? null, in_conversions: r.conversionAction.includeInConversionsMetric ?? null, counting: r.conversionAction.countingType,
    default_value: r.conversionAction.valueSettings?.defaultValue ?? null, always_default: r.conversionAction.valueSettings?.alwaysUseDefaultValue ?? null,
  })));
  await section("conversions_by_action_30d", async () => (await search(customer, `SELECT segments.conversion_action_name, segments.conversion_action_category, metrics.conversions, metrics.conversions_value, metrics.all_conversions, metrics.all_conversions_value FROM customer WHERE segments.date DURING LAST_30_DAYS`)).map((r) => ({
    name: r.segments?.conversionActionName, category: r.segments?.conversionActionCategory,
    conversions: Number(r.metrics?.conversions ?? 0), value: Number(r.metrics?.conversionsValue ?? 0), all_conversions: Number(r.metrics?.allConversions ?? 0), all_value: Number(r.metrics?.allConversionsValue ?? 0),
  })));

  await section("criteria", async () => {
    const rows = await search(customer, `SELECT campaign.id, campaign_criterion.type, campaign_criterion.negative, campaign_criterion.location.geo_target_constant, campaign_criterion.language.language_constant, campaign_criterion.keyword.text FROM campaign_criterion WHERE campaign.status != 'REMOVED' AND campaign_criterion.status != 'REMOVED' AND campaign_criterion.type IN ('LOCATION','LANGUAGE','KEYWORD')`);
    const geoIds = [...new Set(rows.map((r) => r.campaignCriterion.location?.geoTargetConstant?.split("/").pop()).filter(Boolean))];
    const names = new Map<string, string>();
    for (let i = 0; i < geoIds.length; i += 200) {
      const g = await search(customer, `SELECT geo_target_constant.id, geo_target_constant.country_code, geo_target_constant.name, geo_target_constant.target_type FROM geo_target_constant WHERE geo_target_constant.id IN (${geoIds.slice(i, i + 200).join(",")})`);
      for (const x of g) names.set(String(x.geoTargetConstant.id), x.geoTargetConstant.targetType === "Country" ? x.geoTargetConstant.countryCode : `${x.geoTargetConstant.name} (${x.geoTargetConstant.countryCode})`);
    }
    return rows.map((r) => {
      const c = r.campaignCriterion;
      const gid = c.location?.geoTargetConstant?.split("/").pop();
      return { campaign_id: r.campaign.id, type: c.type, negative: !!c.negative,
        value: c.type === "LOCATION" ? names.get(gid) ?? gid : c.type === "LANGUAGE" ? c.language?.languageConstant?.split("/").pop() : c.keyword?.text };
    });
  });

  await section("ad_groups", async () => (await search(customer, `SELECT campaign.id, ad_group.id, ad_group.name, ad_group.status, ad_group.type FROM ad_group WHERE ad_group.status != 'REMOVED' AND campaign.status != 'REMOVED'`)).map((r) => ({
    campaign_id: r.campaign.id, id: r.adGroup.id, name: r.adGroup.name, status: r.adGroup.status, type: r.adGroup.type,
  })));

  await section("asset_groups", async () => (await search(customer, `SELECT campaign.id, asset_group.id, asset_group.name, asset_group.status, asset_group.ad_strength, asset_group.primary_status FROM asset_group WHERE asset_group.status != 'REMOVED' AND campaign.status != 'REMOVED'`)).map((r) => ({
    campaign_id: r.campaign.id, id: r.assetGroup.id, name: r.assetGroup.name, status: r.assetGroup.status, strength: r.assetGroup.adStrength, primary_status: r.assetGroup.primaryStatus,
  })));

  await section("signals", async () => (await search(customer, `SELECT asset_group.id, asset_group_signal.search_theme.text, asset_group_signal.audience.audience FROM asset_group_signal WHERE asset_group.status != 'REMOVED'`)).map((r) => ({
    asset_group_id: r.assetGroup.id, search_theme: r.assetGroupSignal?.searchTheme?.text ?? null, audience: r.assetGroupSignal?.audience?.audience ?? null,
  })));

  await section("listing_groups_pmax", async () => (await search(customer, `SELECT asset_group.id, campaign.id, asset_group_listing_group_filter.id, asset_group_listing_group_filter.type, asset_group_listing_group_filter.parent_listing_group_filter, asset_group_listing_group_filter.case_value.product_custom_attribute.index, asset_group_listing_group_filter.case_value.product_custom_attribute.value, asset_group_listing_group_filter.case_value.product_item_id.value, asset_group_listing_group_filter.case_value.product_type.value, asset_group_listing_group_filter.case_value.product_brand.value, asset_group_listing_group_filter.case_value.product_category.category_id FROM asset_group_listing_group_filter WHERE asset_group.status != 'REMOVED' AND campaign.status != 'REMOVED'`)).map((r) => {
    const f = r.assetGroupListingGroupFilter; const cv = f.caseValue ?? {};
    return { campaign_id: r.campaign.id, asset_group_id: r.assetGroup.id, id: f.id, type: f.type, parent: f.parentListingGroupFilter?.split("~").pop() ?? null,
      dim: cv.productCustomAttribute ? `custom_label_${String(cv.productCustomAttribute.index ?? "INDEX0").replace("INDEX", "")}` : cv.productItemId ? "item_id" : cv.productType ? "product_type" : cv.productBrand ? "brand" : cv.productCategory ? "category" : null,
      value: cv.productCustomAttribute?.value ?? cv.productItemId?.value ?? cv.productType?.value ?? cv.productBrand?.value ?? cv.productCategory?.categoryId ?? null };
  }));

  await section("listing_groups_shopping", async () => (await search(customer, `SELECT campaign.id, ad_group.id, ad_group_criterion.criterion_id, ad_group_criterion.negative, ad_group_criterion.listing_group.type, ad_group_criterion.listing_group.parent_ad_group_criterion, ad_group_criterion.listing_group.case_value.product_custom_attribute.index, ad_group_criterion.listing_group.case_value.product_custom_attribute.value, ad_group_criterion.listing_group.case_value.product_item_id.value, ad_group_criterion.listing_group.case_value.product_type.value, ad_group_criterion.listing_group.case_value.product_brand.value FROM ad_group_criterion WHERE ad_group_criterion.type = 'LISTING_GROUP' AND ad_group_criterion.status != 'REMOVED' AND campaign.status != 'REMOVED'`)).map((r) => {
    const c = r.adGroupCriterion; const cv = c.listingGroup?.caseValue ?? {};
    return { campaign_id: r.campaign.id, ad_group_id: r.adGroup.id, id: c.criterionId, type: c.listingGroup?.type, negative: !!c.negative, parent: c.listingGroup?.parentAdGroupCriterion?.split("~").pop() ?? null,
      dim: cv.productCustomAttribute ? `custom_label_${String(cv.productCustomAttribute.index ?? "INDEX0").replace("INDEX", "")}` : cv.productItemId ? "item_id" : cv.productType ? "product_type" : cv.productBrand ? "brand" : null,
      value: cv.productCustomAttribute?.value ?? cv.productItemId?.value ?? cv.productType?.value ?? cv.productBrand?.value ?? null };
  }));

  await section("products_90d", async () => {
    const rows = await search(customer, `SELECT campaign.id, segments.product_item_id, metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions, metrics.conversions_value FROM shopping_performance_view WHERE ${range90}`);
    const agg = new Map<string, any>();
    for (const r of rows) {
      const item = r.segments?.productItemId; if (!item) continue;
      const k = `${r.campaign.id}|${item}`;
      const a = agg.get(k) ?? { campaign_id: r.campaign.id, item_id: item, cost: 0, clicks: 0, impressions: 0, conversions: 0, value: 0 };
      a.cost += Number(r.metrics?.costMicros ?? 0) / 1e6; a.clicks += Number(r.metrics?.clicks ?? 0); a.impressions += Number(r.metrics?.impressions ?? 0);
      a.conversions += Number(r.metrics?.conversions ?? 0); a.value += Number(r.metrics?.conversionsValue ?? 0);
      agg.set(k, a);
    }
    return [...agg.values()].map((a) => ({ ...a, cost: Math.round(a.cost * 100) / 100, value: Math.round(a.value * 100) / 100 }));
  });

  await section("changes", async () => (await search(customer, `SELECT change_event.change_date_time, change_event.change_resource_type, change_event.resource_change_operation, change_event.user_email, change_event.client_type, change_event.changed_fields, campaign.id FROM change_event WHERE change_event.change_date_time BETWEEN '${day(29)}' AND '${day(-1)}' ORDER BY change_event.change_date_time DESC LIMIT 500`)).map((r) => ({
    at: r.changeEvent.changeDateTime, resource: r.changeEvent.changeResourceType, op: r.changeEvent.resourceChangeOperation,
    by: r.changeEvent.userEmail ?? null, client: r.changeEvent.clientType, fields: r.changeEvent.changedFields ?? null, campaign_id: r.campaign?.id ?? null,
  })));

  const counts = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0]));
  const status = errors.length === 0 ? "success" : Object.keys(data).length ? "partial" : "error";
  await db.from("google_ads_structure_snapshots").update({ data, counts, errors, status, finished_at: new Date().toISOString() }).eq("id", snap.id);
  // Keep the 30 latest snapshots only.
  const { data: old } = await db.from("google_ads_structure_snapshots").select("id").order("taken_at", { ascending: false }).range(30, 200);
  if (old?.length) await db.from("google_ads_structure_snapshots").delete().in("id", old.map((o: any) => o.id));
  return json({ status, id: snap.id, counts, errors });
});
