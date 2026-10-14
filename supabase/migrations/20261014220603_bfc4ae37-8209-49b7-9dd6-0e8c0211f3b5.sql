DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('customers','{crm}'),('customer_opportunities','{crm}'),('customer_interactions','{crm}'),('customer_orders','{crm}'),('crm_meetings','{crm}'),('crm_reminders','{crm}'),
    ('costflow_products','{costflow}'),('costflow_references','{costflow}'),('costflow_bom','{costflow}'),('costflow_suppliers','{costflow}'),('costflow_stock','{costflow}'),
    ('costflow_stock_imports','{costflow}'),('costflow_product_categories','{costflow}'),('costflow_colors','{costflow}'),('costflow_reference_files','{costflow}'),('costflow_product_channels','{costflow}'),
    ('costflow_planning_blocks','{costflow,planning-dev}'),('costflow_planning_rows','{costflow,planning-dev}'),('costflow_planning_colors','{costflow,planning-dev}'),('costflow_planning_notes','{costflow,planning-dev}'),
    ('costflow_meetings','{costflow,planning-dev}'),('costflow_meeting_tasks','{costflow,planning-dev}'),
    ('sav_tickets','{sav}'),('tasks','{tasks}'),('pricing_config','{pricing}'),('timetracking_categories','{timetracking}')
  ) AS t(tbl, tabs) LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Tab writers manage shared rows" ON public.%I', r.tbl);
    EXECUTE format('CREATE POLICY "Tab writers manage shared rows" ON public.%I FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM unnest(%L::text[]) k WHERE public.current_user_tab_access(k) = ''write'')) WITH CHECK (EXISTS (SELECT 1 FROM unnest(%L::text[]) k WHERE public.current_user_tab_access(k) = ''write''))', r.tbl, r.tabs, r.tabs);
  END LOOP;
END $$;