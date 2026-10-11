CREATE TABLE public.merchant_catalog_selections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  kind text NOT NULL DEFAULT 'fixed',
  target_country text,
  item_keys text[] NOT NULL DEFAULT '{}',
  rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.merchant_catalog_selections TO authenticated;
GRANT ALL ON public.merchant_catalog_selections TO service_role;
ALTER TABLE public.merchant_catalog_selections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Marketing readers view selections" ON public.merchant_catalog_selections FOR SELECT TO authenticated USING (public.current_user_marketing_access() IN ('read','write'));
CREATE POLICY "Marketing writers create selections" ON public.merchant_catalog_selections FOR INSERT TO authenticated WITH CHECK (public.current_user_marketing_access() = 'write' AND created_by = auth.uid());
CREATE POLICY "Marketing writers update selections" ON public.merchant_catalog_selections FOR UPDATE TO authenticated USING (public.current_user_marketing_access() = 'write') WITH CHECK (public.current_user_marketing_access() = 'write');
CREATE POLICY "Marketing writers delete selections" ON public.merchant_catalog_selections FOR DELETE TO authenticated USING (public.current_user_marketing_access() = 'write');
CREATE TRIGGER trg_mcs_updated BEFORE UPDATE ON public.merchant_catalog_selections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.merchant_manual_matches (
  offer_id text PRIMARY KEY,
  shopify_variant_id bigint NOT NULL,
  note text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.merchant_manual_matches TO authenticated;
GRANT ALL ON public.merchant_manual_matches TO service_role;
ALTER TABLE public.merchant_manual_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Marketing readers view manual matches" ON public.merchant_manual_matches FOR SELECT TO authenticated USING (public.current_user_marketing_access() IN ('read','write'));
CREATE POLICY "Marketing writers create manual matches" ON public.merchant_manual_matches FOR INSERT TO authenticated WITH CHECK (public.current_user_marketing_access() = 'write' AND created_by = auth.uid());
CREATE POLICY "Marketing writers update manual matches" ON public.merchant_manual_matches FOR UPDATE TO authenticated USING (public.current_user_marketing_access() = 'write') WITH CHECK (public.current_user_marketing_access() = 'write');
CREATE POLICY "Marketing writers delete manual matches" ON public.merchant_manual_matches FOR DELETE TO authenticated USING (public.current_user_marketing_access() = 'write');
CREATE TRIGGER trg_mmm_updated BEFORE UPDATE ON public.merchant_manual_matches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.merchant_catalog_sales(_days integer DEFAULT 365)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.current_user_marketing_access() NOT IN ('read','write') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_array(variant_id, qty, rev)) FROM (
    SELECT l.variant_id, sum(coalesce(l.current_quantity, l.quantity))::int qty, round(sum(coalesce(l.net_amount,0))::numeric, 2) rev
    FROM shopify_order_lines l JOIN shopify_orders o ON o.id = l.order_id
    WHERE l.variant_id IS NOT NULL AND o.cancelled_at IS NULL AND coalesce(o.test,false) = false
      AND o.created_at_shop >= now() - make_interval(days => _days)
    GROUP BY l.variant_id) s), '[]'::jsonb);
END $$;
REVOKE EXECUTE ON FUNCTION public.merchant_catalog_sales(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merchant_catalog_sales(integer) TO authenticated;