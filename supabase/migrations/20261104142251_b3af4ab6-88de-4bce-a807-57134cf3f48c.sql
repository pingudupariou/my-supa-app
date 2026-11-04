CREATE OR REPLACE FUNCTION public.sales_b2b_clients(_from date, _to date, _keys text[])
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE res jsonb;
BEGIN
  IF coalesce(public.current_user_tab_access('sales-stats'), 'hidden') NOT IN ('read','write') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('customer_id', cid, 'customer_name', cname, 'qty', q, 'ca_ht', round(ca,2)) ORDER BY q DESC), '[]') INTO res
  FROM (
    SELECT doc.customer_id cid,
      max(coalesce(nullif(c.customer_name,''), nullif(doc.customer_name,''), 'Client sans nom')) cname,
      coalesce(sum(li.quantity),0) q, coalesce(sum(li.amount_ht),0) ca
    FROM erplain_sales_documents doc
    JOIN erplain_sales_customers c ON c.customer_id = doc.customer_id
    JOIN erplain_sales_lines li ON li.document_id = doc.id
    WHERE doc.counted AND NOT doc.is_shopify AND c.channel = 'B2B' AND NOT li.is_shipping
      AND doc.dated_at BETWEEN _from AND _to
      AND coalesce(li.variant_id, li.sku, li.label) = ANY(_keys)
    GROUP BY doc.customer_id
  ) s;
  RETURN res;
END $$;
REVOKE ALL ON FUNCTION public.sales_b2b_clients(date,date,text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sales_b2b_clients(date,date,text[]) TO authenticated;