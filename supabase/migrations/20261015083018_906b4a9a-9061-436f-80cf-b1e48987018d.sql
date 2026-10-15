CREATE TABLE public.tab_saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_key text NOT NULL,
  name text NOT NULL,
  data jsonb NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  creator_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tab_saves ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.tab_saves TO authenticated;
GRANT ALL ON public.tab_saves TO service_role;
CREATE POLICY "Tab readers see tab saves" ON public.tab_saves FOR SELECT TO authenticated
  USING (public.current_user_tab_access(tab_key) IN ('read','write'));
CREATE POLICY "Tab writers create tab saves" ON public.tab_saves FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.current_user_tab_access(tab_key) = 'write');
CREATE POLICY "Tab writers delete tab saves" ON public.tab_saves FOR DELETE TO authenticated
  USING (public.current_user_tab_access(tab_key) = 'write');