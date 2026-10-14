CREATE OR REPLACE FUNCTION public.current_user_tab_access(_tab text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT CASE WHEN r.role = 'admin' THEN 'write'
    ELSE coalesce((SELECT p.permission::text FROM public.tab_permissions p
      WHERE p.role::text = r.role::text AND p.tab_key = _tab LIMIT 1), 'hidden') END
  FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.approved LIMIT 1), 'hidden')
$$;
REVOKE EXECUTE ON FUNCTION public.current_user_tab_access(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_tab_access(text) TO authenticated;

CREATE TABLE public.erplain_sales_documents (
  id text PRIMARY KEY,
  doc_type text NOT NULL,
  erplain_id bigint NOT NULL,
  label text, status text,
  dated_at date,
  customer_id text, customer_name text,
  order_id text, source text,
  is_shopify boolean NOT NULL DEFAULT false, shopify_reason text,
  shipping_country text, billing_country text, currency text,
  total_ht numeric, total_ttc numeric, total_tax numeric,
  shipping_ht numeric, lines_raw numeric,
  counted boolean NOT NULL DEFAULT true, excluded_reason text,
  run_id uuid, synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.erplain_sales_documents (dated_at);
CREATE INDEX ON public.erplain_sales_documents (customer_id);

CREATE TABLE public.erplain_sales_lines (
  id text PRIMARY KEY,
  document_id text NOT NULL REFERENCES public.erplain_sales_documents(id) ON DELETE CASCADE,
  variant_id text, sku text, label text, line_type text,
  is_shipping boolean NOT NULL DEFAULT false,
  quantity numeric, raw_total numeric, amount_ht numeric
);
CREATE INDEX ON public.erplain_sales_lines (document_id);

CREATE TABLE public.erplain_sales_customers (
  customer_id text PRIMARY KEY,
  customer_name text,
  channel text NOT NULL DEFAULT 'A_CLASSER',
  commercial_country text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.erplain_sales_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'running',
  phase text NOT NULL DEFAULT 'invoices',
  page integer NOT NULL DEFAULT 1,
  totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  schema jsonb,
  message text,
  started_by uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

GRANT SELECT ON public.erplain_sales_documents, public.erplain_sales_lines, public.erplain_sales_sync_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.erplain_sales_customers TO authenticated;
GRANT ALL ON public.erplain_sales_documents, public.erplain_sales_lines, public.erplain_sales_sync_runs, public.erplain_sales_customers TO service_role;

ALTER TABLE public.erplain_sales_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erplain_sales_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erplain_sales_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erplain_sales_sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sales stats read docs" ON public.erplain_sales_documents FOR SELECT TO authenticated USING (public.current_user_tab_access('sales-stats') IN ('read','write'));
CREATE POLICY "Sales stats read lines" ON public.erplain_sales_lines FOR SELECT TO authenticated USING (public.current_user_tab_access('sales-stats') IN ('read','write'));
CREATE POLICY "Sales stats read runs" ON public.erplain_sales_sync_runs FOR SELECT TO authenticated USING (public.current_user_tab_access('sales-stats') IN ('read','write'));
CREATE POLICY "Sales stats read customers" ON public.erplain_sales_customers FOR SELECT TO authenticated USING (public.current_user_tab_access('sales-stats') IN ('read','write'));
CREATE POLICY "Sales stats insert customers" ON public.erplain_sales_customers FOR INSERT TO authenticated WITH CHECK (public.current_user_tab_access('sales-stats') = 'write' AND channel IN ('B2B','OEM','A_CLASSER'));
CREATE POLICY "Sales stats update customers" ON public.erplain_sales_customers FOR UPDATE TO authenticated USING (public.current_user_tab_access('sales-stats') = 'write') WITH CHECK (channel IN ('B2B','OEM','A_CLASSER'));

CREATE TRIGGER erplain_sales_customers_updated BEFORE UPDATE ON public.erplain_sales_customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Aggregated stats: one row per counted document line, B2C for Shopify docs, otherwise the saved classification.
CREATE OR REPLACE FUNCTION public.sales_stats(_from date, _to date, _include_shipping boolean, _channels text[] DEFAULT NULL)
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
  ), l AS (
    SELECT d.*, li.sku, li.label AS line_label, li.variant_id, li.is_shipping, li.quantity AS qty, li.amount_ht
    FROM d JOIN erplain_sales_lines li ON li.document_id = d.id
    WHERE (_include_shipping OR NOT li.is_shipping) AND (_channels IS NULL OR d.channel = ANY(_channels))
  )
  SELECT jsonb_build_object(
    'totals', (SELECT jsonb_build_object('ca_ht', round(coalesce(sum(amount_ht),0),2), 'qty', coalesce(sum(qty) FILTER (WHERE NOT is_shipping),0),
        'shipping_ht', round(coalesce(sum(amount_ht) FILTER (WHERE is_shipping),0),2), 'docs', count(DISTINCT id)) FROM l),
    'by_month', (SELECT coalesce(jsonb_agg(x ORDER BY x->>'month'), '[]') FROM (SELECT jsonb_build_object('month', to_char(dated_at,'YYYY-MM'), 'channel', channel,
        'ca_ht', round(sum(amount_ht),2), 'qty', coalesce(sum(qty) FILTER (WHERE NOT is_shipping),0)) x FROM l GROUP BY 1 IS NULL, to_char(dated_at,'YYYY-MM'), channel) s),
    'by_channel', (SELECT coalesce(jsonb_agg(jsonb_build_object('key', channel, 'ca_ht', round(ca,2), 'qty', q)), '[]') FROM (SELECT channel, sum(amount_ht) ca, coalesce(sum(qty) FILTER (WHERE NOT is_shipping),0) q FROM l GROUP BY channel) s),
    'by_customer', (SELECT coalesce(jsonb_agg(jsonb_build_object('key', customer_id, 'label', name, 'channel', channel, 'ca_ht', round(ca,2), 'qty', q) ORDER BY ca DESC), '[]') FROM (SELECT customer_id, max(customer_name) name, max(channel) channel, sum(amount_ht) ca, coalesce(sum(qty) FILTER (WHERE NOT is_shipping),0) q FROM l GROUP BY customer_id ORDER BY 5 DESC LIMIT 300) s),
    'by_product', (SELECT coalesce(jsonb_agg(jsonb_build_object('key', k, 'label', lab, 'ca_ht', round(ca,2), 'qty', q) ORDER BY ca DESC), '[]') FROM (SELECT coalesce(variant_id, sku, line_label) k, max(coalesce(sku,'')||' '||coalesce(line_label,'')) lab, sum(amount_ht) ca, sum(qty) q FROM l WHERE NOT is_shipping GROUP BY 1 ORDER BY 3 DESC LIMIT 300) s),
    'by_commercial_country', (SELECT coalesce(jsonb_agg(jsonb_build_object('key', coalesce(k,'?'), 'ca_ht', round(ca,2), 'qty', q, 'default_share', ds) ORDER BY ca DESC), '[]') FROM (SELECT commercial_country k, sum(amount_ht) ca, coalesce(sum(qty) FILTER (WHERE NOT is_shipping),0) q, round(avg(cc_default::int)::numeric,2) ds FROM l GROUP BY 1) s),
    'by_delivery_country', (SELECT coalesce(jsonb_agg(jsonb_build_object('key', coalesce(k,'?'), 'ca_ht', round(ca,2), 'qty', q) ORDER BY ca DESC), '[]') FROM (SELECT shipping_country k, sum(amount_ht) ca, coalesce(sum(qty) FILTER (WHERE NOT is_shipping),0) q FROM l GROUP BY 1) s),
    'reconciliation', (SELECT jsonb_build_object(
        'docs_ht', round(coalesce(sum(CASE WHEN doc_type='credit_note' THEN -abs(total_ht) ELSE total_ht END),0),2),
        'invoices', count(*) FILTER (WHERE doc_type='invoice'), 'credit_notes', count(*) FILTER (WHERE doc_type='credit_note'),
        'missing_total', count(*) FILTER (WHERE total_ht IS NULL),
        'no_customer', count(*) FILTER (WHERE customer_id IS NULL),
        'lines_ht', (SELECT round(coalesce(sum(li.amount_ht),0),2) FROM erplain_sales_lines li JOIN d ON d.id = li.document_id))
      FROM d),
    'excluded', (SELECT coalesce(jsonb_agg(jsonb_build_object('reason', excluded_reason, 'doc_type', doc_type, 'n', n, 'ht', ht)), '[]') FROM (SELECT excluded_reason, doc_type, count(*) n, round(sum(total_ht),2) ht FROM erplain_sales_documents WHERE NOT counted AND dated_at BETWEEN _from AND _to GROUP BY 1,2) s)
  ) INTO res;
  RETURN res;
END $$;
REVOKE EXECUTE ON FUNCTION public.sales_stats(date, date, boolean, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sales_stats(date, date, boolean, text[]) TO authenticated;