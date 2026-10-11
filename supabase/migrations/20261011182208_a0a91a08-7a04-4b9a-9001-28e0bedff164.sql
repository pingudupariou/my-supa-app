CREATE OR REPLACE FUNCTION public.marketing_strategy_summary()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _to date := current_date; r jsonb := '{}'::jsonb; w int;
BEGIN
  IF public.current_user_marketing_access() NOT IN ('read','write') THEN RAISE EXCEPTION 'forbidden'; END IF;
  r := r || jsonb_build_object('windows', (SELECT jsonb_object_agg(d::text, jsonb_build_object(
    'shopify_revenue_ht', (SELECT round(coalesce(sum(net_revenue),0)) FROM shopify_orders WHERE cancelled_at IS NULL AND NOT coalesce(test,false) AND created_at_shop >= _to - d AND created_at_shop < _to),
    'shopify_orders', (SELECT count(*) FROM shopify_orders WHERE cancelled_at IS NULL AND NOT coalesce(test,false) AND created_at_shop >= _to - d AND created_at_shop < _to),
    'google_cost', (SELECT round(coalesce(sum(cost),0)) FROM google_ads_campaign_daily WHERE day >= _to - d AND day < _to),
    'google_attributed_value', (SELECT round(coalesce(sum(conversions_value),0)) FROM google_ads_campaign_daily WHERE day >= _to - d AND day < _to),
    'google_conversions', (SELECT round(coalesce(sum(conversions),0)) FROM google_ads_campaign_daily WHERE day >= _to - d AND day < _to),
    'meta_spend', (SELECT round(coalesce(sum(spend),0)) FROM meta_ads_campaign_daily WHERE day >= _to - d AND day < _to),
    'meta_attributed_value', (SELECT round(coalesce(sum(purchase_value),0)) FROM meta_ads_campaign_daily WHERE day >= _to - d AND day < _to),
    'ga4_sessions', (SELECT coalesce(sum(sessions),0) FROM ga4_daily_cube WHERE day >= _to - d AND day < _to),
    'first_day_google', (SELECT min(day) FROM google_ads_campaign_daily), 'first_day_meta', (SELECT min(day) FROM meta_ads_campaign_daily)
  )) FROM unnest(ARRAY[7,30,90,180,365]) d));
  FOREACH w IN ARRAY ARRAY[90,365] LOOP
    r := r || jsonb_build_object('countries_' || w, (SELECT coalesce(jsonb_agg(x ORDER BY sk DESC), '[]') FROM (
      SELECT jsonb_strip_nulls(jsonb_build_object('c', cc, 'shopify_revenue_ht', s.rev, 'shopify_orders', s.n, 'google_cost', g.cost, 'google_value', g.val, 'meta_spend', m.sp, 'meta_value', m.val, 'ga4_sessions', a.ses)) x,
        coalesce(s.rev,0) + coalesce(g.cost,0) + coalesce(m.sp,0) sk
      FROM (SELECT country_code cc FROM shopify_orders WHERE created_at_shop >= _to - w UNION SELECT country_code FROM google_ads_country_daily WHERE day >= _to - w UNION SELECT country_code FROM meta_ads_country_daily WHERE day >= _to - w) k
      LEFT JOIN (SELECT country_code, round(sum(net_revenue)) rev, count(*) n FROM shopify_orders WHERE cancelled_at IS NULL AND NOT coalesce(test,false) AND created_at_shop >= _to - w AND created_at_shop < _to GROUP BY 1) s ON s.country_code = k.cc
      LEFT JOIN (SELECT country_code, round(sum(cost)) cost, round(sum(conversions_value)) val FROM google_ads_country_daily WHERE day >= _to - w AND day < _to GROUP BY 1) g ON g.country_code = k.cc
      LEFT JOIN (SELECT country_code, round(sum(spend)) sp, round(sum(purchase_value)) val FROM meta_ads_country_daily WHERE day >= _to - w AND day < _to GROUP BY 1) m ON m.country_code = k.cc
      LEFT JOIN (SELECT country_code, sum(sessions) ses FROM ga4_daily_cube WHERE day >= _to - w AND day < _to GROUP BY 1) a ON a.country_code = k.cc
      WHERE k.cc IS NOT NULL ORDER BY 2 DESC LIMIT 30) t));
  END LOOP;
  r := r || jsonb_build_object('google_campaigns', (SELECT coalesce(jsonb_agg(jsonb_build_object('name', c.name, 'status', c.status, 'type', c.channel_type,
      'd30', (SELECT jsonb_build_array(round(sum(cost)), round(sum(conversions_value)), round(sum(conversions))) FROM google_ads_campaign_daily WHERE campaign_id = c.id AND day >= _to - 30 AND day < _to),
      'd90', (SELECT jsonb_build_array(round(sum(cost)), round(sum(conversions_value)), round(sum(conversions))) FROM google_ads_campaign_daily WHERE campaign_id = c.id AND day >= _to - 90 AND day < _to),
      'd365', (SELECT jsonb_build_array(round(sum(cost)), round(sum(conversions_value)), round(sum(conversions))) FROM google_ads_campaign_daily WHERE campaign_id = c.id AND day >= _to - 365 AND day < _to))), '[]')
    FROM google_ads_campaigns c WHERE EXISTS (SELECT 1 FROM google_ads_campaign_daily d WHERE d.campaign_id = c.id AND d.day >= _to - 365 AND d.cost > 0)));
  r := r || jsonb_build_object('meta_campaigns_90', (SELECT coalesce(jsonb_agg(x), '[]') FROM (SELECT jsonb_build_object('name', mc.name, 'spend', round(sum(d.spend)), 'value', round(sum(d.purchase_value)), 'purchases', sum(d.purchases)) x
    FROM meta_ads_campaign_daily d JOIN meta_ads_campaigns mc ON mc.id = d.campaign_id WHERE d.day >= _to - 90 AND d.day < _to GROUP BY mc.name HAVING sum(d.spend) > 0 ORDER BY sum(d.spend) DESC LIMIT 15) t));
  -- Product families: Merchant product_type via variant when Shopify type is empty.
  FOREACH w IN ARRAY ARRAY[90,365] LOOP
    r := r || jsonb_build_object('families_' || w, (SELECT coalesce(jsonb_agg(x), '[]') FROM (SELECT jsonb_build_object('family', fam, 'units', sum(q), 'revenue_ht', round(sum(amt))) x FROM (
        SELECT coalesce(nullif(p.product_type,''), (SELECT mo.product_type FROM merchant_offers mo WHERE mo.shopify_variant_id = l.variant_id AND mo.product_type IS NOT NULL LIMIT 1), 'Sans famille') fam,
          coalesce(l.current_quantity,l.quantity) q, l.net_amount amt
        FROM shopify_order_lines l JOIN shopify_orders o ON o.id = l.order_id LEFT JOIN shopify_products p ON p.id = l.product_id
        WHERE o.cancelled_at IS NULL AND NOT coalesce(o.test,false) AND o.created_at_shop >= _to - w AND o.created_at_shop < _to) z
      GROUP BY fam ORDER BY sum(amt) DESC NULLS LAST LIMIT 20) t));
  END LOOP;
  r := r || jsonb_build_object('merchant_countries', (SELECT coalesce(jsonb_agg(x), '[]') FROM (SELECT jsonb_build_object('c', country, 'offers', count(*), 'eligible', count(*) FILTER (WHERE status='approved'), 'refused', count(*) FILTER (WHERE status='disapproved')) x
    FROM merchant_offer_countries GROUP BY country ORDER BY count(*) DESC LIMIT 25) t));
  r := r || jsonb_build_object('merchant_totals', jsonb_build_object('offers', (SELECT count(*) FROM merchant_offers), 'distinct_ids', (SELECT count(DISTINCT offer_id) FROM merchant_offers),
    'distinct_variants', (SELECT count(DISTINCT shopify_variant_id) FROM merchant_offers), 'unmatched', (SELECT count(*) FROM merchant_offers WHERE shopify_variant_id IS NULL)));
  RETURN r;
END $$;
REVOKE EXECUTE ON FUNCTION public.marketing_strategy_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketing_strategy_summary() TO authenticated;