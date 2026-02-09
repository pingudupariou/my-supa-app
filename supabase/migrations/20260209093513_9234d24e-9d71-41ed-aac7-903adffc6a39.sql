
-- Table des catégories de produits
CREATE TABLE public.costflow_product_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  color text DEFAULT '#6366f1',
  description text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.costflow_product_categories ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can manage their own product categories"
  ON public.costflow_product_categories FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can read all product categories"
  ON public.costflow_product_categories FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Ajouter category_id aux produits existants
ALTER TABLE public.costflow_products
  ADD COLUMN category_id uuid REFERENCES public.costflow_product_categories(id) ON DELETE SET NULL;
