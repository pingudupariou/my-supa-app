
-- Table de liaison : associe chaque produit à un ou plusieurs canaux de vente (sales rules)
CREATE TABLE public.costflow_product_channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.costflow_products(id) ON DELETE CASCADE,
  sales_rule_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (product_id, sales_rule_id)
);

-- Enable RLS
ALTER TABLE public.costflow_product_channels ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage their own product channels"
ON public.costflow_product_channels
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated can read all product channels"
ON public.costflow_product_channels
FOR SELECT
USING (true);

-- Index for performance
CREATE INDEX idx_costflow_product_channels_product ON public.costflow_product_channels(product_id);
CREATE INDEX idx_costflow_product_channels_rule ON public.costflow_product_channels(sales_rule_id);
