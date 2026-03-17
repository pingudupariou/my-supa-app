-- Table to store which B2B client columns are editable by non-admin users
CREATE TABLE public.b2b_column_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  column_key text NOT NULL UNIQUE,
  is_editable_by_others boolean NOT NULL DEFAULT false,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.b2b_column_permissions ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read
CREATE POLICY "Authenticated can read b2b_column_permissions"
ON public.b2b_column_permissions
FOR SELECT TO authenticated
USING (true);

-- Only admins can modify
CREATE POLICY "Admins can manage b2b_column_permissions"
ON public.b2b_column_permissions
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed default values for all editable columns (all locked by default)
INSERT INTO public.b2b_column_permissions (column_key, is_editable_by_others) VALUES
  ('company_name', false),
  ('country', false),
  ('geographic_zone', false),
  ('contact_email', false),
  ('contact_phone', false),
  ('pricing_rule', false),
  ('payment_terms', false),
  ('delivery_method', false),
  ('delivery_fee_rule', false),
  ('moq', false),
  ('is_active', false),
  ('category', false),
  ('notes', false);
