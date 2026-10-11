CREATE TABLE public.meta_ads_campaigns (id bigint PRIMARY KEY, account_id text NOT NULL, name text, status text, objective text, synced_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.meta_ads_campaign_daily (account_id text NOT NULL, campaign_id bigint NOT NULL, day date NOT NULL, spend numeric NOT NULL DEFAULT 0, impressions bigint NOT NULL DEFAULT 0, clicks bigint NOT NULL DEFAULT 0, purchases numeric NOT NULL DEFAULT 0, purchase_value numeric NOT NULL DEFAULT 0, synced_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (campaign_id, day));
CREATE INDEX meta_ads_campaign_daily_day_idx ON public.meta_ads_campaign_daily(day);
CREATE TABLE public.meta_ads_country_daily (account_id text NOT NULL, campaign_id bigint NOT NULL, day date NOT NULL, country_code text NOT NULL, spend numeric NOT NULL DEFAULT 0, impressions bigint NOT NULL DEFAULT 0, clicks bigint NOT NULL DEFAULT 0, purchases numeric NOT NULL DEFAULT 0, purchase_value numeric NOT NULL DEFAULT 0, synced_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (campaign_id, day, country_code));
CREATE INDEX meta_ads_country_daily_day_idx ON public.meta_ads_country_daily(day);
CREATE TABLE public.meta_ads_sync_runs (id bigserial PRIMARY KEY, mode text NOT NULL, period_from date, period_to date, status text NOT NULL DEFAULT 'running', campaigns integer NOT NULL DEFAULT 0, campaign_rows integer NOT NULL DEFAULT 0, country_rows integer NOT NULL DEFAULT 0, message text, triggered_by uuid, started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz);
GRANT SELECT ON public.meta_ads_campaigns, public.meta_ads_campaign_daily, public.meta_ads_country_daily, public.meta_ads_sync_runs TO authenticated;
GRANT ALL ON public.meta_ads_campaigns, public.meta_ads_campaign_daily, public.meta_ads_country_daily, public.meta_ads_sync_runs TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.meta_ads_sync_runs_id_seq TO service_role;
ALTER TABLE public.meta_ads_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_ads_campaign_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_ads_country_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_ads_sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Marketing readers" ON public.meta_ads_campaigns FOR SELECT TO authenticated USING (public.current_user_marketing_access() IN ('read','write'));
CREATE POLICY "Marketing readers" ON public.meta_ads_campaign_daily FOR SELECT TO authenticated USING (public.current_user_marketing_access() IN ('read','write'));
CREATE POLICY "Marketing readers" ON public.meta_ads_country_daily FOR SELECT TO authenticated USING (public.current_user_marketing_access() IN ('read','write'));
CREATE POLICY "Marketing readers" ON public.meta_ads_sync_runs FOR SELECT TO authenticated USING (public.current_user_marketing_access() IN ('read','write'));

CREATE OR REPLACE FUNCTION public.meta_ads_dashboard(_from date, _to date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE res jsonb; shop_rev numeric; shop_orders bigint; g_cost numeric;
BEGIN
  IF coalesce(public.current_user_marketing_access(), 'hidden') NOT IN ('read','write') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT coalesce(sum(net_revenue),0), count(*) INTO shop_rev, shop_orders FROM public.shopify_orders
   WHERE (created_at_shop AT TIME ZONE 'Europe/Paris')::date BETWEEN _from AND _to AND cancelled_at IS NULL AND NOT test;
  SELECT coalesce(sum(cost),0) INTO g_cost FROM public.google_ads_campaign_daily WHERE day BETWEEN _from AND _to;
  WITH c AS (SELECT d.*, m.name, m.objective FROM public.meta_ads_campaign_daily d
             LEFT JOIN public.meta_ads_campaigns m ON m.id = d.campaign_id WHERE d.day BETWEEN _from AND _to)
  SELECT jsonb_build_object(
    'shopify_revenue', shop_rev, 'shopify_orders', shop_orders, 'google_cost', g_cost,
    'totals', (SELECT jsonb_build_object('spend', coalesce(sum(spend),0), 'clicks', coalesce(sum(clicks),0),
        'impressions', coalesce(sum(impressions),0), 'purchases', coalesce(sum(purchases),0),
        'purchase_value', coalesce(sum(purchase_value),0)) FROM c),
    'by_campaign', (SELECT coalesce(jsonb_agg(x ORDER BY x.spend DESC), '[]') FROM (
        SELECT campaign_id, max(name) name, max(objective) objective, sum(spend) spend, sum(clicks) clicks,
          sum(impressions) impressions, sum(purchases) purchases, sum(purchase_value) purchase_value
        FROM c GROUP BY campaign_id) x),
    'by_country', (SELECT coalesce(jsonb_agg(x ORDER BY x.spend DESC), '[]') FROM (
        SELECT country_code country, sum(spend) spend, sum(clicks) clicks, sum(impressions) impressions,
          sum(purchases) purchases, sum(purchase_value) purchase_value
        FROM public.meta_ads_country_daily WHERE day BETWEEN _from AND _to GROUP BY 1) x)
  ) INTO res;
  RETURN res;
END $$;
REVOKE EXECUTE ON FUNCTION public.meta_ads_dashboard(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.meta_ads_dashboard(date, date) TO authenticated;