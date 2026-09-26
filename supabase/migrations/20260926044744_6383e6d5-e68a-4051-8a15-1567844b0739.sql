CREATE TABLE public.costflow_colors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  code text NOT NULL,
  hex text DEFAULT '#888888',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.costflow_colors TO authenticated;
GRANT ALL ON public.costflow_colors TO service_role;
ALTER TABLE public.costflow_colors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team can read colors" ON public.costflow_colors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Team can insert colors" ON public.costflow_colors FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Team can update colors" ON public.costflow_colors FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Team can delete colors" ON public.costflow_colors FOR DELETE TO authenticated USING (true);

ALTER TABLE public.costflow_references
  ADD COLUMN parent_reference_id uuid REFERENCES public.costflow_references(id) ON DELETE SET NULL,
  ADD COLUMN color_id uuid REFERENCES public.costflow_colors(id) ON DELETE SET NULL;
ALTER TABLE public.costflow_products
  ADD COLUMN parent_product_id uuid REFERENCES public.costflow_products(id) ON DELETE SET NULL,
  ADD COLUMN color_id uuid REFERENCES public.costflow_colors(id) ON DELETE SET NULL;