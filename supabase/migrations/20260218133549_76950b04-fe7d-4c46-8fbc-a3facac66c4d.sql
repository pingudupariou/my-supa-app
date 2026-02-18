
-- Table for pipeline opportunities
CREATE TABLE public.customer_opportunities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  stage TEXT NOT NULL DEFAULT 'prospect',
  contact_name TEXT,
  estimated_amount NUMERIC DEFAULT 0,
  probability INTEGER DEFAULT 0,
  expected_close_date DATE,
  responsible TEXT,
  priority TEXT DEFAULT 'moyenne',
  next_action TEXT,
  next_action_date DATE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own opportunities"
  ON public.customer_opportunities FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated can read all opportunities"
  ON public.customer_opportunities FOR SELECT
  USING (true);

CREATE TRIGGER update_customer_opportunities_updated_at
  BEFORE UPDATE ON public.customer_opportunities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table for customer interactions history
CREATE TABLE public.customer_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  interaction_type TEXT NOT NULL DEFAULT 'note',
  subject TEXT NOT NULL DEFAULT '',
  content TEXT,
  interaction_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own interactions"
  ON public.customer_interactions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated can read all interactions"
  ON public.customer_interactions FOR SELECT
  USING (true);

-- Add priority and next_action fields to customers table
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'moyenne',
  ADD COLUMN IF NOT EXISTS next_action TEXT,
  ADD COLUMN IF NOT EXISTS next_action_date DATE,
  ADD COLUMN IF NOT EXISTS last_interaction_date TIMESTAMPTZ;
