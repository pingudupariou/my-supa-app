
-- Create client categories table
CREATE TABLE public.b2b_client_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.b2b_client_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own b2b_client_categories"
  ON public.b2b_client_categories FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add category_id to b2b_clients
ALTER TABLE public.b2b_clients ADD COLUMN category_id UUID REFERENCES public.b2b_client_categories(id) ON DELETE SET NULL;
