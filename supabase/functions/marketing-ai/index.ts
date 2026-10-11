// marketing-ai: diagnostic IA (étape A). Reçoit un résumé chiffré compact du cockpit,
// renvoie une analyse structurée, mise en cache par empreinte du résumé.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

const MODEL = 'openai/gpt-6-astra'
const DAILY_LIMIT = 20
const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const conf = { type: 'string', enum: ['faible', 'moyenne', 'forte'] }
const nstr = { type: ['string', 'null'] }
const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['summary', 'findings', 'actions', 'data_limits'],
  properties: {
    summary: { type: 'string' },
    findings: { type: 'array', items: { type: 'object', additionalProperties: false,
      required: ['kind', 'scope', 'title', 'fact', 'hypothesis', 'confidence'],
      properties: { kind: { type: 'string', enum: ['anomalie', 'tendance', 'opportunite', 'ecart_donnees'] }, scope: { type: 'string', enum: ['global', 'pays', 'campagne', 'canal', 'produit'] },
        title: { type: 'string' }, fact: { type: 'string' }, hypothesis: nstr, confidence: conf } } },
    actions: { type: 'array', items: { type: 'object', additionalProperties: false,
      required: ['priority', 'urgency', 'category', 'title', 'detail', 'country', 'campaign', 'expected_impact', 'confidence', 'justification'],
      properties: { priority: { type: 'integer' }, urgency: { type: 'string', enum: ['immediate', 'cette_semaine', 'ce_mois', 'a_surveiller'] }, category: { type: 'string', enum: ['Google Ads', 'Meta Ads', 'Shopify', 'SEO', 'Conversion', 'Développement pays'] },
        title: { type: 'string' }, detail: { type: 'string' }, country: nstr, campaign: nstr, expected_impact: { type: 'string' }, confidence: conf, justification: { type: 'string' } } } },
    data_limits: { type: 'array', items: { type: 'string' } },
  },
}

const INSTRUCTIONS = `Tu es l'analyste marketing de NOVARIDE (e-commerce). Tu reçois un résumé chiffré JSON (période courante et période de comparaison).
Règles strictes :
- N'utilise QUE les chiffres fournis. N'invente aucune donnée. Cite les chiffres dans "fact".
- Le CA Shopify est la seule vente réelle. Les conversions/valeurs Google Ads, Meta Ads et achats GA4 sont "attribuées" : ne les additionne jamais au CA, ne les confonds jamais.
- MER = CA Shopify ÷ dépenses Ads totales. ROAS = valeur attribuée ÷ dépenses d'une régie.
- Sépare faits mesurés ("fact") et hypothèses ("hypothesis", null si aucune).
- Pas de marges disponibles : signale-le dans data_limits plutôt que de supposer.
- Les accès publicitaires sont en lecture seule : les actions sont des recommandations à faire manuellement ; pour Meta, formule-les pour être transmises à Crush AI.
- Urgence et confiance sont indépendantes : "urgency" = délai d'action, "confidence" = solidité des données.
- Si les données sont insuffisantes ou incohérentes pour une décision, la première action est une vérification (catégorie adaptée), pas une décision.
- Ne recommande jamais de réallocation budgétaire sur la seule base du MER : exige au moins un second indicateur (ROAS attribué, tendance du CA, conversion, volume) et dis-le dans la justification.
- Signale les écarts entre sources (kind "ecart_donnees") en décrivant uniquement l'écart chiffré ; hypothesis = null, n'invente pas d'explication.
- 4 à 10 constats, 3 à 5 actions priorisées (1 = plus urgent), chiffrées. Réponds en français, concis.`

async function sha256(s: string) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('')
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

    const { summary, from, to, filters, force } = await req.json()
    if (!summary || !from || !to) return json({ error: 'Résumé manquant' }, 400)
    const payload = JSON.stringify(summary)
    if (payload.length > 60000) return json({ error: 'Résumé trop volumineux' }, 400)
    const key = await sha256(payload)
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: cached } = await admin.from('marketing_ai_analyses').select('id, result, created_at, model').eq('kind', 'diagnosis').eq('cache_key', key).maybeSingle()
    if (cached && !force) return json({ cached: true, ...cached })

    const since = new Date(Date.now() - 86400000).toISOString()
    const { count } = await admin.from('marketing_ai_analyses').select('id', { count: 'exact', head: true }).eq('created_by', u.user.id).gte('updated_at', since)
    if ((count ?? 0) >= DAILY_LIMIT) return json({ error: `Limite de ${DAILY_LIMIT} analyses par 24 h atteinte.` }, 429)

    const apiKey = Deno.env.get('LOVABLE_API_KEY')
    if (!apiKey) return json({ error: 'Configuration IA manquante' }, 500)
    const res = await fetch('https://ai.gateway.lovable.dev/v1/responses', {
      method: 'POST', signal: req.signal,
      headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': apiKey, 'X-Lovable-AIG-SDK': 'fetch' },
      body: JSON.stringify({
        model: MODEL, instructions: INSTRUCTIONS, stream: true, store: false,
        reasoning: { effort: 'medium', summary: 'auto' }, include: ['reasoning.encrypted_content'],
        input: [{ role: 'user', content: `Période ${from} → ${to}. Filtres : ${JSON.stringify(filters ?? {})}.\nRésumé :\n${payload}` }],
        text: { format: { type: 'json_schema', name: 'diagnostic', strict: true, schema: SCHEMA } },
      }),
    })
    if (!res.ok) {
      const t = await res.text()
      let msg = t.slice(0, 300); try { msg = JSON.parse(t)?.error?.message ?? JSON.parse(t)?.message ?? msg } catch { /* */ }
      const human = res.status === 402 ? 'Crédits IA épuisés : rechargez dans Paramètres → Plans et crédits.' : res.status === 429 ? 'Trop de demandes IA, réessayez dans une minute.' : msg
      return json({ error: human }, res.status)
    }
    // Lecture du flux SSE côté serveur, assemblage du texte final.
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
    const row = { kind: 'diagnosis', cache_key: key, period_from: from, period_to: to, filters: filters ?? {}, result, model: MODEL, created_by: u.user.id }
    const { data: saved, error: insErr } = await admin.from('marketing_ai_analyses').upsert(row, { onConflict: 'kind,cache_key' }).select('id').single()
    if (insErr) console.error('cache insert', insErr.message)
    return json({ cached: false, id: saved?.id ?? null, result, created_at: new Date().toISOString(), model: MODEL })
  } catch (e) {
    if (req.signal.aborted) return new Response(null, { status: 499 })
    console.error(e); return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
