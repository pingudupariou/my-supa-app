CREATE OR REPLACE FUNCTION public.google_ads_country_vs_shopify(_days integer DEFAULT 90)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.current_user_marketing_access() NOT IN ('read','write') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN coalesce((SELECT jsonb_agg(row_to_json(t)) FROM (
    SELECT coalesce(g.cc, s.cc) country, coalesce(g.cost,0) google_cost, coalesce(g.value,0) google_value, coalesce(s.orders,0) shopify_orders, coalesce(s.revenue,0) shopify_revenue
    FROM (SELECT country_code cc, round(sum(cost)::numeric,2) cost, round(sum(conversions_value)::numeric,2) value
          FROM google_ads_country_daily WHERE day >= current_date - _days AND day < current_date GROUP BY 1) g
    FULL JOIN (SELECT country_code cc, count(*) orders, round(sum(coalesce(net_revenue,0))::numeric,2) revenue
          FROM shopify_orders WHERE cancelled_at IS NULL AND coalesce(test,false)=false
            AND created_at_shop >= current_date - _days AND created_at_shop < current_date GROUP BY 1) s ON s.cc = g.cc
  ) t), '[]'::jsonb);
END $$;
REVOKE EXECUTE ON FUNCTION public.google_ads_country_vs_shopify(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.google_ads_country_vs_shopify(integer) TO authenticated;