
-- Notes for planning blocks
CREATE TABLE public.costflow_planning_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  block_id UUID NOT NULL REFERENCES public.costflow_planning_blocks(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.costflow_planning_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read all planning notes"
  ON public.costflow_planning_notes FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Users can manage their own planning notes"
  ON public.costflow_planning_notes FOR ALL
  TO authenticated USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_planning_notes_updated_at
  BEFORE UPDATE ON public.costflow_planning_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
