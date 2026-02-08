
-- Categories for time tracking tasks
CREATE TABLE public.timetracking_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.timetracking_categories ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read categories
CREATE POLICY "All users can read categories"
ON public.timetracking_categories FOR SELECT
USING (true);

-- Only admin and finance can manage categories
CREATE POLICY "Admins can manage categories"
ON public.timetracking_categories FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Finance can manage categories"
ON public.timetracking_categories FOR ALL
USING (has_role(auth.uid(), 'finance'::app_role))
WITH CHECK (has_role(auth.uid(), 'finance'::app_role));

-- Time entries
CREATE TABLE public.timetracking_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  category_id UUID REFERENCES public.timetracking_categories(id) ON DELETE SET NULL,
  task_description TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  comments TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.timetracking_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own entries"
ON public.timetracking_entries FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can read all entries"
ON public.timetracking_entries FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_timetracking_entries_updated_at
BEFORE UPDATE ON public.timetracking_entries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
