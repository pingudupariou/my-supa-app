
-- Add SELECT policies for authenticated users on b2b tables (matching pattern of other CRM tables)

CREATE POLICY "Authenticated can read all b2b_clients"
ON public.b2b_clients FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can read all b2b_client_projections"
ON public.b2b_client_projections FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can read all b2b_client_categories"
ON public.b2b_client_categories FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can read all b2b_delivery_fee_tiers"
ON public.b2b_delivery_fee_tiers FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can read all b2b_delivery_methods"
ON public.b2b_delivery_methods FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can read all b2b_payment_terms_options"
ON public.b2b_payment_terms_options FOR SELECT
TO authenticated
USING (true);
