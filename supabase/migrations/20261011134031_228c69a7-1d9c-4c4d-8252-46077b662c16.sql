CREATE TABLE public.marketing_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'moyenne',
  status text NOT NULL DEFAULT 'a_faire',
  assignee_user_id uuid,
  assignee_label text,
  due_date date,
  country text,
  channel text,
  campaign text,
  product text,
  results text,
  source text NOT NULL DEFAULT 'manuel',
  source_analysis_id uuid REFERENCES public.marketing_ai_analyses(id) ON DELETE SET NULL,
  source_recommendation jsonb,
  dedupe_key text,
  recurrence_count integer NOT NULL DEFAULT 1,
  last_recommended_at timestamptz,
  completed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX marketing_tasks_open_dedupe ON public.marketing_tasks(dedupe_key) WHERE dedupe_key IS NOT NULL AND status NOT IN ('termine','annule');
CREATE INDEX marketing_tasks_status ON public.marketing_tasks(status, due_date);

CREATE TABLE public.marketing_task_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.marketing_tasks(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'commentaire',
  body text NOT NULL,
  author_id uuid,
  author_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX marketing_task_events_task ON public.marketing_task_events(task_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_tasks TO authenticated;
GRANT ALL ON public.marketing_tasks TO service_role;
GRANT SELECT, INSERT ON public.marketing_task_events TO authenticated;
GRANT ALL ON public.marketing_task_events TO service_role;
ALTER TABLE public.marketing_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_task_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Marketing readers view tasks" ON public.marketing_tasks FOR SELECT TO authenticated USING (public.current_user_marketing_access() IN ('read','write'));
CREATE POLICY "Marketing writers create tasks" ON public.marketing_tasks FOR INSERT TO authenticated WITH CHECK (public.current_user_marketing_access() = 'write' AND created_by = auth.uid());
CREATE POLICY "Marketing writers update tasks" ON public.marketing_tasks FOR UPDATE TO authenticated USING (public.current_user_marketing_access() = 'write') WITH CHECK (public.current_user_marketing_access() = 'write');
CREATE POLICY "Marketing writers delete tasks" ON public.marketing_tasks FOR DELETE TO authenticated USING (public.current_user_marketing_access() = 'write');
CREATE POLICY "Marketing readers view task events" ON public.marketing_task_events FOR SELECT TO authenticated USING (public.current_user_marketing_access() IN ('read','write'));
CREATE POLICY "Marketing writers add task events" ON public.marketing_task_events FOR INSERT TO authenticated WITH CHECK (public.current_user_marketing_access() = 'write' AND author_id = auth.uid());

CREATE OR REPLACE FUNCTION public.marketing_task_validate() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status NOT IN ('a_faire','en_cours','en_attente','termine','annule') THEN RAISE EXCEPTION 'statut invalide'; END IF;
  IF NEW.priority NOT IN ('haute','moyenne','basse') THEN RAISE EXCEPTION 'priorité invalide'; END IF;
  IF NEW.status = 'termine' AND (TG_OP = 'INSERT' OR OLD.status <> 'termine') THEN NEW.completed_at := now(); END IF;
  IF NEW.status <> 'termine' THEN NEW.completed_at := NULL; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER marketing_tasks_validate BEFORE INSERT OR UPDATE ON public.marketing_tasks FOR EACH ROW EXECUTE FUNCTION public.marketing_task_validate();
CREATE TRIGGER update_marketing_tasks_updated_at BEFORE UPDATE ON public.marketing_tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();