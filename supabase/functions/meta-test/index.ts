// meta-test: read-only Meta Ads (Marketing API) connection test.
// Admin only. Reads account info + last 7 days campaign insights. Stores nothing.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

const GRAPH = 'https://graph.facebook.com/v21.0'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function graphGet(path: string, token: string, params: Record<string, string> = {}) {
  const url = new URL(`${GRAPH}${path}`)
  url.searchParams.set('access_token', token)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString())
  const text = await res.text()
  let body: unknown = null
  try { body = JSON.parse(text) } catch { body = text.slice(0, 500) }
  return { status: res.status, body }
}

function metaErrorMessage(body: unknown): string | null {
  if (body && typeof body === 'object' && 'error' in body) {
    const e = (body as { error?: { message?: string; code?: number; error_subcode?: number } }).error
    if (e?.message) return `${e.message} (code ${e.code ?? '?'}${e.error_subcode ? `/${e.error_subcode}` : ''})`
  }
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // --- Admin-only check ---
    const authHeader = req.headers.get('Authorization') ?? ''
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData?.user) return json({ error: 'Non authentifié' }, 401)

    const admin = createClient(supabaseUrl, serviceKey)
    const { data: roleRow } = await admin
      .from('user_roles')
      .select('role, approved')
      .eq('user_id', userData.user.id)
      .maybeSingle()
    if (!roleRow || roleRow.role !== 'admin' || !roleRow.approved) {
      return json({ error: 'Accès réservé aux administrateurs' }, 403)
    }

    // --- Secrets ---
    const token = Deno.env.get('META_ADS_ACCESS_TOKEN')
    const accountId = Deno.env.get('META_ADS_ACCOUNT_ID')
    if (!token || !accountId) {
      return json({
        ok: false,
        step: 'secrets',
        error: 'Secrets META_ADS_ACCESS_TOKEN et/ou META_ADS_ACCOUNT_ID manquants',
      })
    }
    const actId = accountId.startsWith('act_') ? accountId : `act_${accountId}`

    // --- Step 1: account info (checks token validity + account access) ---
    const account = await graphGet(`/${actId}`, token, {
      fields: 'id,name,currency,timezone_name,account_status',
    })
    const accErr = metaErrorMessage(account.body)
    if (accErr || account.status !== 200) {
      return json({
        ok: false,
        step: 'account',
        http_status: account.status,
        error: accErr ?? 'Réponse inattendue de Meta',
        action: 'Vérifiez le jeton (droit ads_read) et que l’utilisateur système a accès au compte publicitaire.',
      })
    }
    const acc = account.body as {
      id: string; name?: string; currency?: string; timezone_name?: string; account_status?: number
    }

    // --- Step 2: last 7 days campaign insights ---
    const now = new Date()
    const until = now.toISOString().slice(0, 10)
    const sinceDate = new Date(now.getTime() - 6 * 86400000)
    const since = sinceDate.toISOString().slice(0, 10)

    const insights = await graphGet(`/${actId}/insights`, token, {
      level: 'campaign',
      time_range: JSON.stringify({ since, until }),
      fields: 'campaign_id,campaign_name,spend,impressions,clicks,actions,action_values',
      limit: '500',
    })
    const insErr = metaErrorMessage(insights.body)
    if (insErr || insights.status !== 200) {
      return json({
        ok: false,
        step: 'insights',
        http_status: insights.status,
        account: acc,
        error: insErr ?? 'Réponse inattendue de Meta',
        action: 'Le compte est accessible mais la lecture des statistiques a échoué. Vérifiez le droit ads_read du jeton.',
      })
    }

    const rows = ((insights.body as { data?: unknown[] })?.data ?? []) as Array<{
      campaign_id: string
      campaign_name: string
      spend?: string
      impressions?: string
      clicks?: string
      actions?: Array<{ action_type: string; value: string }>
      action_values?: Array<{ action_type: string; value: string }>
    }>

    const campaigns = rows.map((r) => {
      const purchases = r.actions?.find((a) => a.action_type === 'purchase' || a.action_type === 'omni_purchase')
      const purchaseValue = r.action_values?.find((a) => a.action_type === 'purchase' || a.action_type === 'omni_purchase')
      return {
        campaign_id: r.campaign_id,
        campaign_name: r.campaign_name,
        spend: Number(r.spend ?? 0),
        impressions: Number(r.impressions ?? 0),
        clicks: Number(r.clicks ?? 0),
        purchases: purchases ? Number(purchases.value) : 0,
        purchase_value: purchaseValue ? Number(purchaseValue.value) : 0,
      }
    }).sort((a, b) => b.spend - a.spend)

    const totals = campaigns.reduce(
      (t, c) => ({
        spend: t.spend + c.spend,
        impressions: t.impressions + c.impressions,
        clicks: t.clicks + c.clicks,
        purchases: t.purchases + c.purchases,
        purchase_value: t.purchase_value + c.purchase_value,
      }),
      { spend: 0, impressions: 0, clicks: 0, purchases: 0, purchase_value: 0 },
    )

    return json({
      ok: true,
      account: {
        id: acc.id,
        name: acc.name ?? null,
        currency: acc.currency ?? null,
        timezone: acc.timezone_name ?? null,
        status: acc.account_status ?? null,
      },
      period: { since, until },
      campaigns_count: campaigns.length,
      totals,
      campaigns: campaigns.slice(0, 50),
      notes: [
        'Lecture seule : aucune campagne ne peut être modifiée avec le droit ads_read.',
        'Les conversions et valeurs sont celles attribuées par Meta (fenêtre d’attribution Meta), à ne pas additionner au CA Shopify.',
        'Les chiffres des derniers jours peuvent être révisés par Meta ; une resynchronisation des jours récents est prévue.',
      ],
    })
  } catch (e) {
    return json({ ok: false, step: 'exception', error: String(e) }, 500)
  }
})
