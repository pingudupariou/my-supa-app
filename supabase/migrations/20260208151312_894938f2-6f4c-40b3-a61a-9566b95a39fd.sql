
-- ==========================================
-- COSTFLOW MODULE - Production & Engineering
-- ==========================================

-- Storage bucket for technical plans
INSERT INTO storage.buckets (id, name, public) VALUES ('technical-plans', 'technical-plans', false);

-- References (parts/components)
CREATE TABLE public.costflow_references (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'Mécanique',
  revision CHAR(1) DEFAULT 'A',
  supplier TEXT,
  currency TEXT DEFAULT 'EUR',
  price_vol_50 NUMERIC DEFAULT 0,
  price_vol_100 NUMERIC DEFAULT 0,
  price_vol_200 NUMERIC DEFAULT 0,
  price_vol_500 NUMERIC DEFAULT 0,
  price_vol_1000 NUMERIC DEFAULT 0,
  price_vol_2000 NUMERIC DEFAULT 0,
  price_vol_5000 NUMERIC DEFAULT 0,
  price_vol_10000 NUMERIC DEFAULT 0,
  comments TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.costflow_references ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own references" ON public.costflow_references
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can read all references" ON public.costflow_references
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_costflow_references_updated_at
  BEFORE UPDATE ON public.costflow_references
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Reference files (technical plans with version history)
CREATE TABLE public.costflow_reference_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  reference_id UUID NOT NULL REFERENCES public.costflow_references(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT DEFAULT 0,
  version INTEGER DEFAULT 1,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.costflow_reference_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own files" ON public.costflow_reference_files
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can read all files" ON public.costflow_reference_files
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Products (finished goods)
CREATE TABLE public.costflow_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  family TEXT DEFAULT 'Standard',
  main_supplier TEXT,
  coefficient NUMERIC DEFAULT 1.3,
  price_ttc NUMERIC DEFAULT 0,
  default_volume INTEGER DEFAULT 500,
  comments TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.costflow_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own products" ON public.costflow_products
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can read all products" ON public.costflow_products
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_costflow_products_updated_at
  BEFORE UPDATE ON public.costflow_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- BOM (Bill of Materials) - links products to references
CREATE TABLE public.costflow_bom (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.costflow_products(id) ON DELETE CASCADE,
  reference_id UUID NOT NULL REFERENCES public.costflow_references(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.costflow_bom ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own bom" ON public.costflow_bom
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can read all bom" ON public.costflow_bom
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Storage policies for technical-plans bucket
CREATE POLICY "Users can upload their own plans" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'technical-plans' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own plans" ON storage.objects
  FOR SELECT USING (bucket_id = 'technical-plans' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own plans" ON storage.objects
  FOR DELETE USING (bucket_id = 'technical-plans' AND auth.uid()::text = (storage.foldername(name))[1]);
