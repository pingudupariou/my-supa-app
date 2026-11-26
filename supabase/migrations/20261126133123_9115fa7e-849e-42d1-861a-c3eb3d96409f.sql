CREATE OR REPLACE FUNCTION public.sales_stats(_from date, _to date, _include_shipping boolean, _channels text[] DEFAULT NULL::text[], _ship_cost_per_doc numeric DEFAULT NULL::numeric)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE res jsonb;
BEGIN
  IF public.current_user_tab_access('sales-stats') NOT IN ('read','write') THEN RAISE EXCEPTION 'forbidden'; END IF;
  WITH d AS (
    SELECT doc.*, public.customer_channel(doc.customer_id) AS channel,
      coalesce(c.commercial_country, doc.billing_country, doc.shipping_country) AS commercial_country,
      (c.commercial_country IS NULL) AS cc_default,
      CASE WHEN _include_shipping THEN coalesce(doc.total_ht,0)
           ELSE coalesce(doc.total_ht,0)-coalesce(doc.shipping_ht,0) END AS invoice_ca_ht
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
  ), dm AS (
    SELECT to_char(dated_at,'YYYY-MM') AS mth, channel, sum(invoice_ca_ht) AS ca FROM d2 GROUP BY 1,2
  ), lm AS (
    SELECT to_char(dated_at,'YYYY-MM') AS mth, channel, sum(amount_ht) AS line_ca,
      coalesce(sum(qty) FILTER (WHERE NOT is_shipping),0) AS qty, coalesce(sum(prod_ht),0) AS prod,
      coalesce(sum(cogs),0) AS cogs, coalesce(sum(cov_ht),0) AS cov, coalesce(sum(est_ht),0) AS est
    FROM l GROUP BY 1,2
  ), dc AS (
    SELECT channel, sum(invoice_ca_ht) AS ca FROM d2 GROUP BY channel
  ), lc AS (
    SELECT channel, coalesce(sum(qty) FILTER (WHERE NOT is_shipping),0) AS qty, coalesce(sum(prod_ht),0) AS prod,
      coalesce(sum(cogs),0) AS cogs, coalesce(sum(cov_ht),0) AS cov, coalesce(sum(est_ht),0) AS est
    FROM l GROUP BY channel
  ), du AS (
    SELECT customer_id, max(customer_name) AS name, max(channel) AS channel, sum(invoice_ca_ht) AS ca FROM d2 GROUP BY customer_id
  ), lu AS (
    SELECT customer_id, coalesce(sum(qty) FILTER (WHERE NOT is_shipping),0) AS qty, coalesce(sum(prod_ht),0) AS prod,
      coalesce(sum(cogs),0) AS cogs, coalesce(sum(cov_ht),0) AS cov, coalesce(sum(est_ht),0) AS est
    FROM l GROUP BY customer_id
  ), dcc AS (
    SELECT coalesce(commercial_country,'?') AS k, sum(invoice_ca_ht) AS ca, round(avg(cc_default::int)::numeric,2) AS ds FROM d2 GROUP BY 1
  ), lcc AS (
    SELECT coalesce(commercial_country,'?') AS k, coalesce(sum(qty) FILTER (WHERE NOT is_shipping),0) AS qty,
      coalesce(sum(prod_ht),0) AS prod, coalesce(sum(cogs),0) AS cogs, coalesce(sum(cov_ht),0) AS cov, coalesce(sum(est_ht),0) AS est
    FROM l GROUP BY 1
  ), ddc AS (
    SELECT coalesce(shipping_country,'?') AS k, sum(invoice_ca_ht) AS ca FROM d2 GROUP BY 1
  ), ldc AS (
    SELECT coalesce(shipping_country,'?') AS k, coalesce(sum(qty) FILTER (WHERE NOT is_shipping),0) AS qty,
      coalesce(sum(prod_ht),0) AS prod, coalesce(sum(cogs),0) AS cogs, coalesce(sum(cov_ht),0) AS cov, coalesce(sum(est_ht),0) AS est
    FROM l GROUP BY 1
  )
  SELECT jsonb_build_object(
    'totals', jsonb_build_object(
      'ca_ht', (SELECT round(coalesce(sum(invoice_ca_ht),0),2) FROM d2),
      'qty', (SELECT coalesce(sum(qty) FILTER (WHERE NOT is_shipping),0) FROM l),
      'shipping_ht', (SELECT round(coalesce(sum(amount_ht) FILTER (WHERE is_shipping),0),2) FROM l0),
      'docs', (SELECT count(*) FROM d2),
      'prod_ht', (SELECT round(coalesce(sum(prod_ht),0),2) FROM l),
      'cogs', (SELECT round(coalesce(sum(cogs),0),2) FROM l),
      'cov_ht', (SELECT round(coalesce(sum(cov_ht),0),2) FROM l),
      'est_ht', (SELECT round(coalesce(sum(est_ht),0),2) FROM l)),
    'by_month', (SELECT coalesce(jsonb_agg(jsonb_build_object('month',mth,'channel',dm.channel,
        'ca_ht',round(dm.ca,2),'qty',coalesce(lm.qty,0),'prod_ht',round(coalesce(lm.prod,0),2),
        'cogs',round(coalesce(lm.cogs,0),2),'cov_ht',round(coalesce(lm.cov,0),2),'est_ht',round(coalesce(lm.est,0),2)) ORDER BY mth),'[]')
      FROM dm LEFT JOIN lm ON lm.mth=dm.mth AND lm.channel=dm.channel),
    'by_channel', (SELECT coalesce(jsonb_agg(jsonb_build_object('key',dc.channel,'ca_ht',round(dc.ca,2),
        'qty',coalesce(lc.qty,0),'prod_ht',round(coalesce(lc.prod,0),2),'cogs',round(coalesce(lc.cogs,0),2),
        'cov_ht',round(coalesce(lc.cov,0),2),'est_ht',round(coalesce(lc.est,0),2))),'[]') FROM dc LEFT JOIN lc ON lc.channel=dc.channel),
    'by_customer', (SELECT coalesce(jsonb_agg(jsonb_build_object('key',customer_id,'label',name,'channel',channel,
        'ca_ht',round(ca,2),'qty',qty,'prod_ht',prod,'cogs',cogs,'cov_ht',cov,'est_ht',est) ORDER BY ca DESC),'[]') FROM (
      SELECT du.customer_id,du.name,du.channel,du.ca,coalesce(lu.qty,0) AS qty,round(coalesce(lu.prod,0),2) AS prod,
        round(coalesce(lu.cogs,0),2) AS cogs,round(coalesce(lu.cov,0),2) AS cov,round(coalesce(lu.est,0),2) AS est
      FROM du LEFT JOIN lu ON lu.customer_id IS NOT DISTINCT FROM du.customer_id ORDER BY du.ca DESC LIMIT 300) s),
    'by_product', (SELECT coalesce(jsonb_agg(jsonb_build_object('key', k, 'label', lab, 'ca_ht', round(ca,2), 'qty', q, 'prod_ht', round(ca,2), 'cogs', round(cg,2), 'cov_ht', round(cv,2), 'est_ht', round(es,2), 'unit_cost', uc, 'cost_read_at', cra) ORDER BY ca DESC), '[]')
        FROM (SELECT coalesce(variant_id, sku, line_label) k, max(coalesce(sku,'')||' '||coalesce(line_label,'')) lab, sum(amount_ht) ca, sum(qty) q, coalesce(sum(cogs),0) cg, coalesce(sum(cov_ht),0) cv, coalesce(sum(est_ht),0) es, max(cost_unit) uc, max(cost_read_at) cra FROM l WHERE NOT is_shipping GROUP BY 1 ORDER BY 3 DESC LIMIT 300) s),
    'by_commercial_country', (SELECT coalesce(jsonb_agg(jsonb_build_object('key',dcc.k,'ca_ht',round(dcc.ca,2),
        'qty',coalesce(lcc.qty,0),'default_share',dcc.ds,'prod_ht',round(coalesce(lcc.prod,0),2),'cogs',round(coalesce(lcc.cogs,0),2),
        'cov_ht',round(coalesce(lcc.cov,0),2),'est_ht',round(coalesce(lcc.est,0),2)) ORDER BY dcc.ca DESC),'[]') FROM dcc LEFT JOIN lcc ON lcc.k=dcc.k),
    'by_delivery_country', (SELECT coalesce(jsonb_agg(jsonb_build_object('key',ddc.k,'ca_ht',round(ddc.ca,2),
        'qty',coalesce(ldc.qty,0),'prod_ht',round(coalesce(ldc.prod,0),2),'cogs',round(coalesce(ldc.cogs,0),2),
        'cov_ht',round(coalesce(ldc.cov,0),2),'est_ht',round(coalesce(ldc.est,0),2)) ORDER BY ddc.ca DESC),'[]') FROM ddc LEFT JOIN ldc ON ldc.k=ddc.k),
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
        'docs_ht', round(coalesce(sum(total_ht),0),2),
        'display_ht', round(coalesce(sum(invoice_ca_ht),0),2),
        'invoices_ht', round(coalesce(sum(total_ht) FILTER (WHERE doc_type='invoice'),0),2),
        'credit_notes_ht', round(coalesce(sum(total_ht) FILTER (WHERE doc_type='credit_note'),0),2),
        'unpaid_ht', round(coalesce(sum(total_ht) FILTER (WHERE doc_type='invoice' AND status='unpaid'),0),2),
        'unpaid_invoices', count(*) FILTER (WHERE doc_type='invoice' AND status='unpaid'),
        'order_invoices', count(*) FILTER (WHERE doc_type='invoice' AND order_id IS NOT NULL),
        'invoices', count(*) FILTER (WHERE doc_type='invoice'), 'credit_notes', count(*) FILTER (WHERE doc_type='credit_note'),
        'missing_total', count(*) FILTER (WHERE total_ht IS NULL),
        'no_customer', count(*) FILTER (WHERE customer_id IS NULL),
        'lines_ht', (SELECT round(coalesce(sum(li.amount_ht),0),2) FROM erplain_sales_lines li JOIN d2 ON d2.id = li.document_id),
        'credit_no_qty_ht', (SELECT round(coalesce(sum(li.amount_ht),0),2) FROM erplain_sales_lines li JOIN d2 ON d2.id = li.document_id WHERE d2.doc_type='credit_note' AND NOT li.is_shipping AND coalesce(li.quantity,0)=0))
      FROM d2),
    'excluded', (SELECT coalesce(jsonb_agg(jsonb_build_object('reason', excluded_reason, 'doc_type', doc_type, 'n', n, 'ht', ht)), '[]') FROM (SELECT excluded_reason, doc_type, count(*) n, round(sum(total_ht),2) ht FROM erplain_sales_documents WHERE NOT counted AND dated_at BETWEEN _from AND _to GROUP BY 1,2) s)
  ) INTO res;
  RETURN res;
END $function$;
REVOKE EXECUTE ON FUNCTION public.sales_stats(date,date,boolean,text[],numeric) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.sales_stats(date,date,boolean,text[],numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.sales_raf_report(_years int[], _include_shipping boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE res jsonb;
BEGIN
  IF public.current_user_tab_access('sales-stats') NOT IN ('read','write') THEN RAISE EXCEPTION 'forbidden'; END IF;
  WITH d AS (
    SELECT doc.dated_at, public.customer_channel(doc.customer_id) ch,
      upper(coalesce(c.commercial_country, doc.billing_country, doc.shipping_country, '')) cc,
      CASE WHEN _include_shipping THEN coalesce(doc.total_ht,0)
           ELSE coalesce(doc.total_ht,0)-coalesce(doc.shipping_ht,0) END AS amount_ht
    FROM erplain_sales_documents doc LEFT JOIN erplain_sales_customers c ON c.customer_id = doc.customer_id
    WHERE doc.counted AND extract(year FROM doc.dated_at)::int = ANY(_years)
  ), l AS (
    SELECT extract(year FROM dated_at)::int y, extract(month FROM dated_at)::int m,
      CASE WHEN ch = 'B2B' AND cc IN ('FR','FRA','FRANCE') THEN 'B2B_FR' WHEN ch = 'B2B' THEN 'B2B_EXPORT' ELSE ch END seg,
      amount_ht
    FROM d
  )
  SELECT jsonb_build_object(
    'rows', (SELECT coalesce(jsonb_agg(jsonb_build_object('year', y, 'month', m, 'segment', seg, 'ca_ht', round(s,2))), '[]') FROM (SELECT y, m, seg, sum(amount_ht) s FROM l GROUP BY 1,2,3) x),
    'last_doc', (SELECT max(dated_at) FROM erplain_sales_documents WHERE counted),
    'first_doc', (SELECT min(dated_at) FROM erplain_sales_documents WHERE counted)
  ) INTO res;
  RETURN res;
END $function$;
REVOKE EXECUTE ON FUNCTION public.sales_raf_report(int[], boolean) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.sales_raf_report(int[], boolean) TO authenticated;