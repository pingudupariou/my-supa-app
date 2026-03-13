
-- Tasks table
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text DEFAULT '',
  status text NOT NULL DEFAULT 'todo',
  priority text NOT NULL DEFAULT 'moyenne',
  assigned_to uuid,
  assigned_by uuid,
  customer_id uuid,
  meeting_id uuid,
  context text DEFAULT 'global',
  due_date date,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read all tasks" ON public.tasks
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can manage their own tasks" ON public.tasks
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Assigned users can update their tasks" ON public.tasks
  FOR UPDATE TO authenticated
  USING (auth.uid() = assigned_to);

-- Task notifications table
CREATE TABLE public.task_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  notification_type text NOT NULL DEFAULT 'assigned',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.task_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own notifications" ON public.task_notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Authenticated can insert notifications" ON public.task_notifications
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update their own notifications" ON public.task_notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications" ON public.task_notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Task history / activity log
CREATE TABLE public.task_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  action text NOT NULL,
  details text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.task_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read all task history" ON public.task_history
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert task history" ON public.task_history
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Updated_at trigger
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
