CREATE OR REPLACE FUNCTION public.marketing_cockpit(_from date, _to date, _split date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE res jsonb; wk boolean := (_to - _from) > 200;
BEGIN
  IF coalesce(public.current_user_marketing_access(), 'hidden') NOT IN ('read','write') THEN RAISE EXCEPTION 'forbidden'; END IF;
  WITH so AS (SELECT o.*, (o.created_at_shop AT TIME ZONE 'Europe/Paris')::date d FROM public.shopify_orders o
              WHERE (o.created_at_shop AT TIME ZONE 'Europe/Paris')::date BETWEEN _from AND _to AND o.cancelled_at IS NULL AND NOT o.test)
  SELECT jsonb_build_object(
    'week', wk,
    'shop', (SELECT coalesce(jsonb_agg(jsonb_build_array(b, c, r, n)), '[]') FROM (
       SELECT CASE WHEN wk THEN date_trunc('week', d)::date ELSE d END b, coalesce(country_code,'—') c, round(sum(net_revenue),2) r, count(*) n
       FROM so GROUP BY 1,2) x),
    'products', (SELECT coalesce(jsonb_agg(jsonb_build_array(p, t, c, r, q)), '[]') FROM (
       SELECT CASE WHEN so.d >= _split THEN 1 ELSE 0 END p, coalesce(l.title,'—') t, coalesce(so.country_code,'—') c,
              round(sum(l.net_amount),2) r, sum(l.current_quantity) q
       FROM public.shopify_order_lines l JOIN so ON so.id = l.order_id GROUP BY 1,2,3) x),
    'campaigns', (SELECT coalesce(jsonb_agg(jsonb_build_array(s, id, name)), '[]') FROM (
       SELECT 'g' s, id::text id, name FROM public.google_ads_campaigns
       UNION ALL SELECT 'm', id::text, name FROM public.meta_ads_campaigns) x),
    'ads', (SELECT coalesce(jsonb_agg(jsonb_build_array(s, b, id, sp, cl, im, cv, v)), '[]') FROM (
       SELECT 'g' s, CASE WHEN wk THEN date_trunc('week', day)::date ELSE day END b, campaign_id::text id,
              round(sum(cost),2) sp, sum(clicks) cl, sum(impressions) im, round(sum(conversions),2) cv, round(sum(conversions_value),2) v
       FROM public.google_ads_campaign_daily WHERE day BETWEEN _from AND _to GROUP BY 1,2,3
       UNION ALL
       SELECT 'm', CASE WHEN wk THEN date_trunc('week', day)::date ELSE day END, campaign_id::text,
              round(sum(spend),2), sum(clicks), sum(impressions), round(sum(purchases),2), round(sum(purchase_value),2)
       FROM public.meta_ads_campaign_daily WHERE day BETWEEN _from AND _to GROUP BY 1,2,3) x),
    'ads_country', (SELECT coalesce(jsonb_agg(jsonb_build_array(s, b, id, c, sp, cl, cv, v)), '[]') FROM (
       SELECT 'g' s, CASE WHEN wk THEN date_trunc('week', day)::date ELSE day END b, campaign_id::text id, coalesce(country_code,'—') c,
              round(sum(cost),2) sp, sum(clicks) cl, round(sum(conversions),2) cv, round(sum(conversions_value),2) v
       FROM public.google_ads_country_daily WHERE day BETWEEN _from AND _to GROUP BY 1,2,3,4
       UNION ALL
       SELECT 'm', CASE WHEN wk THEN date_trunc('week', day)::date ELSE day END, campaign_id::text, country_code,
              round(sum(spend),2), sum(clicks), round(sum(purchases),2), round(sum(purchase_value),2)
       FROM public.meta_ads_country_daily WHERE day BETWEEN _from AND _to GROUP BY 1,2,3,4) x),
    'ga4', (SELECT coalesce(jsonb_agg(jsonb_build_array(b, ch, c, dv, se, vi, ac, bc, pu, pr)), '[]') FROM (
       SELECT CASE WHEN wk THEN date_trunc('week', day)::date ELSE day END b, channel ch, country_code c, device dv,
              sum(sessions) se, sum(view_item) vi, sum(add_to_cart) ac, sum(begin_checkout) bc, sum(purchases) pu, round(sum(purchase_revenue),2) pr
       FROM public.ga4_daily_cube WHERE day BETWEEN _from AND _to GROUP BY 1,2,3,4) x)
  ) INTO res;
  RETURN res;
END $$;
REVOKE EXECUTE ON FUNCTION public.marketing_cockpit(date, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketing_cockpit(date, date, date) TO authenticated;