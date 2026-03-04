
-- Table: RDV / réunions clients
CREATE TABLE public.crm_meetings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  meeting_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  duration_minutes INTEGER DEFAULT 60,
  location TEXT,
  participants TEXT,
  notes TEXT,
  action_items TEXT,
  status TEXT NOT NULL DEFAULT 'planned',
  responsible TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table: rappels / tâches de relance
CREATE TABLE public.crm_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  description TEXT,
  due_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reminder_type TEXT NOT NULL DEFAULT 'follow_up',
  priority TEXT NOT NULL DEFAULT 'moyenne',
  is_completed BOOLEAN NOT NULL DEFAULT false,
  assigned_to TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS for crm_meetings
ALTER TABLE public.crm_meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read all crm_meetings"
  ON public.crm_meetings FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can manage their own crm_meetings"
  ON public.crm_meetings FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS for crm_reminders
ALTER TABLE public.crm_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read all crm_reminders"
  ON public.crm_reminders FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can manage their own crm_reminders"
  ON public.crm_reminders FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_crm_meetings_updated_at
  BEFORE UPDATE ON public.crm_meetings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crm_reminders_updated_at
  BEFORE UPDATE ON public.crm_reminders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
