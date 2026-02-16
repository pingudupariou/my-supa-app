
-- B2B Clients table
CREATE TABLE public.b2b_clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  company_name TEXT NOT NULL,
  country TEXT,
  geographic_zone TEXT,
  contact_email TEXT,
  eer_date INTEGER,
  last_purchase_date INTEGER,
  client_type TEXT,
  pricing_rule TEXT,
  payment_terms TEXT,
  delivery_method TEXT,
  transport_rules TEXT,
  delivery_fee_rule TEXT,
  contract_exclusivity BOOLEAN DEFAULT false,
  contract_sign_date DATE,
  termination_notice TEXT,
  moq TEXT,
  specific_advantages TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.b2b_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own b2b_clients"
  ON public.b2b_clients FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- B2B Client yearly projections (current + historical)
CREATE TABLE public.b2b_client_projections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  client_id UUID NOT NULL REFERENCES public.b2b_clients(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  projected_revenue NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, year)
);

ALTER TABLE public.b2b_client_projections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own b2b_client_projections"
  ON public.b2b_client_projections FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Configurable delivery fee tiers
CREATE TABLE public.b2b_delivery_fee_tiers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  label TEXT NOT NULL,
  fee_amount NUMERIC NOT NULL DEFAULT 0,
  min_pieces INTEGER DEFAULT 0,
  max_pieces INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.b2b_delivery_fee_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own b2b_delivery_fee_tiers"
  ON public.b2b_delivery_fee_tiers FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Configurable payment terms options
CREATE TABLE public.b2b_payment_terms_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.b2b_payment_terms_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own b2b_payment_terms_options"
  ON public.b2b_payment_terms_options FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Configurable delivery methods
CREATE TABLE public.b2b_delivery_methods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.b2b_delivery_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own b2b_delivery_methods"
  ON public.b2b_delivery_methods FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_b2b_clients_updated_at
  BEFORE UPDATE ON public.b2b_clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
