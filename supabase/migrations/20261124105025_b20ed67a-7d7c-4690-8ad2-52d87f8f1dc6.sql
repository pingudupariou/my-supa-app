CREATE TABLE public.sales_budgets (
  year int NOT NULL, month int NOT NULL, amount numeric NOT NULL DEFAULT 0,
  updated_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (year, month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_budgets TO authenticated;
GRANT ALL ON public.sales_budgets TO service_role;
ALTER TABLE public.sales_budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sales budgets read" ON public.sales_budgets FOR SELECT TO authenticated USING (public.current_user_tab_access('sales-stats') IN ('read','write'));
CREATE POLICY "sales budgets insert" ON public.sales_budgets FOR INSERT TO authenticated WITH CHECK (public.current_user_tab_access('sales-stats') = 'write');
CREATE POLICY "sales budgets update" ON public.sales_budgets FOR UPDATE TO authenticated USING (public.current_user_tab_access('sales-stats') = 'write') WITH CHECK (public.current_user_tab_access('sales-stats') = 'write');
CREATE POLICY "sales budgets delete" ON public.sales_budgets FOR DELETE TO authenticated USING (public.current_user_tab_access('sales-stats') = 'write');
CREATE TRIGGER sales_budgets_updated BEFORE UPDATE ON public.sales_budgets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.sales_raf_report(_years int[], _include_shipping boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE res jsonb;
BEGIN
  IF public.current_user_tab_access('sales-stats') NOT IN ('read','write') THEN RAISE EXCEPTION 'forbidden'; END IF;
  WITH d AS (
    SELECT doc.id, doc.dated_at, public.customer_channel(doc.customer_id) ch,
      upper(coalesce(c.commercial_country, doc.billing_country, doc.shipping_country, '')) cc
    FROM erplain_sales_documents doc LEFT JOIN erplain_sales_customers c ON c.customer_id = doc.customer_id
    WHERE doc.counted AND extract(year FROM doc.dated_at)::int = ANY(_years)
  ), l AS (
    SELECT extract(year FROM d.dated_at)::int y, extract(month FROM d.dated_at)::int m,
      CASE WHEN d.ch = 'B2B' AND d.cc IN ('FR','FRA','FRANCE') THEN 'B2B_FR' WHEN d.ch = 'B2B' THEN 'B2B_EXPORT' ELSE d.ch END seg,
      li.amount_ht
    FROM d JOIN erplain_sales_lines li ON li.document_id = d.id
    WHERE _include_shipping OR NOT li.is_shipping
  )
  SELECT jsonb_build_object(
    'rows', (SELECT coalesce(jsonb_agg(jsonb_build_object('year', y, 'month', m, 'segment', seg, 'ca_ht', round(s,2))), '[]') FROM (SELECT y, m, seg, sum(amount_ht) s FROM l GROUP BY 1,2,3) x),
    'last_doc', (SELECT max(dated_at) FROM erplain_sales_documents WHERE counted),
    'first_doc', (SELECT min(dated_at) FROM erplain_sales_documents WHERE counted)
  ) INTO res;
  RETURN res;
END $$;
REVOKE EXECUTE ON FUNCTION public.sales_raf_report(int[], boolean) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.sales_raf_report(int[], boolean) TO authenticated;