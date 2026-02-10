
-- Table for BE meeting reports
CREATE TABLE public.costflow_meetings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  meeting_date DATE NOT NULL DEFAULT CURRENT_DATE,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.costflow_meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read all meetings" ON public.costflow_meetings FOR SELECT USING (true);
CREATE POLICY "Users can manage their own meetings" ON public.costflow_meetings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_costflow_meetings_updated_at
  BEFORE UPDATE ON public.costflow_meetings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table for meeting tasks (checkboxes)
CREATE TABLE public.costflow_meeting_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.costflow_meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  description TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.costflow_meeting_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read all meeting tasks" ON public.costflow_meeting_tasks FOR SELECT USING (true);
CREATE POLICY "Users can manage their own meeting tasks" ON public.costflow_meeting_tasks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
