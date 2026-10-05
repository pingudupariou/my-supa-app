CREATE OR REPLACE FUNCTION public.current_user_can_write_plan_atelier()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = auth.uid() AND r.approved
      AND (r.role = 'admin' OR EXISTS (
        SELECT 1 FROM public.tab_permissions p
        WHERE p.role::text = r.role::text AND p.tab_key = 'plan-atelier' AND p.permission::text IN ('read','write')))
  )
$$;