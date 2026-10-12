CREATE OR REPLACE FUNCTION public.marketing_strategy_summary()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
  r := r || jsonb_build_object('trends_non_overlapping', (SELECT jsonb_object_agg(d::text, jsonb_build_object('current', cur, 'previous', prev)) FROM (
    SELECT d,
      (SELECT jsonb_build_object('shopify_revenue_ht', (SELECT round(coalesce(sum(net_revenue),0)) FROM shopify_orders WHERE cancelled_at IS NULL AND NOT coalesce(test,false) AND created_at_shop >= _to - d AND created_at_shop < _to),
        'shopify_orders', (SELECT count(*) FROM shopify_orders WHERE cancelled_at IS NULL AND NOT coalesce(test,false) AND created_at_shop >= _to - d AND created_at_shop < _to),
        'google_cost', (SELECT round(coalesce(sum(cost),0)) FROM google_ads_campaign_daily WHERE day >= _to - d AND day < _to),
        'google_value', (SELECT round(coalesce(sum(conversions_value),0)) FROM google_ads_campaign_daily WHERE day >= _to - d AND day < _to),
        'meta_spend', (SELECT round(coalesce(sum(spend),0)) FROM meta_ads_campaign_daily WHERE day >= _to - d AND day < _to),
        'meta_value', (SELECT round(coalesce(sum(purchase_value),0)) FROM meta_ads_campaign_daily WHERE day >= _to - d AND day < _to))) cur,
      (SELECT jsonb_build_object('shopify_revenue_ht', (SELECT round(coalesce(sum(net_revenue),0)) FROM shopify_orders WHERE cancelled_at IS NULL AND NOT coalesce(test,false) AND created_at_shop >= _to - 2*d AND created_at_shop < _to - d),
        'shopify_orders', (SELECT count(*) FROM shopify_orders WHERE cancelled_at IS NULL AND NOT coalesce(test,false) AND created_at_shop >= _to - 2*d AND created_at_shop < _to - d),
        'google_cost', (SELECT round(coalesce(sum(cost),0)) FROM google_ads_campaign_daily WHERE day >= _to - 2*d AND day < _to - d),
        'google_value', (SELECT round(coalesce(sum(conversions_value),0)) FROM google_ads_campaign_daily WHERE day >= _to - 2*d AND day < _to - d),
        'meta_spend', (SELECT round(coalesce(sum(spend),0)) FROM meta_ads_campaign_daily WHERE day >= _to - 2*d AND day < _to - d),
        'meta_value', (SELECT round(coalesce(sum(purchase_value),0)) FROM meta_ads_campaign_daily WHERE day >= _to - 2*d AND day < _to - d))) prev
    FROM unnest(ARRAY[14,30,90]) d) t));
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
  FOREACH w IN ARRAY ARRAY[90,365] LOOP
    r := r || jsonb_build_object('families_' || w, (WITH z AS (
        SELECT l.id, coalesce(l.current_quantity,l.quantity) q,
          CASE WHEN ol.s > 0 AND o.total_price > 0 THEN coalesce(l.net_amount,0) / ol.s * o.subtotal * o.net_revenue / o.total_price ELSE 0 END amt,
          CASE WHEN nullif(p.product_type,'') IS NOT NULL THEN p.product_type
               WHEN fv.pt IS NOT NULL THEN fv.pt WHEN fp.pt IS NOT NULL THEN fp.pt ELSE 'Sans famille' END fam,
          CASE WHEN nullif(p.product_type,'') IS NOT NULL THEN 'shopify' WHEN fv.pt IS NOT NULL THEN 'merchant_variant' WHEN fp.pt IS NOT NULL THEN 'merchant_product' ELSE 'none' END src
        FROM shopify_order_lines l JOIN shopify_orders o ON o.id = l.order_id JOIN (SELECT order_id, sum(net_amount) s FROM shopify_order_lines GROUP BY 1) ol ON ol.order_id = l.order_id LEFT JOIN shopify_products p ON p.id = l.product_id
        LEFT JOIN LATERAL (SELECT min(nullif(mo.product_type,'')) pt FROM merchant_offers mo
          WHERE mo.shopify_variant_id = l.variant_id OR mo.offer_id IN (SELECT mm.offer_id FROM merchant_manual_matches mm WHERE mm.shopify_variant_id = l.variant_id)) fv ON true
        LEFT JOIN LATERAL (SELECT CASE WHEN count(DISTINCT nullif(mo.product_type,'')) = 1 THEN min(nullif(mo.product_type,'')) END pt FROM merchant_offers mo WHERE mo.shopify_product_id = l.product_id) fp ON true
        WHERE o.cancelled_at IS NULL AND NOT coalesce(o.test,false) AND o.created_at_shop >= _to - w AND o.created_at_shop < _to)
      SELECT jsonb_build_object(
        'top', (SELECT coalesce(jsonb_agg(x), '[]') FROM (SELECT jsonb_build_object('family', fam, 'units', sum(q), 'revenue_lines_ht', round(sum(amt))) x FROM z GROUP BY fam ORDER BY sum(amt) DESC LIMIT 20) t),
        'lines', (SELECT count(*) FROM z), 'distinct_lines', (SELECT count(DISTINCT id) FROM z),
        'lines_total_ht', (SELECT round(sum(amt)) FROM z),
        'lines_basis', 'HT après remises de commande, hors livraison (répartition au prorata)',
        'classified_by', (SELECT jsonb_object_agg(src, round(s)) FROM (SELECT src, sum(amt) s FROM z GROUP BY src) t),
        'unclassified_share_pct', (SELECT round(100 * coalesce(sum(amt) FILTER (WHERE fam = 'Sans famille'),0) / nullif(sum(amt),0), 1) FROM z))));
  END LOOP;
  r := r || jsonb_build_object('merchant_countries', (SELECT coalesce(jsonb_agg(x), '[]') FROM (SELECT jsonb_build_object('c', country, 'offers', count(*), 'eligible', count(*) FILTER (WHERE status='approved'), 'refused', count(*) FILTER (WHERE status='disapproved')) x
    FROM merchant_offer_countries GROUP BY country ORDER BY count(*) DESC LIMIT 25) t));
  r := r || jsonb_build_object('merchant_totals', jsonb_build_object('offers', (SELECT count(*) FROM merchant_offers), 'distinct_ids', (SELECT count(DISTINCT offer_id) FROM merchant_offers),
    'distinct_variants', (SELECT count(DISTINCT shopify_variant_id) FROM merchant_offers), 'unmatched', (SELECT count(*) FROM merchant_offers WHERE shopify_variant_id IS NULL)));
  r := r || jsonb_build_object('lines_reconciliation_90', (WITH o AS (SELECT * FROM shopify_orders WHERE cancelled_at IS NULL AND NOT coalesce(test,false) AND created_at_shop >= _to - 90 AND created_at_shop < _to),
      l AS (SELECT order_id, sum(net_amount) s FROM shopify_order_lines WHERE order_id IN (SELECT id FROM o) GROUP BY 1)
    SELECT jsonb_build_object(
      'orders', (SELECT count(*) FROM o), 'orders_without_lines', (SELECT count(*) FROM o WHERE id NOT IN (SELECT order_id FROM l)),
      'raw_lines_ttc_before_order_discounts', (SELECT round(sum(s),2) FROM l),
      'order_discounts', (SELECT round(sum(total_discounts),2) FROM o),
      'subtotal_ttc', (SELECT round(sum(subtotal),2) FROM o),
      'lines_vs_subtotal_gap', (SELECT round(sum(l.s - o.subtotal - o.total_discounts),2) FROM o JOIN l ON l.order_id = o.id),
      'orders_with_line_gap', (SELECT count(*) FROM o JOIN l ON l.order_id = o.id WHERE abs(l.s - o.subtotal - o.total_discounts) > 1),
      'shipping_ttc', (SELECT round(sum(total_shipping),2) FROM o),
      'total_ttc', (SELECT round(sum(total_price),2) FROM o),
      'taxes', (SELECT round(sum(total_tax),2) FROM o),
      'refunded_already_deducted', (SELECT round(sum(total_refunded),2) FROM o),
      'shopify_revenue_ht', (SELECT round(sum(net_revenue),2) FROM o),
      'lines_ht_allocated', (SELECT round(sum(CASE WHEN total_price > 0 THEN subtotal * net_revenue / total_price ELSE 0 END),2) FROM o WHERE id IN (SELECT order_id FROM l)),
      'cancelled_excluded', (SELECT count(*) FROM shopify_orders WHERE cancelled_at IS NOT NULL AND created_at_shop >= _to - 90 AND created_at_shop < _to),
      'duplicate_line_ids', (SELECT count(*) - count(DISTINCT id) FROM shopify_order_lines))));
  r := r || jsonb_build_object('last_sync', jsonb_build_object(
    'shopify', (SELECT max(finished_at) FROM shopify_sync_runs WHERE status IN ('success','warning')),
    'google_ads', (SELECT max(finished_at) FROM google_ads_sync_runs WHERE status = 'success'),
    'meta_ads', (SELECT max(finished_at) FROM meta_ads_sync_runs WHERE status = 'success'),
    'ga4', (SELECT max(finished_at) FROM ga4_sync_runs WHERE status = 'success'),
    'merchant', (SELECT max(finished_at) FROM merchant_sync_runs WHERE status = 'success'),
    'google_structure', (SELECT max(taken_at) FROM google_ads_structure_snapshots WHERE status IN ('success','partial')),
    'last_day_google', (SELECT max(day) FROM google_ads_campaign_daily), 'last_day_meta', (SELECT max(day) FROM meta_ads_campaign_daily),
    'last_day_ga4', (SELECT max(day) FROM ga4_daily_cube), 'last_order_shopify', (SELECT max(created_at_shop) FROM shopify_orders)));
  RETURN r;
END $function$;