
-- Table pour sauvegarder l'état financier par utilisateur (plan produit, organisation, charges, prévisionnel, trésorerie)
CREATE TABLE public.financial_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  state_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Un seul scénario actif par utilisateur
CREATE UNIQUE INDEX idx_financial_scenarios_user ON public.financial_scenarios(user_id);

ALTER TABLE public.financial_scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own scenario"
ON public.financial_scenarios FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can read all scenarios"
ON public.financial_scenarios FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_financial_scenarios_updated_at
BEFORE UPDATE ON public.financial_scenarios
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table CRM clients
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_name text NOT NULL,
  contact_name text,
  email text,
  phone text,
  address text,
  city text,
  postal_code text,
  country text DEFAULT 'France',
  latitude double precision,
  longitude double precision,
  status text NOT NULL DEFAULT 'prospect' CHECK (status IN ('prospect', 'active', 'inactive')),
  pricing_tier text NOT NULL DEFAULT 'bronze' CHECK (pricing_tier IN ('bronze', 'silver', 'gold')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own customers"
ON public.customers FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can read all customers"
ON public.customers FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table commandes clients
CREATE TABLE public.customer_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  order_reference text NOT NULL,
  order_date date NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date date,
  total_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'in_progress', 'delivered', 'cancelled')),
  product_category text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own orders"
ON public.customer_orders FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can read all orders"
ON public.customer_orders FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_customer_orders_updated_at
BEFORE UPDATE ON public.customer_orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
