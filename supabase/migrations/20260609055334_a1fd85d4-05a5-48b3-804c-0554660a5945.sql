
-- Custom column definitions
CREATE TABLE public.b2b_custom_columns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  column_type TEXT NOT NULL CHECK (column_type IN ('text', 'select', 'checkbox')),
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.b2b_custom_columns TO authenticated;
GRANT ALL ON public.b2b_custom_columns TO service_role;
ALTER TABLE public.b2b_custom_columns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read custom columns" ON public.b2b_custom_columns FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert custom columns" ON public.b2b_custom_columns FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authenticated can update custom columns" ON public.b2b_custom_columns FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete custom columns" ON public.b2b_custom_columns FOR DELETE TO authenticated USING (true);
CREATE TRIGGER update_b2b_custom_columns_updated_at BEFORE UPDATE ON public.b2b_custom_columns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Per-client custom values
CREATE TABLE public.b2b_client_custom_values (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.b2b_clients(id) ON DELETE CASCADE,
  column_id UUID NOT NULL REFERENCES public.b2b_custom_columns(id) ON DELETE CASCADE,
  value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, column_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.b2b_client_custom_values TO authenticated;
GRANT ALL ON public.b2b_client_custom_values TO service_role;
ALTER TABLE public.b2b_client_custom_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read custom values" ON public.b2b_client_custom_values FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert custom values" ON public.b2b_client_custom_values FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update custom values" ON public.b2b_client_custom_values FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete custom values" ON public.b2b_client_custom_values FOR DELETE TO authenticated USING (true);
CREATE TRIGGER update_b2b_client_custom_values_updated_at BEFORE UPDATE ON public.b2b_client_custom_values FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_b2b_client_custom_values_client ON public.b2b_client_custom_values(client_id);
CREATE INDEX idx_b2b_client_custom_values_column ON public.b2b_client_custom_values(column_id);
