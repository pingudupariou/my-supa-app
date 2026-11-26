DO $$
DECLARE p record; q text; w text; cond text := 'public.is_user_approved(auth.uid())';
BEGIN
  FOR p IN SELECT tablename, policyname, cmd, qual, with_check FROM pg_policies
    WHERE schemaname='public' AND tablename <> 'user_roles'
      AND (coalesce(qual,'') IN ('true','(auth.uid() IS NOT NULL)') OR coalesce(with_check,'') IN ('true','(auth.uid() IS NOT NULL)'))
  LOOP
    q := NULL; w := NULL;
    IF coalesce(p.qual,'') IN ('true','(auth.uid() IS NOT NULL)') THEN q := cond; END IF;
    IF coalesce(p.with_check,'') IN ('true','(auth.uid() IS NOT NULL)') THEN w := cond; END IF;
    IF q IS NOT NULL AND w IS NOT NULL THEN
      EXECUTE format('ALTER POLICY %I ON public.%I USING (%s) WITH CHECK (%s)', p.policyname, p.tablename, q, w);
    ELSIF q IS NOT NULL THEN
      EXECUTE format('ALTER POLICY %I ON public.%I USING (%s)', p.policyname, p.tablename, q);
    ELSE
      EXECUTE format('ALTER POLICY %I ON public.%I WITH CHECK (%s)', p.policyname, p.tablename, w);
    END IF;
  END LOOP;
END $$;

ALTER POLICY "Authenticated can view page images" ON storage.objects
  USING (bucket_id = 'page-images' AND public.is_user_approved(auth.uid()));
ALTER POLICY "Authenticated users can upload page images" ON storage.objects
  WITH CHECK (bucket_id = 'page-images' AND public.is_user_approved(auth.uid()) AND owner_id = auth.uid()::text);
ALTER POLICY "Authenticated users can update page images" ON storage.objects
  USING (bucket_id = 'page-images' AND public.is_user_approved(auth.uid()) AND (owner_id = auth.uid()::text OR public.has_role(auth.uid(),'admin')));
ALTER POLICY "Authenticated users can delete page images" ON storage.objects
  USING (bucket_id = 'page-images' AND public.is_user_approved(auth.uid()) AND (owner_id = auth.uid()::text OR public.has_role(auth.uid(),'admin')));