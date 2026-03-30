
-- Make crm_entity_clients fully collaborative for authenticated users
CREATE POLICY "Authenticated can insert crm_entity_clients"
ON public.crm_entity_clients
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated can update crm_entity_clients"
ON public.crm_entity_clients
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated can delete crm_entity_clients"
ON public.crm_entity_clients
FOR DELETE
TO authenticated
USING (true);

-- Make b2b_client_categories collaborative
CREATE POLICY "Authenticated can insert b2b_client_categories"
ON public.b2b_client_categories
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated can update b2b_client_categories"
ON public.b2b_client_categories
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated can delete b2b_client_categories"
ON public.b2b_client_categories
FOR DELETE
TO authenticated
USING (true);

-- Make b2b_delivery_fee_tiers collaborative
CREATE POLICY "Authenticated can insert b2b_delivery_fee_tiers"
ON public.b2b_delivery_fee_tiers
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated can update b2b_delivery_fee_tiers"
ON public.b2b_delivery_fee_tiers
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated can delete b2b_delivery_fee_tiers"
ON public.b2b_delivery_fee_tiers
FOR DELETE
TO authenticated
USING (true);

-- Make b2b_payment_terms_options collaborative
CREATE POLICY "Authenticated can insert b2b_payment_terms_options"
ON public.b2b_payment_terms_options
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated can update b2b_payment_terms_options"
ON public.b2b_payment_terms_options
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated can delete b2b_payment_terms_options"
ON public.b2b_payment_terms_options
FOR DELETE
TO authenticated
USING (true);

-- Make b2b_delivery_methods collaborative
CREATE POLICY "Authenticated can insert b2b_delivery_methods"
ON public.b2b_delivery_methods
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated can update b2b_delivery_methods"
ON public.b2b_delivery_methods
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated can delete b2b_delivery_methods"
ON public.b2b_delivery_methods
FOR DELETE
TO authenticated
USING (true);

-- Make b2b_client_projections collaborative
CREATE POLICY "Authenticated can insert b2b_client_projections"
ON public.b2b_client_projections
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated can update b2b_client_projections"
ON public.b2b_client_projections
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated can delete b2b_client_projections"
ON public.b2b_client_projections
FOR DELETE
TO authenticated
USING (true);
