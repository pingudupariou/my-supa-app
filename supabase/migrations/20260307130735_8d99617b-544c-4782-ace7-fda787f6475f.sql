
-- Stock levels for references and products
CREATE TABLE public.costflow_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('reference', 'product')),
  item_id uuid NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  location text DEFAULT '',
  last_updated_at timestamptz NOT NULL DEFAULT now(),
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, item_type, item_id)
);

ALTER TABLE public.costflow_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read all stock"
  ON public.costflow_stock FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage their own stock"
  ON public.costflow_stock FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Stock import history
CREATE TABLE public.costflow_stock_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  matched_count integer NOT NULL DEFAULT 0,
  partial_count integer NOT NULL DEFAULT 0,
  unmatched_count integer NOT NULL DEFAULT 0,
  imported_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.costflow_stock_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read all stock imports"
  ON public.costflow_stock_imports FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage their own stock imports"
  ON public.costflow_stock_imports FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
