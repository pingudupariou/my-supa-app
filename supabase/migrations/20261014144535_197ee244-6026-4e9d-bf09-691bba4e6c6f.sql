CREATE OR REPLACE FUNCTION public.sales_breakdown(_from date, _to date, _channels text[] DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE res jsonb;
BEGIN
  IF public.current_user_tab_access('sales-stats') NOT IN ('read','write') THEN RAISE EXCEPTION 'forbidden'; END IF;
  WITH d AS (
    SELECT doc.id, doc.dated_at, upper(nullif(doc.shipping_country,'')) dc,
      CASE WHEN doc.is_shopify THEN 'B2C' WHEN c.channel IN ('B2B','OEM') THEN c.channel ELSE 'B2C' END AS channel
    FROM erplain_sales_documents doc LEFT JOIN erplain_sales_customers c ON c.customer_id = doc.customer_id
    WHERE doc.counted AND doc.dated_at BETWEEN _from AND _to
  ), l AS (
    SELECT d.channel, coalesce(d.dc,'?') dc, coalesce(li.variant_id, li.sku, li.label) pk, li.sku, li.label, li.amount_ht, li.quantity q,
      CASE WHEN m.unit_cost IS NOT NULL AND li.quantity IS NOT NULL THEN li.quantity*m.unit_cost END cogs,
      CASE WHEN m.unit_cost IS NOT NULL AND li.quantity IS NOT NULL THEN li.amount_ht END cov,
      CASE WHEN m.unit_cost IS NOT NULL AND li.quantity IS NOT NULL AND d.dated_at < m.cost_read_at::date THEN li.amount_ht END est
    FROM d JOIN erplain_sales_lines li ON li.document_id = d.id
    LEFT JOIN costflow_cost_methods m ON m.variant_id = li.variant_id AND m.unit_cost IS NOT NULL AND m.cost_status='ok'
    WHERE NOT li.is_shipping AND (_channels IS NULL OR d.channel = ANY(_channels))
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('channel', channel, 'country', dc, 'key', pk, 'label', lab, 'ca_ht', round(ca,2), 'prod_ht', round(ca,2), 'qty', q,
      'cogs', round(coalesce(cogs,0),2), 'cov_ht', round(coalesce(cov,0),2), 'est_ht', round(coalesce(est,0),2)) ORDER BY ca DESC), '[]') INTO res
  FROM (SELECT channel, dc, pk, max(trim(coalesce(sku,'')||' '||coalesce(label,''))) lab, sum(amount_ht) ca, coalesce(sum(q),0) q, sum(cogs) cogs, sum(cov) cov, sum(est) est
        FROM l GROUP BY 1,2,3 ORDER BY 5 DESC LIMIT 3000) s;
  RETURN res;
END $$;
REVOKE ALL ON FUNCTION public.sales_breakdown(date,date,text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sales_breakdown(date,date,text[]) TO authenticated;