CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.current_user_marketing_access()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN r.role = 'admin' THEN 'write'
    ELSE coalesce((SELECT p.permission::text FROM public.tab_permissions p
      WHERE p.role::text = r.role::text AND p.tab_key = 'marketing-intelligence' LIMIT 1), 'hidden') END
  FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.approved LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.current_user_marketing_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_marketing_access() TO authenticated;

CREATE TABLE public.shopify_orders (
  id bigint PRIMARY KEY,
  name text,
  created_at_shop timestamptz NOT NULL,
  updated_at_shop timestamptz,
  processed_at timestamptz,
  cancelled_at timestamptz,
  test boolean NOT NULL DEFAULT false,
  country_code text,
  currency text,
  subtotal numeric NOT NULL DEFAULT 0,
  total_discounts numeric NOT NULL DEFAULT 0,
  total_tax numeric NOT NULL DEFAULT 0,
  total_shipping numeric NOT NULL DEFAULT 0,
  total_price numeric NOT NULL DEFAULT 0,
  total_refunded numeric NOT NULL DEFAULT 0,
  net_revenue numeric NOT NULL DEFAULT 0,
  financial_status text,
  fulfillment_status text,
  customer_id bigint,
  source_name text,
  synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX shopify_orders_created_idx ON public.shopify_orders(created_at_shop);

CREATE TABLE public.shopify_order_lines (
  id bigint PRIMARY KEY,
  order_id bigint NOT NULL REFERENCES public.shopify_orders(id) ON DELETE CASCADE,
  product_id bigint,
  variant_id bigint,
  sku text,
  title text,
  variant_title text,
  quantity integer NOT NULL DEFAULT 0,
  current_quantity integer NOT NULL DEFAULT 0,
  net_amount numeric NOT NULL DEFAULT 0
);
CREATE INDEX shopify_order_lines_order_idx ON public.shopify_order_lines(order_id);

CREATE TABLE public.shopify_products (
  id bigint PRIMARY KEY,
  title text,
  status text,
  product_type text,
  vendor text,
  updated_at_shop timestamptz,
  synced_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.shopify_variants (
  id bigint PRIMARY KEY,
  product_id bigint,
  sku text,
  title text,
  price numeric,
  unit_cost numeric,
  synced_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.shopify_refunds (
  id bigint PRIMARY KEY,
  order_id bigint NOT NULL REFERENCES public.shopify_orders(id) ON DELETE CASCADE,
  created_at_shop timestamptz,
  amount numeric NOT NULL DEFAULT 0
);

CREATE TABLE public.shopify_sync_runs (
  id bigserial PRIMARY KEY,
  mode text NOT NULL DEFAULT 'manual',
  period_label text,
  period_from timestamptz,
  period_to timestamptz,
  status text NOT NULL DEFAULT 'running',
  phase text NOT NULL DEFAULT 'products',
  cursor text,
  pages integer NOT NULL DEFAULT 0,
  orders_imported integer NOT NULL DEFAULT 0,
  orders_updated integer NOT NULL DEFAULT 0,
  products_synced integer NOT NULL DEFAULT 0,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  message text,
  triggered_by uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER update_shopify_sync_runs_updated_at BEFORE UPDATE ON public.shopify_sync_runs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT ON public.shopify_orders, public.shopify_order_lines, public.shopify_products,
  public.shopify_variants, public.shopify_refunds, public.shopify_sync_runs TO authenticated;
GRANT ALL ON public.shopify_orders, public.shopify_order_lines, public.shopify_products,
  public.shopify_variants, public.shopify_refunds, public.shopify_sync_runs TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.shopify_sync_runs_id_seq TO service_role;

ALTER TABLE public.shopify_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopify_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopify_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopify_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopify_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopify_sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Marketing readers view orders" ON public.shopify_orders FOR SELECT TO authenticated
  USING (public.current_user_marketing_access() IN ('read','write'));
CREATE POLICY "Marketing readers view order lines" ON public.shopify_order_lines FOR SELECT TO authenticated
  USING (public.current_user_marketing_access() IN ('read','write'));
CREATE POLICY "Marketing readers view products" ON public.shopify_products FOR SELECT TO authenticated
  USING (public.current_user_marketing_access() IN ('read','write'));
CREATE POLICY "Marketing readers view variants" ON public.shopify_variants FOR SELECT TO authenticated
  USING (public.current_user_marketing_access() IN ('read','write'));
CREATE POLICY "Marketing readers view refunds" ON public.shopify_refunds FOR SELECT TO authenticated
  USING (public.current_user_marketing_access() IN ('read','write'));
CREATE POLICY "Marketing readers view sync runs" ON public.shopify_sync_runs FOR SELECT TO authenticated
  USING (public.current_user_marketing_access() IN ('read','write'));

CREATE OR REPLACE FUNCTION public.shopify_dashboard(_from timestamptz, _to timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE res jsonb;
BEGIN
  IF coalesce(public.current_user_marketing_access(), 'hidden') NOT IN ('read','write') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  WITH o AS (
    SELECT * FROM public.shopify_orders
    WHERE created_at_shop >= _from AND created_at_shop < _to AND cancelled_at IS NULL AND NOT test
  )
  SELECT jsonb_build_object(
    'currency', (SELECT currency FROM o GROUP BY currency ORDER BY count(*) DESC LIMIT 1),
    'orders', (SELECT count(*) FROM o),
    'net_revenue', (SELECT coalesce(sum(net_revenue),0) FROM o),
    'gross_revenue', (SELECT coalesce(sum(total_price),0) FROM o),
    'refunded', (SELECT coalesce(sum(total_refunded),0) FROM o),
    'by_country', (SELECT coalesce(jsonb_agg(x ORDER BY x.net_revenue DESC), '[]'::jsonb) FROM (
        SELECT coalesce(country_code,'—') AS country, count(*) AS orders, sum(net_revenue) AS net_revenue
        FROM o GROUP BY 1) x),
    'by_product', (SELECT coalesce(jsonb_agg(y ORDER BY y.net_amount DESC), '[]'::jsonb) FROM (
        SELECT coalesce(l.title,'—') AS title, sum(l.current_quantity) AS quantity, sum(l.net_amount) AS net_amount
        FROM public.shopify_order_lines l JOIN o ON o.id = l.order_id
        GROUP BY 1 ORDER BY 3 DESC LIMIT 50) y),
    'by_day', (SELECT coalesce(jsonb_agg(z ORDER BY z.day), '[]'::jsonb) FROM (
        SELECT date_trunc('day', created_at_shop)::date AS day, count(*) AS orders, sum(net_revenue) AS net_revenue
        FROM o GROUP BY 1) z)
  ) INTO res;
  RETURN res;
END $$;
REVOKE EXECUTE ON FUNCTION public.shopify_dashboard(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shopify_dashboard(timestamptz, timestamptz) TO authenticated;