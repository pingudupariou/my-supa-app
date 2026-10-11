// marketing-strategy: copilote stratégique IA (lecture seule, recommandations uniquement).
// Le résumé chiffré est construit côté serveur (RPC + dernière photo de structure Google Ads), puis mis en cache par SHA-256.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

const MODEL = 'openai/gpt-6-astra'
const DAILY_LIMIT = 10
const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const conf = { type: 'string', enum: ['faible', 'moyenne', 'forte'] }
const prio = { type: 'string', enum: ['haute', 'moyenne', 'basse'] }
const nstr = { type: ['string', 'null'] }
const nnum = { type: ['number', 'null'] }
const strs = { type: 'array', items: { type: 'string' } }
const obj = (props: Record<string, unknown>) => ({ type: 'object', additionalProperties: false, required: Object.keys(props), properties: props })
const reco = {
  title: { type: 'string' }, period: { type: 'string' }, evidence: { type: 'string' }, hypothesis: nstr,
  priority: prio, confidence: conf, risks: { type: 'string' }, monthly_budget_eur: nnum, kpis: strs,
  platform: { type: 'string', enum: ['Google Ads', 'Meta Ads', 'Shopify', 'Merchant Center', 'Transversal'] }, country: nstr, campaign: nstr,
}
const SCHEMA = obj({
  summary: { type: 'string' },
  verdicts: { type: 'array', items: obj({ campaign: { type: 'string' }, platform: { type: 'string', enum: ['Google Ads', 'Meta Ads'] }, verdict: { type: 'string', enum: ['renforcer', 'maintenir', 'surveiller', 'reduire', 'restructurer'] }, evidence: { type: 'string' }, bidding_advice: nstr, confidence: conf }) },
  opportunities: { type: 'array', items: obj(reco) },
  new_campaigns: { type: 'array', items: obj({ ...reco, type: { type: 'string', enum: ['Shopping', 'Performance Max', 'Search', 'Demand Gen', 'Remarketing', 'Autre'] }, products: { type: 'string' }, objective: { type: 'string' }, settings: { type: 'string' }, overlap_check: { type: 'string' } }) },
  scenarios: { type: 'array', items: obj({ name: { type: 'string', enum: ['prudent', 'reference', 'croissance'] }, google_monthly_eur: { type: 'number' }, meta_monthly_eur: { type: 'number' }, reallocations: strs, expected: { type: 'string' }, conditions: { type: 'string' } }) },
  action_plan: { type: 'array', items: obj({ ...reco, order: { type: 'integer' }, detail: { type: 'string' }, urgency: { type: 'string', enum: ['immediate', 'cette_semaine', 'ce_mois', 'a_surveiller'] } }) },
  data_limits: strs,
})

const INSTRUCTIONS = `Tu es un expert senior en acquisition e-commerce pour NOVARIDE (pièces vélo, multi-pays). Tu reçois un résumé JSON : totaux 7/30/90/180/365 j par source, pays, campagnes, familles de produits, éligibilité Merchant Center et la structure réelle du compte Google Ads (types, enchères, budgets, ciblages pays, groupes de produits, chevauchements produits).
Règles strictes :
- N'utilise QUE les chiffres fournis ; cite-les (avec la période) dans "evidence". N'invente rien. Sépare faits ("evidence") et hypothèses ("hypothesis", null sinon).
- Le CA Shopify HT est la seule vente réelle. Valeurs Google/Meta et achats GA4 = attribuées : ne les additionne jamais entre elles ni au CA. ROAS = valeur attribuée ÷ dépense d'une régie ; MER = CA Shopify ÷ (Google + Meta) ; ni l'un ni l'autre n'est la rentabilité (marges inconnues : à signaler).
- Vérifie la cohérence sur plusieurs périodes avant toute recommandation importante ; si les périodes divergent ou les données manquent, recommande d'abord une vérification et baisse la confiance.
- Ne déduis pas le ciblage d'une campagne de son nom (une PMax « Retarget » n'est pas forcément du remarketing) : appuie-toi sur la structure fournie et dis ce qui est inconnu.
- Analyse les enchères actuelles (notamment « Maximiser les clics » = TARGET_SPEND) et propose des alternatives justifiées (ROAS cible, maximiser la valeur…) avec les prérequis (volume de conversions).
- Ne recommande jamais une hausse de budget sur la seule base des impressions perdues faute de budget ni sur le seul MER : exige rentabilité attribuée, tendance et volume.
- Évite de multiplier les campagnes ; tiens compte des campagnes actives et des chevauchements ; propose fusions/suppressions si pertinent. Pour chaque nouvelle campagne : type, pays, produits Merchant (familles/étiquettes/best-sellers), budget mensuel, objectif, paramètres, vérification de chevauchement.
- Budget de référence Google + Meta fourni (flexible, pas d'obligation de le dépenser). 3 scénarios : prudent, reference, croissance.
- Lecture seule : tout est recommandation manuelle. Meta est géré par Crush AI : formule les actions Meta pour transmission à Crush AI. Aucune action Merchant Center automatique.
- 4 à 8 opportunités, 0 à 5 nouvelles campagnes, verdict pour chaque campagne active significative, 5 à 10 actions dans le plan (order 1 = d'abord). Français, concis, chiffré.`

async function sha256(s: string) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('')
}

function compactStructure(snap: any, offers: any[]) {
  if (!snap) return null
  const d = snap.data ?? {}
  const fam = new Map(offers.map((o) => [String(o.offer_id).toLowerCase(), o.product_type || 'Sans famille']))
  const camps = new Map<string, any>()
  for (const c of d.campaigns ?? []) camps.set(c.id, { name: c.name, status: c.status, type: c.type, sub_type: c.sub_type, bidding: c.bidding, target_roas: c.target_roas, target_cpa: c.target_cpa, daily_budget: c.budget, shared_budget: c.budget_shared, countries: [] as string[], excluded: 0, lost_budget_30d: null as number | null, groups: 0, product_scope: [] as string[], search_themes: 0, audiences: 0, products_shown_90d: 0, families_90d: {} as Record<string, number> })
  for (const x of d.criteria ?? []) { const c = camps.get(x.campaign_id); if (c && x.type === 'LOCATION') x.negative ? c.excluded++ : c.countries.push(x.value) }
  for (const b of d.budget_lost ?? []) { const c = camps.get(b.campaign_id); if (c && b.lost_budget != null) c.lost_budget_30d = Math.round(b.lost_budget * 100) / 100 }
  const agCamp = new Map<string, string>()
  for (const g of [...(d.ad_groups ?? []), ...(d.asset_groups ?? [])]) { const c = camps.get(g.campaign_id); if (c) c.groups++; agCamp.set(g.id, g.campaign_id) }
  for (const s of d.signals ?? []) { const c = camps.get(agCamp.get(s.asset_group_id) ?? ''); if (c) s.search_theme ? c.search_themes++ : c.audiences++ }
  for (const l of [...(d.listing_groups_pmax ?? []), ...(d.listing_groups_shopping ?? [])]) {
    const c = camps.get(l.campaign_id); if (!c || !l.dim || l.value == null) continue
    const t = `${l.negative || l.type === 'UNIT_EXCLUDED' ? 'exclu ' : ''}${l.dim}=${l.value}`; if (!c.product_scope.includes(t) && c.product_scope.length < 8) c.product_scope.push(t)
  }
  const itemCamps = new Map<string, Set<string>>()
  for (const p of d.products_90d ?? []) {
    const c = camps.get(p.campaign_id); if (!c || !(p.impressions > 0)) continue
    c.products_shown_90d++
    const f = fam.get(String(p.item_id).toLowerCase()) ?? 'Hors flux actuel'; c.families_90d[f] = Math.round((c.families_90d[f] ?? 0) + p.cost)
    const s = itemCamps.get(String(p.item_id).toLowerCase()) ?? new Set(); s.add(p.campaign_id); itemCamps.set(String(p.item_id).toLowerCase(), s)
  }
  for (const c of camps.values()) {
    c.families_90d = Object.fromEntries(Object.entries(c.families_90d).sort((a: any, b: any) => b[1] - a[1]).slice(0, 5))
    if (!c.product_scope.length) c.product_scope = ['tous les produits']
  }
  const overlaps = new Map<string, number>()
  for (const s of itemCamps.values()) {
    const arr = [...s].map((id) => camps.get(id)).filter((c) => c?.status === 'ENABLED')
    for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
      const shared = arr[i].countries.filter((x: string) => arr[j].countries.includes(x))
      if (!shared.length && arr[i].countries.length && arr[j].countries.length) continue
      const k = [arr[i].name, arr[j].name].sort().join(' + '); overlaps.set(k, (overlaps.get(k) ?? 0) + 1)
    }
  }
  const shown = new Set(itemCamps.keys())
  const unseen: Record<string, number> = {}
  for (const o of offers) if (!shown.has(String(o.offer_id).toLowerCase())) unseen[o.product_type || 'Sans famille'] = (unseen[o.product_type || 'Sans famille'] ?? 0) + 1
  return {
    taken_at: snap.taken_at, campaigns: [...camps.values()].filter((c) => c.status !== 'REMOVED'),
    product_overlaps_90d: [...overlaps.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([pair, n]) => ({ pair, products: n })),
    merchant_offers_never_shown_90d_by_family: Object.fromEntries(Object.entries(unseen).sort((a, b) => b[1] - a[1]).slice(0, 12)),
    changes_30d: (d.changes ?? []).length,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
    const { data: u } = await userClient.auth.getUser()
    if (!u?.user) return json({ error: 'Non authentifié' }, 401)
    const { data: access } = await userClient.rpc('current_user_marketing_access')
    if (!['read', 'write'].includes(access)) return json({ error: 'Accès Marketing Intelligence requis' }, 403)

    const body = await req.json().catch(() => ({}))
    const budget = Number(body?.monthly_budget)
    if (!Number.isFinite(budget) || budget < 0 || budget > 1_000_000) return json({ error: 'Budget de référence invalide' }, 400)
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: metrics, error: me } = await userClient.rpc('marketing_strategy_summary')
    if (me) return json({ error: me.message }, 500)
    const { data: snap } = await admin.from('google_ads_structure_snapshots').select('taken_at, data').in('status', ['success', 'partial']).order('taken_at', { ascending: false }).limit(1).maybeSingle()
    const offers: any[] = []
    for (let p = 0; ; p++) {
      const { data } = await admin.from('merchant_offers').select('offer_id, product_type').order('name').range(p * 1000, p * 1000 + 999)
      offers.push(...(data ?? [])); if (!data || data.length < 1000) break
    }
    const summary = { reference_budget_google_plus_meta_eur_month: budget, today: new Date().toISOString().slice(0, 10), metrics, google_ads_structure: compactStructure(snap, offers) }
    const payload = JSON.stringify(summary)
    if (payload.length > 120000) return json({ error: 'Résumé trop volumineux' }, 400)
    const key = await sha256(payload)

    const { data: cached } = await admin.from('marketing_ai_analyses').select('id, result, created_at, model').eq('kind', 'strategy').eq('cache_key', key).maybeSingle()
    if (cached && !body?.force) return json({ cached: true, ...cached })
    if (body?.cache_only) return json({ cached: false, result: null })

    const since = new Date(Date.now() - 86400000).toISOString()
    const { count } = await admin.from('marketing_ai_analyses').select('id', { count: 'exact', head: true }).eq('kind', 'strategy').eq('created_by', u.user.id).gte('updated_at', since)
    if ((count ?? 0) >= DAILY_LIMIT) return json({ error: `Limite de ${DAILY_LIMIT} analyses stratégiques par 24 h atteinte.` }, 429)

    const apiKey = Deno.env.get('LOVABLE_API_KEY')
    if (!apiKey) return json({ error: 'Configuration IA manquante' }, 500)
    const res = await fetch('https://ai.gateway.lovable.dev/v1/responses', {
      method: 'POST', signal: req.signal,
      headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': apiKey, 'X-Lovable-AIG-SDK': 'fetch' },
      body: JSON.stringify({
        model: MODEL, instructions: INSTRUCTIONS, stream: true, store: false,
        reasoning: { effort: 'high', summary: 'auto' }, include: ['reasoning.encrypted_content'],
        input: [{ role: 'user', content: `Résumé :\n${payload}` }],
        text: { format: { type: 'json_schema', name: 'strategie', strict: true, schema: SCHEMA } },
      }),
    })
    if (!res.ok) {
      const t = await res.text()
      let msg = t.slice(0, 300); try { msg = JSON.parse(t)?.error?.message ?? JSON.parse(t)?.message ?? msg } catch { /* */ }
      const human = res.status === 402 ? 'Crédits IA épuisés : rechargez dans Paramètres → Plans et crédits.' : res.status === 429 ? 'Trop de demandes IA, réessayez dans une minute.' : msg
      return json({ error: human }, res.status)
    }
    const reader = res.body!.getReader(); const dec = new TextDecoder(); let buf = '', text = '', failed = ''
    for (;;) {
      const { done, value } = await reader.read(); if (done) break
      buf += dec.decode(value, { stream: true })
      let i; while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1)
        if (!line.startsWith('data:')) continue
        const d = line.slice(5).trim(); if (!d || d === '[DONE]') continue
        try { const e = JSON.parse(d)
          if (e.type === 'response.output_text.delta') text += e.delta
          else if (e.type === 'response.refusal.delta' || e.type === 'response.failed' || e.type === 'error') failed = e.error?.message ?? 'Analyse refusée'
        } catch { /* */ }
      }
    }
    if (failed || !text) return json({ error: failed || 'Réponse IA vide' }, 502)
    let result; try { result = JSON.parse(text) } catch { return json({ error: 'Réponse IA illisible' }, 502) }
    const today = new Date().toISOString().slice(0, 10)
    const row = { kind: 'strategy', cache_key: key, period_from: new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10), period_to: today, filters: { monthly_budget: budget }, result, model: MODEL, created_by: u.user.id }
    const { data: saved, error: insErr } = await admin.from('marketing_ai_analyses').upsert(row, { onConflict: 'kind,cache_key' }).select('id, created_at').single()
    if (insErr) console.error('cache insert', insErr.message)
    return json({ cached: false, id: saved?.id ?? null, result, created_at: saved?.created_at ?? new Date().toISOString(), model: MODEL })
  } catch (e) {
    if (req.signal.aborted) return new Response(null, { status: 499 })
    console.error(e); return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
