CREATE POLICY "Admins can insert approval history"
  ON public.user_approval_history FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));