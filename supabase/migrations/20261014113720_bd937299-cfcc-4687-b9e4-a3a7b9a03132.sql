ALTER TABLE public.costflow_cost_methods
  ADD COLUMN IF NOT EXISTS unit_cost numeric,
  ADD COLUMN IF NOT EXISTS cost_status text,
  ADD COLUMN IF NOT EXISTS cost_formula text,
  ADD COLUMN IF NOT EXISTS cost_read_at timestamptz,
  ADD COLUMN IF NOT EXISTS variant_label text;

DROP FUNCTION IF EXISTS public.sales_stats(date, date, boolean, text[]);

CREATE OR REPLACE FUNCTION public.sales_stats(_from date, _to date, _include_shipping boolean, _channels text[] DEFAULT NULL, _ship_cost_per_doc numeric DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE res jsonb;
BEGIN
  IF public.current_user_tab_access('sales-stats') NOT IN ('read','write') THEN RAISE EXCEPTION 'forbidden'; END IF;
  WITH d AS (
    SELECT doc.*, CASE WHEN doc.is_shopify THEN 'B2C' ELSE coalesce(c.channel, 'A_CLASSER') END AS channel,
      coalesce(c.commercial_country, doc.billing_country, doc.shipping_country) AS commercial_country,
      (c.commercial_country IS NULL) AS cc_default
    FROM erplain_sales_documents doc LEFT JOIN erplain_sales_customers c ON c.customer_id = doc.customer_id
    WHERE doc.counted AND doc.dated_at BETWEEN _from AND _to
  ), d2 AS (SELECT * FROM d WHERE _channels IS NULL OR channel = ANY(_channels)),
  l0 AS (
    SELECT d2.*, li.sku, li.label AS line_label, li.variant_id, li.is_shipping, li.quantity AS qty, li.amount_ht,
      m.unit_cost AS cost_unit, m.cost_read_at
    FROM d2 JOIN erplain_sales_lines li ON li.document_id = d2.id
    LEFT JOIN costflow_cost_methods m ON m.variant_id = li.variant_id AND m.unit_cost IS NOT NULL AND m.cost_status = 'ok'
  ), l AS (
    SELECT l0.*,
      CASE WHEN NOT is_shipping THEN amount_ht END AS prod_ht,
      CASE WHEN NOT is_shipping AND cost_unit IS NOT NULL AND qty IS NOT NULL THEN qty * cost_unit END AS cogs,
      CASE WHEN NOT is_shipping AND cost_unit IS NOT NULL AND qty IS NOT NULL THEN amount_ht END AS cov_ht,
      CASE WHEN NOT is_shipping AND cost_unit IS NOT NULL AND qty IS NOT NULL AND dated_at < cost_read_at::date THEN amount_ht END AS est_ht
    FROM l0 WHERE (_include_shipping OR NOT is_shipping)
  )
  SELECT jsonb_build_object(
    'totals', (SELECT jsonb_build_object('ca_ht', round(coalesce(sum(amount_ht),0),2), 'qty', coalesce(sum(qty) FILTER (WHERE NOT is_shipping),0),
        'shipping_ht', round(coalesce(sum(amount_ht) FILTER (WHERE is_shipping),0),2), 'docs', count(DISTINCT id),
        'prod_ht', round(coalesce(sum(prod_ht),0),2), 'cogs', round(coalesce(sum(cogs),0),2), 'cov_ht', round(coalesce(sum(cov_ht),0),2), 'est_ht', round(coalesce(sum(est_ht),0),2)) FROM l),
    'by_month', (SELECT coalesce(jsonb_agg(x ORDER BY x->>'month'), '[]') FROM (SELECT jsonb_build_object('month', to_char(dated_at,'YYYY-MM'), 'channel', channel,
        'ca_ht', round(sum(amount_ht),2), 'qty', coalesce(sum(qty) FILTER (WHERE NOT is_shipping),0),
        'prod_ht', round(coalesce(sum(prod_ht),0),2), 'cogs', round(coalesce(sum(cogs),0),2), 'cov_ht', round(coalesce(sum(cov_ht),0),2), 'est_ht', round(coalesce(sum(est_ht),0),2)) x
        FROM l GROUP BY to_char(dated_at,'YYYY-MM'), channel) s),
    'by_channel', (SELECT coalesce(jsonb_agg(jsonb_build_object('key', channel, 'ca_ht', round(ca,2), 'qty', q, 'prod_ht', round(p,2), 'cogs', round(cg,2), 'cov_ht', round(cv,2), 'est_ht', round(es,2))), '[]')
        FROM (SELECT channel, sum(amount_ht) ca, coalesce(sum(qty) FILTER (WHERE NOT is_shipping),0) q, coalesce(sum(prod_ht),0) p, coalesce(sum(cogs),0) cg, coalesce(sum(cov_ht),0) cv, coalesce(sum(est_ht),0) es FROM l GROUP BY channel) s),
    'by_customer', (SELECT coalesce(jsonb_agg(jsonb_build_object('key', customer_id, 'label', name, 'channel', channel, 'ca_ht', round(ca,2), 'qty', q, 'prod_ht', round(p,2), 'cogs', round(cg,2), 'cov_ht', round(cv,2), 'est_ht', round(es,2)) ORDER BY ca DESC), '[]')
        FROM (SELECT customer_id, max(customer_name) name, max(channel) channel, sum(amount_ht) ca, coalesce(sum(qty) FILTER (WHERE NOT is_shipping),0) q, coalesce(sum(prod_ht),0) p, coalesce(sum(cogs),0) cg, coalesce(sum(cov_ht),0) cv, coalesce(sum(est_ht),0) es FROM l GROUP BY customer_id ORDER BY 4 DESC LIMIT 300) s),
    'by_product', (SELECT coalesce(jsonb_agg(jsonb_build_object('key', k, 'label', lab, 'ca_ht', round(ca,2), 'qty', q, 'prod_ht', round(ca,2), 'cogs', round(cg,2), 'cov_ht', round(cv,2), 'est_ht', round(es,2), 'unit_cost', uc, 'cost_read_at', cra) ORDER BY ca DESC), '[]')
        FROM (SELECT coalesce(variant_id, sku, line_label) k, max(coalesce(sku,'')||' '||coalesce(line_label,'')) lab, sum(amount_ht) ca, sum(qty) q, coalesce(sum(cogs),0) cg, coalesce(sum(cov_ht),0) cv, coalesce(sum(est_ht),0) es, max(cost_unit) uc, max(cost_read_at) cra FROM l WHERE NOT is_shipping GROUP BY 1 ORDER BY 3 DESC LIMIT 300) s),
    'by_commercial_country', (SELECT coalesce(jsonb_agg(jsonb_build_object('key', coalesce(k,'?'), 'ca_ht', round(ca,2), 'qty', q, 'default_share', ds, 'prod_ht', round(p,2), 'cogs', round(cg,2), 'cov_ht', round(cv,2), 'est_ht', round(es,2)) ORDER BY ca DESC), '[]')
        FROM (SELECT commercial_country k, sum(amount_ht) ca, coalesce(sum(qty) FILTER (WHERE NOT is_shipping),0) q, round(avg(cc_default::int)::numeric,2) ds, coalesce(sum(prod_ht),0) p, coalesce(sum(cogs),0) cg, coalesce(sum(cov_ht),0) cv, coalesce(sum(est_ht),0) es FROM l GROUP BY 1) s),
    'by_delivery_country', (SELECT coalesce(jsonb_agg(jsonb_build_object('key', coalesce(k,'?'), 'ca_ht', round(ca,2), 'qty', q, 'prod_ht', round(p,2), 'cogs', round(cg,2), 'cov_ht', round(cv,2), 'est_ht', round(es,2)) ORDER BY ca DESC), '[]')
        FROM (SELECT shipping_country k, sum(amount_ht) ca, coalesce(sum(qty) FILTER (WHERE NOT is_shipping),0) q, coalesce(sum(prod_ht),0) p, coalesce(sum(cogs),0) cg, coalesce(sum(cov_ht),0) cv, coalesce(sum(est_ht),0) es FROM l GROUP BY 1) s),
    'shipping', (SELECT jsonb_build_object('billed_ht', round(coalesce(sum(amount_ht),0),2), 'docs', count(DISTINCT id),
        'est_cost', CASE WHEN _ship_cost_per_doc IS NULL THEN NULL ELSE round(count(DISTINCT id) FILTER (WHERE doc_type='invoice') * _ship_cost_per_doc, 2) END,
        'real_cost', NULL) FROM l0 WHERE is_shipping),
    'costs', (SELECT jsonb_build_object('methods', count(*), 'valued', count(*) FILTER (WHERE unit_cost IS NOT NULL AND cost_status='ok'),
        'oldest', min(cost_read_at), 'newest', max(cost_read_at),
        'by_method', (SELECT coalesce(jsonb_object_agg(method, n), '{}') FROM (SELECT method, count(*) n FROM costflow_cost_methods WHERE unit_cost IS NOT NULL AND cost_status='ok' GROUP BY 1) z),
        'sources', (SELECT coalesce(jsonb_agg(DISTINCT source), '[]') FROM costflow_cost_methods WHERE unit_cost IS NOT NULL AND cost_status='ok')) FROM costflow_cost_methods),
    'missing_cost', (SELECT coalesce(jsonb_agg(jsonb_build_object('key', k, 'label', lab, 'ht', round(ht,2), 'reason', r) ORDER BY ht DESC), '[]') FROM (
        SELECT coalesce(variant_id, sku, line_label, '?') k, max(coalesce(sku,'')||' '||coalesce(line_label,'')) lab, sum(amount_ht) ht,
          CASE WHEN variant_id IS NULL THEN 'Ligne sans variante Erplain' WHEN max(cost_unit) IS NULL THEN 'Aucun coût validé dans Production et BE' ELSE 'Quantité absente' END r
        FROM l WHERE NOT is_shipping AND cogs IS NULL GROUP BY 1, variant_id ORDER BY 3 DESC LIMIT 50) s),
    'reconciliation', (SELECT jsonb_build_object(
        'docs_ht', round(coalesce(sum(CASE WHEN doc_type='credit_note' THEN -abs(total_ht) ELSE total_ht END),0),2),
        'invoices', count(*) FILTER (WHERE doc_type='invoice'), 'credit_notes', count(*) FILTER (WHERE doc_type='credit_note'),
        'missing_total', count(*) FILTER (WHERE total_ht IS NULL),
        'no_customer', count(*) FILTER (WHERE customer_id IS NULL),
        'lines_ht', (SELECT round(coalesce(sum(li.amount_ht),0),2) FROM erplain_sales_lines li JOIN d ON d.id = li.document_id),
        'credit_no_qty_ht', (SELECT round(coalesce(sum(li.amount_ht),0),2) FROM erplain_sales_lines li JOIN d2 ON d2.id = li.document_id WHERE d2.doc_type='credit_note' AND NOT li.is_shipping AND coalesce(li.quantity,0)=0))
      FROM d),
    'excluded', (SELECT coalesce(jsonb_agg(jsonb_build_object('reason', excluded_reason, 'doc_type', doc_type, 'n', n, 'ht', ht)), '[]') FROM (SELECT excluded_reason, doc_type, count(*) n, round(sum(total_ht),2) ht FROM erplain_sales_documents WHERE NOT counted AND dated_at BETWEEN _from AND _to GROUP BY 1,2) s)
  ) INTO res;
  RETURN res;
END $$;
REVOKE EXECUTE ON FUNCTION public.sales_stats(date, date, boolean, text[], numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sales_stats(date, date, boolean, text[], numeric) TO authenticated;