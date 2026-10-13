// Supervised Google Ads publication of validated campaign drafts.
// plan     : builds the operations SERVER-SIDE from the draft (client cannot inject operations) and logs them.
// preflight: re-checks the draft is unchanged and asks Google to validate the batch (validateOnly — nothing is written).
// execute  : admin only + typed confirmation + fresh successful preflight + server switch GOOGLE_ADS_ALLOW_WRITE=true.
//            Campaigns are always created PAUSED. Every step is written to google_ads_publish_actions.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const GATEWAY = "https://connector-gateway.lovable.dev/google_ads";
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const GEO: Record<string, number> = { FR: 2250, BE: 2056, DE: 2276, ES: 2724, IT: 2380, NL: 2528, CH: 2756, GB: 2826, US: 2840, AT: 2040, PT: 2620, LU: 2442, CA: 2124, IE: 2372, DK: 2208, SE: 2752, NO: 2578, FI: 2246, PL: 2616, AU: 2036 };
const LANG: Record<string, number> = { en: 1000, de: 1001, fr: 1002, es: 1003, it: 1004, nl: 1010, pt: 1014, sv: 1015, da: 1009, no: 1013, fi: 1011, pl: 1030 };
const pilotFingerprint = (p: any) => sha({ k: p.kind, c: p.campaign_id, b: p.proposed_daily_budget, r: p.proposed_target_roas, s: p.status === "en_approbation" ? "acceptee" : p.status, u: p.title });
const PREFLIGHT_TTL_MS = 30 * 60e3;

async function sha(o: unknown) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(o)));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
const draftFingerprint = (d: any) => sha({ n: d.name, t: d.campaign_type, c: d.countries, l: d.languages, b: d.daily_budget, bi: d.bidding, p: d.products?.offer_ids, a: d.ad_content, s: d.status, u: d.updated_at });

async function mutate(customer: string, operations: any[], validateOnly: boolean) {
  const res = await fetch(`${GATEWAY}/v25/customers/${customer}/googleAds:mutate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`, "X-Connection-Api-Key": Deno.env.get("GOOGLE_ADS_API_KEY")!, "Content-Type": "application/json" },
    body: JSON.stringify({ mutateOperations: operations, validateOnly, partialFailure: false }),
  });
  const text = await res.text();
  let body: any; try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 2000) }; }
  return { ok: res.ok, status: res.status, body };
}
function googleErrors(body: any): string[] {
  const out: string[] = [];
  const details = body?.error?.details ?? body?.[0]?.error?.details ?? [];
  for (const d of details) for (const e of d?.errors ?? []) out.push(`${Object.values(e.errorCode ?? {}).join("/")} : ${e.message}${e.location?.fieldPathElements ? ` (${e.location.fieldPathElements.map((f: any) => f.fieldName).join(".")})` : ""}`);
  if (!out.length && body?.error?.message) out.push(body.error.message);
  return out.slice(0, 30);
}

function bidding(d: any) {
  const b = d.bidding ?? {};
  const roas = b.target_roas ? Number(b.target_roas) / 100 : undefined;
  switch (b.strategy) {
    case "MAXIMIZE_CONVERSION_VALUE": return { maximizeConversionValue: roas ? { targetRoas: roas } : {} };
    case "TARGET_ROAS": return { maximizeConversionValue: { targetRoas: roas } };
    case "MAXIMIZE_CONVERSIONS": return { maximizeConversions: b.target_cpa ? { targetCpaMicros: String(Math.round(b.target_cpa * 1e6)) } : {} };
    case "MAXIMIZE_CLICKS": return { targetSpend: {} };
    case "MANUAL_CPC": return { manualCpc: { enhancedCpcEnabled: false } };
  }
  return null;
}

/** Builds the full create chain. Returns blockers instead of operations when the draft cannot be expressed safely. */
function buildOperations(c: string, d: any, merchantId: string | null, euPolitical: boolean) {
  const blockers: string[] = [];
  if (d.status !== "valide") blockers.push("Le projet doit être validé.");
  if (d.campaign_type === "PERFORMANCE_MAX") blockers.push("PMax : images, logo et nom commercial obligatoires — non gérés par le constructeur pour l'instant ; publication PMax désactivée.");
  const bid = bidding(d); if (!bid) blockers.push("Stratégie d'enchères non reconnue.");
  const geos = (d.countries ?? []).map((x: string) => [x, GEO[x]]);
  for (const [x, g] of geos) if (!g) blockers.push(`Pays ${x} non pris en charge pour la publication.`);
  const langs = (d.languages ?? []).map((x: string) => [x, LANG[x]]);
  for (const [x, g] of langs) if (!g) blockers.push(`Langue ${x} non prise en charge.`);
  if (!d.daily_budget || d.daily_budget <= 0) blockers.push("Budget manquant.");
  const offers: string[] = d.products?.offer_ids ?? [];
  if (d.campaign_type === "SHOPPING") {
    if (!merchantId) blockers.push("Identifiant Merchant Center introuvable dans les campagnes existantes.");
    if (!offers.length) blockers.push("Aucun produit retenu.");
    if (offers.length > 300) blockers.push(`${offers.length} produits : au-delà de 300, subdivisez le projet.`);
  }
  if (blockers.length) return { blockers, operations: [] };

  const C = `customers/${c}`;
  const budget = `${C}/campaignBudgets/-1`, camp = `${C}/campaigns/-2`, ag = `${C}/adGroups/-3`;
  const ops: any[] = [];
  const add = (description: string, operation: any) => ops.push({ description, operation });
  add("Créer le budget dédié de la campagne", { campaignBudgetOperation: { create: { resourceName: budget, name: `${d.name} — budget ${d.id.slice(0, 8)}`, amountMicros: String(Math.round(Number(d.daily_budget) * 1e6)), deliveryMethod: "STANDARD", explicitlyShared: false } } });
  const campaign: any = { resourceName: camp, name: d.name, status: "PAUSED", campaignBudget: budget, ...bid,
    containsEuPoliticalAdvertising: euPolitical ? "CONTAINS_EU_POLITICAL_ADVERTISING" : "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING" };
  if (d.campaign_type === "SEARCH") Object.assign(campaign, { advertisingChannelType: "SEARCH", networkSettings: { targetGoogleSearch: true, targetSearchNetwork: false, targetContentNetwork: false } });
  else Object.assign(campaign, { advertisingChannelType: "SHOPPING", shoppingSetting: { merchantId: String(merchantId), ...(d.countries.length === 1 ? { feedLabel: d.countries[0] } : {}) } });
  add("Créer la campagne en pause (aucune diffusion ni dépense)", { campaignOperation: { create: campaign } });
  for (const [x, g] of geos) add(`Cibler le pays ${x}`, { campaignCriterionOperation: { create: { campaign: camp, location: { geoTargetConstant: `geoTargetConstants/${g}` } } } });
  for (const [x, g] of langs) add(`Cibler la langue ${x}`, { campaignCriterionOperation: { create: { campaign: camp, language: { languageConstant: `languageConstants/${g}` } } } });
  const a = d.ad_content ?? {};
  if (d.campaign_type === "SEARCH") {
    add("Créer le groupe d'annonces", { adGroupOperation: { create: { resourceName: ag, campaign: camp, name: `${d.name} — groupe 1`, status: "ENABLED", type: "SEARCH_STANDARD" } } });
    for (const k of a.keywords ?? []) {
      const exact = /^\[.*\]$/.test(k), phrase = /^".*"$/.test(k);
      add(`Ajouter le mot-clé ${k}`, { adGroupCriterionOperation: { create: { adGroup: ag, status: "ENABLED", keyword: { text: k.replace(/^[[\]"]+|[[\]"]+$/g, ""), matchType: exact ? "EXACT" : phrase ? "PHRASE" : "BROAD" } } } });
    }
    for (const k of a.negatives ?? []) add(`Exclure le mot-clé ${k}`, { campaignCriterionOperation: { create: { campaign: camp, negative: true, keyword: { text: k, matchType: "BROAD" } } } });
    add("Créer l'annonce responsive", { adGroupAdOperation: { create: { adGroup: ag, status: "ENABLED", ad: { finalUrls: [a.final_url], responsiveSearchAd: { headlines: (a.headlines ?? []).slice(0, 15).map((text: string) => ({ text })), descriptions: (a.descriptions ?? []).slice(0, 4).map((text: string) => ({ text })) } } } } });
  } else {
    add("Créer le groupe de produits Shopping", { adGroupOperation: { create: { resourceName: ag, campaign: camp, name: `${d.name} — produits`, status: "ENABLED", type: "SHOPPING_PRODUCT_ADS" } } });
    add("Créer l'annonce Shopping (fiches Merchant)", { adGroupAdOperation: { create: { adGroup: ag, status: "ENABLED", ad: { shoppingProductAd: {} } } } });
    const root = `${C}/adGroupCriteria/-3~-10`;
    add("Créer l'arborescence des produits", { adGroupCriterionOperation: { create: { resourceName: root, adGroup: ag, status: "ENABLED", listingGroup: { type: "SUBDIVISION" } } } });
    offers.forEach((o, i) => add(`Inclure le produit ${o}`, { adGroupCriterionOperation: { create: { adGroup: ag, status: "ENABLED", cpcBidMicros: "500000", listingGroup: { type: "UNIT", parentAdGroupCriterion: root, caseValue: { productItemId: { value: o.toLowerCase() } } } } } }));
    add("Exclure tous les autres produits", { adGroupCriterionOperation: { create: { adGroup: ag, negative: true, listingGroup: { type: "UNIT", parentAdGroupCriterion: root, caseValue: { productItemId: {} } } } } });
  }
  if (ops.length > 1000) return { blockers: ["Plus de 1 000 opérations : subdivisez le projet."], operations: [] };
  return { blockers: [], operations: ops };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: u } = await db.auth.getUser((req.headers.get("Authorization") ?? "").replace("Bearer ", ""));
    if (!u?.user) return json({ error: "Non authentifié" }, 401);
    const uid = u.user.id;
    const { data: r } = await db.from("user_roles").select("role, approved").eq("user_id", uid).maybeSingle();
    const isAdmin = !!r?.approved && r.role === "admin";
    let perm = isAdmin ? "write" : "hidden";
    if (!isAdmin && r?.approved) perm = (await db.from("tab_permissions").select("permission").eq("role", r.role).eq("tab_key", "marketing-intelligence").maybeSingle()).data?.permission ?? "hidden";
    if (perm !== "write") return json({ error: "Droit d'écriture Marketing requis" }, 403);

    const body = await req.json().catch(() => ({}));
    const mode = String(body.mode ?? "");
    const writeEnabled = Deno.env.get("GOOGLE_ADS_ALLOW_WRITE") === "true";
    if (mode === "status") return json({ write_enabled: writeEnabled, is_admin: isAdmin });
    if (!Deno.env.get("LOVABLE_API_KEY") || !Deno.env.get("GOOGLE_ADS_API_KEY")) return json({ error: "Connexion Google Ads absente" }, 500);
    const customer = (Deno.env.get("GOOGLE_ADS_CUSTOMER_ID") ?? "6294818144").replace(/-/g, "");

    const loadAction = async () => {
      if (typeof body.action_id !== "string") throw new Error("action_id requis");
      const { data: a } = await db.from("google_ads_publish_actions").select("*").eq("id", body.action_id).maybeSingle();
      if (!a) throw new Error("Action introuvable");
      if (a.pilot_action_id) {
        const { data: p } = await db.from("google_ads_pilot_actions").select("*").eq("id", a.pilot_action_id).maybeSingle();
        if (!p) throw new Error("Proposition introuvable");
        if (a.draft_snapshot.fingerprint !== await pilotFingerprint(p)) throw new Error("La proposition a été modifiée depuis la préparation : préparez-la à nouveau.");
        return { a, d: null as any, p };
      }
      const { data: d } = await db.from("google_ads_campaign_drafts").select("*").eq("id", a.draft_id).maybeSingle();
      if (!d) throw new Error("Projet introuvable");
      if (a.draft_snapshot.fingerprint !== await draftFingerprint(d)) throw new Error("Le projet a été modifié depuis la préparation : préparez une nouvelle publication.");
      return { a, d, p: null as any };
    };

    if (mode === "plan") {
      if (typeof body.draft_id !== "string") return json({ error: "draft_id requis" }, 400);
      if (typeof body.eu_political !== "boolean") return json({ error: "Déclaration « publicité politique UE » requise (oui ou non)." }, 400);
      const { data: d } = await db.from("google_ads_campaign_drafts").select("*").eq("id", body.draft_id).maybeSingle();
      if (!d) return json({ error: "Projet introuvable" }, 404);
      const { data: snap } = await db.from("google_ads_structure_snapshots").select("data").in("status", ["success", "partial"]).order("taken_at", { ascending: false }).limit(1).maybeSingle();
      const merchantId = (snap?.data?.campaigns ?? []).find((c: any) => c.merchant_id)?.merchant_id ?? Deno.env.get("MERCHANT_CENTER_ID") ?? null;
      const dupName = (snap?.data?.campaigns ?? []).some((c: any) => String(c.name).trim().toLowerCase() === String(d.name).trim().toLowerCase());
      const { blockers, operations } = buildOperations(customer, d, merchantId, body.eu_political);
      if (dupName) blockers.push("Une campagne Google Ads porte déjà ce nom.");
      if (blockers.length) return json({ blockers });
      const summary = `Créer en pause la campagne ${d.campaign_type === "SEARCH" ? "Search" : "Shopping"} « ${d.name} » (${d.countries.join(", ")}, ${d.daily_budget} €/jour) — ${operations.length} opérations.`;
      const { data: a, error } = await db.from("google_ads_publish_actions").insert({
        draft_id: d.id, draft_snapshot: { fingerprint: await draftFingerprint(d), draft: d, eu_political: body.eu_political }, action_kind: "create_campaign",
        summary, operations, status: "prevue", requested_by: uid,
      }).select().single();
      if (error) throw error;
      return json({ action: a });
    }

    if (mode === "plan_change") {
      // Modification of an EXISTING campaign from a pilot proposal. Operations built here from the live structure snapshot.
      if (typeof body.pilot_action_id !== "string") return json({ error: "pilot_action_id requis" }, 400);
      const { data: p } = await db.from("google_ads_pilot_actions").select("*").eq("id", body.pilot_action_id).maybeSingle();
      if (!p) return json({ error: "Proposition introuvable" }, 404);
      if (p.status !== "acceptee") return json({ error: "La proposition doit d'abord être acceptée." }, 409);
      const { data: snap } = await db.from("google_ads_structure_snapshots").select("data, taken_at").in("status", ["success", "partial"]).order("taken_at", { ascending: false }).limit(1).maybeSingle();
      const camp = (snap?.data?.campaigns ?? []).find((c: any) => String(c.id) === String(p.campaign_id));
      const blockers: string[] = [];
      if (!camp) blockers.push("Campagne introuvable dans la dernière lecture de structure : relancez l'audit.");
      if (snap && Date.now() - new Date(snap.taken_at).getTime() > 36 * 3600e3) blockers.push("Lecture de structure de plus de 36 h : relancez l'audit avant de modifier.");
      const ops: any[] = []; let summary = "";
      const C = `customers/${customer}`;
      if (camp && p.kind === "pause") {
        if (camp.status !== "ENABLED") blockers.push("La campagne n'est pas active.");
        ops.push({ description: "Mettre la campagne en pause", operation: { campaignOperation: { update: { resourceName: `${C}/campaigns/${camp.id}`, status: "PAUSED" }, updateMask: "status" } } });
        summary = `Mettre en pause « ${camp.name} ».`;
      } else if (camp && p.kind === "budget") {
        const nb = Number(p.proposed_daily_budget);
        if (!(nb > 0)) blockers.push("Budget proposé manquant.");
        if (camp.budget_shared) blockers.push("Budget partagé entre plusieurs campagnes : modification refusée (elle toucherait les autres campagnes).");
        if (!camp.budget_id) blockers.push("Identifiant du budget absent de la structure : relancez l'audit.");
        if (camp.budget && nb > camp.budget * 2) blockers.push("Hausse supérieure à ×2 en une fois : limitez la hausse (l'apprentissage serait perturbé).");
        ops.push({ description: `Changer le budget quotidien de ${camp.budget} € à ${nb} €`, operation: { campaignBudgetOperation: { update: { resourceName: `${C}/campaignBudgets/${camp.budget_id}`, amountMicros: String(Math.round(nb * 1e6)) }, updateMask: "amount_micros" } } });
        summary = `Budget de « ${camp.name} » : ${camp.budget} € → ${nb} €/jour.`;
      } else if (camp && p.kind === "bidding") {
        const r = Number(p.proposed_target_roas);
        if (!(r > 0)) blockers.push("Seul un ROAS cible chiffré est applicable automatiquement ; sinon, créez une tâche.");
        if (camp.bidding !== "MAXIMIZE_CONVERSION_VALUE") blockers.push("ROAS cible applicable seulement aux campagnes en « Maximiser la valeur de conversion » ; un changement de stratégie passe par une tâche.");
        ops.push({ description: `Fixer le ROAS cible à ${r} %`, operation: { campaignOperation: { update: { resourceName: `${C}/campaigns/${camp.id}`, maximizeConversionValue: { targetRoas: r / 100 } }, updateMask: "maximize_conversion_value.target_roas" } } });
        summary = `ROAS cible de « ${camp.name} » : ${camp.target_roas ? Math.round(camp.target_roas * 100) + " %" : "aucun"} → ${r} %.`;
      } else if (camp) blockers.push("Ce type de proposition n'est pas applicable automatiquement : transformez-la en tâche ou en projet.");
      if (blockers.length) return json({ blockers });
      const { data: a, error } = await db.from("google_ads_publish_actions").insert({
        pilot_action_id: p.id, draft_snapshot: { fingerprint: await pilotFingerprint(p), pilot: p, before: camp }, action_kind: `update_${p.kind}`,
        summary, operations: ops, status: "prevue", requested_by: uid,
      }).select().single();
      if (error) throw error;
      await db.from("google_ads_pilot_actions").update({ status: "en_approbation", publish_action_id: a.id }).eq("id", p.id);
      return json({ action: a });
    }

    if (mode === "preflight") {
      const { a } = await loadAction();
      if (!["prevue", "verifiee", "echec_verification"].includes(a.status)) return json({ error: `Statut ${a.status} : vérification impossible` }, 409);
      const res = await mutate(customer, a.operations.map((o: any) => o.operation), true);
      const errors = res.ok ? [] : googleErrors(res.body);
      const status = res.ok ? "verifiee" : "echec_verification";
      await db.from("google_ads_publish_actions").update({ status, preflight: { at: new Date().toISOString(), ok: res.ok, http: res.status, errors } }).eq("id", a.id);
      return json({ ok: res.ok, errors });
    }

    if (mode === "reject") {
      const { data: a } = await db.from("google_ads_publish_actions").select("id,status").eq("id", body.action_id).maybeSingle();
      if (!a || ["executee", "en_cours"].includes(a.status)) return json({ error: "Action non annulable" }, 409);
      await db.from("google_ads_publish_actions").update({ status: "refusee", approved_by: uid, approved_at: new Date().toISOString() }).eq("id", a.id);
      await db.from("google_ads_pilot_actions").update({ status: "acceptee", publish_action_id: null }).eq("publish_action_id", a.id).eq("status", "en_approbation");
      return json({ ok: true });
    }

    if (mode === "execute") {
      if (!isAdmin) return json({ error: "Seul un administrateur peut publier" }, 403);
      if (body.confirm !== "PUBLIER") return json({ error: "Confirmation « PUBLIER » requise" }, 400);
      const { a, d, p } = await loadAction();
      if (a.status !== "verifiee") return json({ error: "Vérification Google réussie requise avant publication" }, 409);
      if (Date.now() - new Date(a.preflight?.at ?? 0).getTime() > PREFLIGHT_TTL_MS) return json({ error: "Vérification de plus de 30 minutes : relancez-la" }, 409);
      if (!writeEnabled) {
        await db.from("google_ads_publish_actions").update({ error: "Refus : écriture Google Ads désactivée côté serveur (GOOGLE_ADS_ALLOW_WRITE)" }).eq("id", a.id);
        return json({ error: "Écriture Google Ads désactivée côté serveur : aucune publication effectuée." }, 423);
      }
      // Lock: only one execution per action.
      const { data: locked } = await db.from("google_ads_publish_actions").update({ status: "en_cours", approved_by: uid, approved_at: new Date().toISOString() }).eq("id", a.id).eq("status", "verifiee").select("id");
      if (!locked?.length) return json({ error: "Action déjà en cours ou traitée" }, 409);
      const res = await mutate(customer, a.operations.map((o: any) => o.operation), false);
      if (!res.ok) {
        const errors = googleErrors(res.body);
        await db.from("google_ads_publish_actions").update({ status: "echouee", google_response: res.body, error: errors.join(" | ") || `HTTP ${res.status}` }).eq("id", a.id);
        return json({ ok: false, errors }, 502);
      }
      const campaignRes = (res.body?.mutateOperationResponses ?? []).find((x: any) => x.campaignResult)?.campaignResult?.resourceName ?? null;
      await db.from("google_ads_publish_actions").update({ status: "executee", executed_at: new Date().toISOString(), google_response: res.body }).eq("id", a.id);
      if (p) {
        await db.from("google_ads_pilot_actions").update({ status: "executee", executed_at: new Date().toISOString() }).eq("id", p.id);
        return json({ ok: true });
      }
      await db.from("google_ads_campaign_drafts").update({ status: "publie", conflict_check: { ...(d.conflict_check ?? {}), published: { at: new Date().toISOString(), campaign: campaignRes, action_id: a.id } } }).eq("id", d.id);
      return json({ ok: true, campaign: campaignRes });
    }
    return json({ error: "Mode inconnu" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
});
