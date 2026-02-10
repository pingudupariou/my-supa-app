
-- Planning legend colors (customizable by user)
CREATE TABLE public.costflow_planning_colors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.costflow_planning_colors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read all planning colors"
  ON public.costflow_planning_colors FOR SELECT
  USING (true);

CREATE POLICY "Users can manage their own planning colors"
  ON public.costflow_planning_colors FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Planning rows (one per product line)
CREATE TABLE public.costflow_planning_rows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.costflow_planning_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read all planning rows"
  ON public.costflow_planning_rows FOR SELECT
  USING (true);

CREATE POLICY "Users can manage their own planning rows"
  ON public.costflow_planning_rows FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Planning blocks (the colored bars on the Gantt)
CREATE TABLE public.costflow_planning_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  row_id UUID NOT NULL REFERENCES public.costflow_planning_rows(id) ON DELETE CASCADE,
  color_id UUID REFERENCES public.costflow_planning_colors(id) ON DELETE SET NULL,
  label TEXT NOT NULL DEFAULT '',
  start_month INTEGER NOT NULL DEFAULT 1,
  duration INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.costflow_planning_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read all planning blocks"
  ON public.costflow_planning_blocks FOR SELECT
  USING (true);

CREATE POLICY "Users can manage their own planning blocks"
  ON public.costflow_planning_blocks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
