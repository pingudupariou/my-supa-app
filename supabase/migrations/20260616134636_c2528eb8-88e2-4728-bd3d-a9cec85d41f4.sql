-- 1. b2b_client_projections: drop overly permissive policies (a strict per-user ALL policy already exists)
DROP POLICY IF EXISTS "Authenticated can read all b2b_client_projections" ON public.b2b_client_projections;
DROP POLICY IF EXISTS "Authenticated can insert b2b_client_projections" ON public.b2b_client_projections;
DROP POLICY IF EXISTS "Authenticated can update b2b_client_projections" ON public.b2b_client_projections;
DROP POLICY IF EXISTS "Authenticated can delete b2b_client_projections" ON public.b2b_client_projections;

-- 2. task_history: restrict SELECT to own rows
DROP POLICY IF EXISTS "Authenticated can read all task history" ON public.task_history;
CREATE POLICY "Users can read their own task history"
  ON public.task_history FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 3. Storage: restrict listing of page-images bucket to authenticated users
DROP POLICY IF EXISTS "Anyone can view page images" ON storage.objects;
CREATE POLICY "Authenticated can view page images"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'page-images');

-- 4. Revoke EXECUTE on internal SECURITY DEFINER functions from anon
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_user_approved(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;

-- 5. Realtime: require authentication to subscribe to any channel topic
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid WHERE n.nspname='realtime' AND c.relname='messages') THEN
    EXECUTE 'ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated can subscribe to realtime" ON realtime.messages';
    EXECUTE $p$CREATE POLICY "Authenticated can subscribe to realtime" ON realtime.messages FOR SELECT TO authenticated USING (auth.role() = 'authenticated')$p$;
    EXECUTE $p$CREATE POLICY "Authenticated can broadcast realtime" ON realtime.messages FOR INSERT TO authenticated WITH CHECK (auth.role() = 'authenticated')$p$;
  END IF;
END $$;