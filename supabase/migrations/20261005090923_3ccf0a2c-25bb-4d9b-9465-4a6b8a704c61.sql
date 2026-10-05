DROP POLICY "Plan atelier writers can read erplain_sync_runs" ON public.erplain_sync_runs;
DROP POLICY "Plan atelier writers can read erplain_order_lines" ON public.erplain_order_lines;
DROP POLICY "Plan atelier writers can read erplain_stock_levels" ON public.erplain_stock_levels;
DROP POLICY "Plan atelier writers can read erplain_manufacturing_orders" ON public.erplain_manufacturing_orders;
DROP POLICY "Plan atelier writers can read erplain_boms" ON public.erplain_boms;
DROP POLICY "Plan atelier writers can read erplain_routings" ON public.erplain_routings;
DROP POLICY "Plan atelier writers can read erplain_mo_submissions" ON public.erplain_mo_submissions;
DROP POLICY "Plan atelier writers can read MO settings" ON public.erplain_mo_settings;
DROP FUNCTION public.can_write_tab(uuid, text);

-- Only answers for the calling user, so it cannot be used to probe other accounts.
CREATE OR REPLACE FUNCTION public.current_user_can_write_plan_atelier()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.tab_permissions tp ON tp.role = ur.role AND tp.tab_key = 'plan-atelier'
    WHERE ur.user_id = auth.uid() AND ur.approved = true AND tp.permission = 'write'
  )
$$;
REVOKE EXECUTE ON FUNCTION public.current_user_can_write_plan_atelier() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_can_write_plan_atelier() TO authenticated;

CREATE POLICY "Plan atelier writers can read erplain_sync_runs" ON public.erplain_sync_runs FOR SELECT TO authenticated USING (public.current_user_can_write_plan_atelier());
CREATE POLICY "Plan atelier writers can read erplain_order_lines" ON public.erplain_order_lines FOR SELECT TO authenticated USING (public.current_user_can_write_plan_atelier());
CREATE POLICY "Plan atelier writers can read erplain_stock_levels" ON public.erplain_stock_levels FOR SELECT TO authenticated USING (public.current_user_can_write_plan_atelier());
CREATE POLICY "Plan atelier writers can read erplain_manufacturing_orders" ON public.erplain_manufacturing_orders FOR SELECT TO authenticated USING (public.current_user_can_write_plan_atelier());
CREATE POLICY "Plan atelier writers can read erplain_boms" ON public.erplain_boms FOR SELECT TO authenticated USING (public.current_user_can_write_plan_atelier());
CREATE POLICY "Plan atelier writers can read erplain_routings" ON public.erplain_routings FOR SELECT TO authenticated USING (public.current_user_can_write_plan_atelier());
CREATE POLICY "Plan atelier writers can read erplain_mo_submissions" ON public.erplain_mo_submissions FOR SELECT TO authenticated USING (public.current_user_can_write_plan_atelier());
CREATE POLICY "Plan atelier writers can read MO settings" ON public.erplain_mo_settings FOR SELECT TO authenticated USING (public.current_user_can_write_plan_atelier());