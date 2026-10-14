CREATE OR REPLACE FUNCTION public.b2c_ad_margin(_from date, _to date, _include_shipping boolean DEFAULT false, _ship_cost_per_doc numeric DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE res jsonb; snap record; aligned boolean := false;
BEGIN
  IF coalesce(public.current_user_marketing_access(),'hidden') NOT IN ('read','write')
     OR public.current_user_tab_access('sales-stats') NOT IN ('read','write') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT id, taken_at, data->'products_90d' p INTO snap FROM google_ads_structure_snapshots
    WHERE status IN ('success','partial') AND data ? 'products_90d' ORDER BY taken_at DESC LIMIT 1;
  IF snap.id IS NOT NULL THEN aligned := (_from = (snap.taken_at::date - 90) AND _to = (snap.taken_at::date - 1)); END IF;
  WITH docs AS (
    SELECT d.* FROM erplain_sales_documents d WHERE d.counted AND d.is_shopify AND d.dated_at BETWEEN _from AND _to),
  l AS (
    SELECT to_char(d.dated_at,'YYYY-MM') mo, upper(nullif(d.shipping_country,'')) cc, d.id doc, d.doc_type, li.is_shipping,
      coalesce(li.variant_id, li.sku, li.label) pk, li.sku, li.label, li.amount_ht, li.quantity q,
      CASE WHEN NOT li.is_shipping AND m.unit_cost IS NOT NULL AND li.quantity IS NOT NULL THEN li.quantity*m.unit_cost END cogs,
      CASE WHEN NOT li.is_shipping AND m.unit_cost IS NOT NULL AND li.quantity IS NOT NULL THEN li.amount_ht END cov,
      CASE WHEN NOT li.is_shipping AND m.unit_cost IS NOT NULL AND li.quantity IS NOT NULL AND d.dated_at < m.cost_read_at::date THEN li.amount_ht END est
    FROM docs d JOIN erplain_sales_lines li ON li.document_id = d.id
    LEFT JOIN costflow_cost_methods m ON m.variant_id = li.variant_id AND m.unit_cost IS NOT NULL AND m.cost_status='ok'),
  sales_mc AS (
    SELECT mo, cc, sum(amount_ht) FILTER (WHERE NOT is_shipping) prod, sum(cogs) cogs, sum(cov) cov, sum(est) est,
      sum(amount_ht) FILTER (WHERE is_shipping) ship, count(DISTINCT doc) FILTER (WHERE doc_type='invoice') inv FROM l GROUP BY 1,2),
  g_c AS (SELECT to_char(day,'YYYY-MM') mo, upper(country_code) cc, sum(cost) sp FROM google_ads_country_daily WHERE day BETWEEN _from AND _to GROUP BY 1,2),
  m_c AS (SELECT to_char(day,'YYYY-MM') mo, CASE WHEN country_code IN ('unknown','') THEN NULL ELSE upper(country_code) END cc, sum(spend) sp FROM meta_ads_country_daily WHERE day BETWEEN _from AND _to GROUP BY 1,2),
  g_t AS (SELECT to_char(day,'YYYY-MM') mo, sum(cost) sp, sum(conversions_value) v FROM google_ads_campaign_daily WHERE day BETWEEN _from AND _to GROUP BY 1),
  m_t AS (SELECT to_char(day,'YYYY-MM') mo, sum(spend) sp, sum(purchase_value) v FROM meta_ads_campaign_daily WHERE day BETWEEN _from AND _to GROUP BY 1),
  -- direct Google Shopping spend per product (snapshot window only): offer_id -> unique SKU
  items AS (SELECT lower(x->>'item_id') item, sum((x->>'cost')::numeric) cost FROM jsonb_array_elements(coalesce(snap.p,'[]'::jsonb)) x WHERE aligned GROUP BY 1),
  item_sku AS (SELECT i.item, i.cost, (SELECT CASE WHEN count(DISTINCT mo.sku)=1 THEN min(mo.sku) END FROM merchant_offers mo WHERE lower(mo.offer_id)=i.item AND nullif(mo.sku,'') IS NOT NULL) sku FROM items i),
  prod AS (SELECT pk, max(sku) sku, max(coalesce(sku,'')||' '||coalesce(label,'')) lab, sum(amount_ht) ca, sum(q) q, sum(cogs) cogs, sum(cov) cov, sum(est) est FROM l WHERE NOT is_shipping GROUP BY pk),
  sku_pk AS (SELECT sku, CASE WHEN count(*)=1 THEN min(pk) END pk FROM prod WHERE sku IS NOT NULL GROUP BY sku),
  direct AS (SELECT coalesce(sp.pk, 'ANNONCE:'||s.sku) pk, s.sku, sum(s.cost) cost FROM item_sku s LEFT JOIN sku_pk sp ON sp.sku = s.sku WHERE s.sku IS NOT NULL GROUP BY 1,2),
  tot AS (SELECT coalesce((SELECT sum(sp) FROM g_t),0) g, coalesce((SELECT sum(sp) FROM m_t),0) m, coalesce((SELECT sum(cost) FROM direct),0) dir,
      coalesce((SELECT sum(cost) FROM direct WHERE pk LIKE 'ANNONCE:%'),0) dir_unsold, coalesce((SELECT sum(cost) FROM item_sku WHERE sku IS NULL),0) unmatched_items,
      coalesce((SELECT sum(ca) FROM prod),0) ca)
  SELECT jsonb_build_object(
    'by_month', (SELECT coalesce(jsonb_agg(jsonb_build_object('k', mo, 'prod_ht', round(coalesce(prod,0),2), 'cov_ht', round(coalesce(cov,0),2), 'cogs', round(coalesce(cogs,0),2), 'est_ht', round(coalesce(est,0),2),
        'ship_ht', round(coalesce(ship,0),2), 'inv', coalesce(inv,0), 'google', round(coalesce(gs,0),2), 'meta', round(coalesce(ms,0),2), 'g_value', round(coalesce(gv,0),2), 'm_value', round(coalesce(mv,0),2)) ORDER BY mo), '[]') FROM (
       SELECT k.mo, s.prod, s.cov, s.cogs, s.est, s.ship, s.inv, g.sp gs, g.v gv, m.sp ms, m.v mv
       FROM (SELECT mo FROM sales_mc UNION SELECT mo FROM g_t UNION SELECT mo FROM m_t) k
       LEFT JOIN (SELECT mo, sum(prod) prod, sum(cov) cov, sum(cogs) cogs, sum(est) est, sum(ship) ship, sum(inv) inv FROM sales_mc GROUP BY 1) s ON s.mo=k.mo
       LEFT JOIN g_t g ON g.mo=k.mo LEFT JOIN m_t m ON m.mo=k.mo) z),
    'by_country', (SELECT coalesce(jsonb_agg(jsonb_build_object('k', cc, 'prod_ht', round(coalesce(prod,0),2), 'cov_ht', round(coalesce(cov,0),2), 'cogs', round(coalesce(cogs,0),2), 'est_ht', round(coalesce(est,0),2),
        'ship_ht', round(coalesce(ship,0),2), 'inv', coalesce(inv,0), 'google', round(coalesce(gs,0),2), 'meta', round(coalesce(ms,0),2)) ORDER BY coalesce(prod,0) DESC), '[]') FROM (
       SELECT k.cc, s.prod, s.cov, s.cogs, s.est, s.ship, s.inv, g.sp gs, m.sp ms
       FROM (SELECT cc FROM sales_mc WHERE cc IS NOT NULL UNION SELECT cc FROM g_c WHERE cc IS NOT NULL UNION SELECT cc FROM m_c WHERE cc IS NOT NULL) k
       LEFT JOIN (SELECT cc, sum(prod) prod, sum(cov) cov, sum(cogs) cogs, sum(est) est, sum(ship) ship, sum(inv) inv FROM sales_mc GROUP BY 1) s ON s.cc=k.cc
       LEFT JOIN (SELECT cc, sum(sp) sp FROM g_c GROUP BY 1) g ON g.cc=k.cc LEFT JOIN (SELECT cc, sum(sp) sp FROM m_c GROUP BY 1) m ON m.cc=k.cc) z),
    'country_gaps', jsonb_build_object(
       'google_country_total', (SELECT round(coalesce(sum(sp),0),2) FROM g_c WHERE cc IS NOT NULL),
       'meta_country_total', (SELECT round(coalesce(sum(sp),0),2) FROM m_c WHERE cc IS NOT NULL),
       'sales_no_country_ht', (SELECT round(coalesce(sum(prod),0),2) FROM sales_mc WHERE cc IS NULL)),
    'by_product', (SELECT coalesce(jsonb_agg(jsonb_build_object('k', p.pk, 'label', coalesce(p.lab, 'Annoncé, non vendu : '||d.sku), 'ca', round(coalesce(p.ca,0),2), 'q', coalesce(p.q,0), 'cov_ht', round(coalesce(p.cov,0),2),
        'cogs', round(coalesce(p.cogs,0),2), 'est_ht', round(coalesce(p.est,0),2), 'direct', round(coalesce(d.cost,0),2),
        'alloc', round(CASE WHEN t.ca > 0 THEN coalesce(p.ca,0)/t.ca * (t.g + t.m - t.dir) ELSE 0 END,2)) ORDER BY coalesce(p.ca,0) DESC), '[]')
       FROM prod p FULL JOIN direct d ON d.pk = p.pk CROSS JOIN tot t),
    'totals', (SELECT jsonb_build_object('google', round(g,2), 'meta', round(m,2), 'direct', round(dir,2), 'direct_unsold', round(dir_unsold,2),
        'pool', round(g+m-dir,2), 'unallocated_products', round(CASE WHEN ca > 0 THEN 0 ELSE g+m-dir END,2), 'unmatched_item_cost', round(unmatched_items,2), 'prod_ht', round(ca,2)) FROM tot),
    'shipping', jsonb_build_object('include', _include_shipping, 'cost_per_doc', _ship_cost_per_doc),
    'snapshot', CASE WHEN snap.id IS NULL THEN NULL ELSE jsonb_build_object('taken_at', snap.taken_at, 'from', snap.taken_at::date-90, 'to', snap.taken_at::date-1, 'aligned', aligned) END,
    'last_sync', jsonb_build_object('erplain_sales', (SELECT max(finished_at) FROM erplain_sales_sync_runs WHERE status='success'),
        'last_day_google', (SELECT max(day) FROM google_ads_campaign_daily), 'last_day_meta', (SELECT max(day) FROM meta_ads_campaign_daily))
  ) INTO res;
  RETURN res;
END $$;
REVOKE ALL ON FUNCTION public.b2c_ad_margin(date,date,boolean,numeric) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.b2c_ad_margin(date,date,boolean,numeric) TO authenticated;