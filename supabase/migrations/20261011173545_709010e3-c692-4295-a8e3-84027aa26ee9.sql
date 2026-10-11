CREATE TABLE public.merchant_offers (
  name text PRIMARY KEY,
  offer_id text NOT NULL,
  feed_label text, content_language text,
  title text, sku text, gtin text, mpn text, brand text,
  color text, size text, item_group_id text, product_type text, image_link text, link text,
  price numeric, currency text, availability text,
  custom_label_0 text, custom_label_1 text, custom_label_2 text, custom_label_3 text, custom_label_4 text,
  issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  shopify_variant_id bigint, shopify_product_id bigint,
  match_method text NOT NULL DEFAULT 'none',
  last_run_id uuid,
  synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.merchant_offers (shopify_variant_id);
CREATE INDEX ON public.merchant_offers (item_group_id);
CREATE TABLE public.merchant_offer_countries (
  offer_name text NOT NULL REFERENCES public.merchant_offers(name) ON DELETE CASCADE,
  country text NOT NULL,
  status text NOT NULL,
  destinations jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (offer_name, country)
);
CREATE TABLE public.merchant_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'running',
  page_token text,
  offers_read integer NOT NULL DEFAULT 0,
  matched integer NOT NULL DEFAULT 0,
  removed integer NOT NULL DEFAULT 0,
  error text,
  triggered_by uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
GRANT SELECT ON public.merchant_offers, public.merchant_offer_countries, public.merchant_sync_runs TO authenticated;
GRANT ALL ON public.merchant_offers, public.merchant_offer_countries, public.merchant_sync_runs TO service_role;
ALTER TABLE public.merchant_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_offer_countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Marketing readers" ON public.merchant_offers FOR SELECT TO authenticated USING (current_user_marketing_access() = ANY (ARRAY['read','write']));
CREATE POLICY "Marketing readers" ON public.merchant_offer_countries FOR SELECT TO authenticated USING (current_user_marketing_access() = ANY (ARRAY['read','write']));
CREATE POLICY "Marketing readers" ON public.merchant_sync_runs FOR SELECT TO authenticated USING (current_user_marketing_access() = ANY (ARRAY['read','write']));