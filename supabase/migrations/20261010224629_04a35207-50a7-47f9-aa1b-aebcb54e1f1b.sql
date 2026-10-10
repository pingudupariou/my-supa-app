CREATE TABLE public.ga4_daily_cube (
  day date NOT NULL, channel text NOT NULL, country_code text NOT NULL, country text, device text NOT NULL,
  sessions bigint NOT NULL DEFAULT 0, engaged_sessions bigint NOT NULL DEFAULT 0, new_users bigint NOT NULL DEFAULT 0,
  view_item bigint NOT NULL DEFAULT 0, add_to_cart bigint NOT NULL DEFAULT 0, begin_checkout bigint NOT NULL DEFAULT 0,
  purchases bigint NOT NULL DEFAULT 0, purchase_revenue numeric NOT NULL DEFAULT 0,
  synced_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (day, channel, country_code, device));
CREATE INDEX ga4_daily_cube_day_idx ON public.ga4_daily_cube(day);
CREATE TABLE public.ga4_daily_source (
  day date NOT NULL, source text NOT NULL, medium text NOT NULL,
  sessions bigint NOT NULL DEFAULT 0, purchases bigint NOT NULL DEFAULT 0, purchase_revenue numeric NOT NULL DEFAULT 0,
  synced_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (day, source, medium));
CREATE INDEX ga4_daily_source_day_idx ON public.ga4_daily_source(day);
CREATE TABLE public.ga4_daily_users (
  day date PRIMARY KEY, total_users bigint NOT NULL DEFAULT 0, new_users bigint NOT NULL DEFAULT 0, sessions bigint NOT NULL DEFAULT 0,
  synced_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.ga4_sync_runs (
  id bigserial PRIMARY KEY, mode text NOT NULL, period_from date, period_to date, status text NOT NULL DEFAULT 'running',
  cube_rows integer NOT NULL DEFAULT 0, source_rows integer NOT NULL DEFAULT 0, day_rows integer NOT NULL DEFAULT 0,
  message text, triggered_by uuid, started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz);

GRANT SELECT ON public.ga4_daily_cube, public.ga4_daily_source, public.ga4_daily_users, public.ga4_sync_runs TO authenticated;
GRANT ALL ON public.ga4_daily_cube, public.ga4_daily_source, public.ga4_daily_users, public.ga4_sync_runs TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.ga4_sync_runs_id_seq TO service_role;
ALTER TABLE public.ga4_daily_cube ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ga4_daily_source ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ga4_daily_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ga4_sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Marketing readers" ON public.ga4_daily_cube FOR SELECT TO authenticated USING (public.current_user_marketing_access() IN ('read','write'));
CREATE POLICY "Marketing readers" ON public.ga4_daily_source FOR SELECT TO authenticated USING (public.current_user_marketing_access() IN ('read','write'));
CREATE POLICY "Marketing readers" ON public.ga4_daily_users FOR SELECT TO authenticated USING (public.current_user_marketing_access() IN ('read','write'));
CREATE POLICY "Marketing readers" ON public.ga4_sync_runs FOR SELECT TO authenticated USING (public.current_user_marketing_access() IN ('read','write'));

CREATE OR REPLACE FUNCTION public.ga4_dashboard(_from date, _to date, _country text DEFAULT NULL, _channel text DEFAULT NULL, _device text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE res jsonb;
BEGIN
  IF coalesce(public.current_user_marketing_access(), 'hidden') NOT IN ('read','write') THEN RAISE EXCEPTION 'forbidden'; END IF;
  WITH c AS (SELECT * FROM public.ga4_daily_cube WHERE day BETWEEN _from AND _to
      AND (_country IS NULL OR country_code = _country) AND (_channel IS NULL OR channel = _channel) AND (_device IS NULL OR device = _device)),
  agg AS (SELECT coalesce(sum(sessions),0) sessions, coalesce(sum(engaged_sessions),0) engaged_sessions, coalesce(sum(new_users),0) new_users,
      coalesce(sum(view_item),0) view_item, coalesce(sum(add_to_cart),0) add_to_cart, coalesce(sum(begin_checkout),0) begin_checkout,
      coalesce(sum(purchases),0) purchases, coalesce(sum(purchase_revenue),0) purchase_revenue FROM c)
  SELECT jsonb_build_object(
    'totals', (SELECT to_jsonb(agg) FROM agg),
    'users', CASE WHEN _country IS NULL AND _channel IS NULL AND _device IS NULL THEN
        (SELECT jsonb_build_object('daily_users_sum', coalesce(sum(total_users),0), 'days', count(*)) FROM public.ga4_daily_users WHERE day BETWEEN _from AND _to) ELSE NULL END,
    'by_channel', (SELECT coalesce(jsonb_agg(x ORDER BY x.sessions DESC), '[]') FROM (SELECT channel k, sum(sessions) sessions, sum(engaged_sessions) engaged_sessions, sum(view_item) view_item, sum(add_to_cart) add_to_cart, sum(begin_checkout) begin_checkout, sum(purchases) purchases, sum(purchase_revenue) purchase_revenue FROM c GROUP BY 1) x),
    'by_country', (SELECT coalesce(jsonb_agg(x ORDER BY x.sessions DESC), '[]') FROM (SELECT country_code k, max(country) label, sum(sessions) sessions, sum(engaged_sessions) engaged_sessions, sum(view_item) view_item, sum(add_to_cart) add_to_cart, sum(begin_checkout) begin_checkout, sum(purchases) purchases, sum(purchase_revenue) purchase_revenue FROM c GROUP BY 1) x),
    'by_device', (SELECT coalesce(jsonb_agg(x ORDER BY x.sessions DESC), '[]') FROM (SELECT device k, sum(sessions) sessions, sum(engaged_sessions) engaged_sessions, sum(view_item) view_item, sum(add_to_cart) add_to_cart, sum(begin_checkout) begin_checkout, sum(purchases) purchases, sum(purchase_revenue) purchase_revenue FROM c GROUP BY 1) x),
    'by_day', (SELECT coalesce(jsonb_agg(x ORDER BY x.day), '[]') FROM (SELECT day, sum(sessions) sessions, sum(purchases) purchases FROM c GROUP BY day) x),
    'by_source', CASE WHEN _country IS NULL AND _channel IS NULL AND _device IS NULL THEN
        (SELECT coalesce(jsonb_agg(x ORDER BY x.sessions DESC), '[]') FROM (SELECT source || ' / ' || medium k, sum(sessions) sessions, sum(purchases) purchases, sum(purchase_revenue) purchase_revenue
          FROM public.ga4_daily_source WHERE day BETWEEN _from AND _to GROUP BY 1 ORDER BY 2 DESC LIMIT 30) x) ELSE NULL END,
    'options', jsonb_build_object(
        'countries', (SELECT coalesce(jsonb_agg(x ORDER BY x.s DESC), '[]') FROM (SELECT country_code k, max(country) label, sum(sessions) s FROM public.ga4_daily_cube WHERE day BETWEEN _from AND _to GROUP BY 1) x),
        'channels', (SELECT coalesce(jsonb_agg(DISTINCT channel), '[]') FROM public.ga4_daily_cube WHERE day BETWEEN _from AND _to),
        'devices', (SELECT coalesce(jsonb_agg(DISTINCT device), '[]') FROM public.ga4_daily_cube WHERE day BETWEEN _from AND _to)),
    'shopify', (SELECT jsonb_build_object('revenue', coalesce(sum(net_revenue),0), 'orders', count(*)) FROM public.shopify_orders
        WHERE (created_at_shop AT TIME ZONE 'Europe/Paris')::date BETWEEN _from AND _to AND cancelled_at IS NULL AND NOT test
          AND (_country IS NULL OR country_code = _country)),
    'google_ads', CASE WHEN _country IS NULL THEN
        (SELECT jsonb_build_object('cost', coalesce(sum(cost),0), 'clicks', coalesce(sum(clicks),0)) FROM public.google_ads_campaign_daily WHERE day BETWEEN _from AND _to)
      ELSE (SELECT jsonb_build_object('cost', coalesce(sum(cost),0), 'clicks', coalesce(sum(clicks),0)) FROM public.google_ads_country_daily WHERE day BETWEEN _from AND _to AND country_code = _country) END,
    'last_sync', (SELECT max(synced_at) FROM public.ga4_daily_users)
  ) INTO res;
  RETURN res;
END $$;
REVOKE EXECUTE ON FUNCTION public.ga4_dashboard(date, date, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ga4_dashboard(date, date, text, text, text) TO authenticated;