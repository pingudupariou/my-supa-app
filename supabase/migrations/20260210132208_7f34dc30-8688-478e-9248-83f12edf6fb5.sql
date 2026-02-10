
-- =============================================
-- FIX: Convert all RESTRICTIVE policies to PERMISSIVE
-- so that admin OR owner access works correctly (OR logic)
-- =============================================

-- costflow_references
DROP POLICY IF EXISTS "Admins can read all references" ON public.costflow_references;
DROP POLICY IF EXISTS "Users can manage their own references" ON public.costflow_references;
CREATE POLICY "Admins can read all references" ON public.costflow_references FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can manage their own references" ON public.costflow_references FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authenticated can read all references" ON public.costflow_references FOR SELECT TO authenticated USING (true);

-- costflow_products
DROP POLICY IF EXISTS "Admins can read all products" ON public.costflow_products;
DROP POLICY IF EXISTS "Users can manage their own products" ON public.costflow_products;
CREATE POLICY "Admins can read all products" ON public.costflow_products FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can manage their own products" ON public.costflow_products FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authenticated can read all products" ON public.costflow_products FOR SELECT TO authenticated USING (true);

-- costflow_bom
DROP POLICY IF EXISTS "Admins can read all bom" ON public.costflow_bom;
DROP POLICY IF EXISTS "Users can manage their own bom" ON public.costflow_bom;
CREATE POLICY "Admins can read all bom" ON public.costflow_bom FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can manage their own bom" ON public.costflow_bom FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authenticated can read all bom" ON public.costflow_bom FOR SELECT TO authenticated USING (true);

-- costflow_suppliers
DROP POLICY IF EXISTS "Admins can read all suppliers" ON public.costflow_suppliers;
DROP POLICY IF EXISTS "Users can manage their own suppliers" ON public.costflow_suppliers;
CREATE POLICY "Admins can read all suppliers" ON public.costflow_suppliers FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can manage their own suppliers" ON public.costflow_suppliers FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authenticated can read all suppliers" ON public.costflow_suppliers FOR SELECT TO authenticated USING (true);

-- costflow_product_categories
DROP POLICY IF EXISTS "Admins can read all product categories" ON public.costflow_product_categories;
DROP POLICY IF EXISTS "Users can manage their own product categories" ON public.costflow_product_categories;
CREATE POLICY "Admins can read all product categories" ON public.costflow_product_categories FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can manage their own product categories" ON public.costflow_product_categories FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authenticated can read all product categories" ON public.costflow_product_categories FOR SELECT TO authenticated USING (true);

-- costflow_reference_files
DROP POLICY IF EXISTS "Admins can read all files" ON public.costflow_reference_files;
DROP POLICY IF EXISTS "Users can manage their own files" ON public.costflow_reference_files;
CREATE POLICY "Admins can read all files" ON public.costflow_reference_files FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can manage their own files" ON public.costflow_reference_files FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authenticated can read all files" ON public.costflow_reference_files FOR SELECT TO authenticated USING (true);

-- customers
DROP POLICY IF EXISTS "Admins can read all customers" ON public.customers;
DROP POLICY IF EXISTS "Users can manage their own customers" ON public.customers;
CREATE POLICY "Admins can read all customers" ON public.customers FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can manage their own customers" ON public.customers FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authenticated can read all customers" ON public.customers FOR SELECT TO authenticated USING (true);

-- customer_orders
DROP POLICY IF EXISTS "Admins can read all orders" ON public.customer_orders;
DROP POLICY IF EXISTS "Users can manage their own orders" ON public.customer_orders;
CREATE POLICY "Admins can read all orders" ON public.customer_orders FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can manage their own orders" ON public.customer_orders FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authenticated can read all orders" ON public.customer_orders FOR SELECT TO authenticated USING (true);

-- financial_scenarios
DROP POLICY IF EXISTS "Admins can read all scenarios" ON public.financial_scenarios;
DROP POLICY IF EXISTS "Users can manage their own scenario" ON public.financial_scenarios;
CREATE POLICY "Admins can read all scenarios" ON public.financial_scenarios FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can manage their own scenario" ON public.financial_scenarios FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authenticated can read all scenarios" ON public.financial_scenarios FOR SELECT TO authenticated USING (true);

-- snapshots
DROP POLICY IF EXISTS "Admins can read all snapshots" ON public.snapshots;
DROP POLICY IF EXISTS "Users can manage their own snapshots" ON public.snapshots;
CREATE POLICY "Admins can read all snapshots" ON public.snapshots FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can manage their own snapshots" ON public.snapshots FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authenticated can read all snapshots" ON public.snapshots FOR SELECT TO authenticated USING (true);

-- timetracking_entries
DROP POLICY IF EXISTS "Admins can read all entries" ON public.timetracking_entries;
DROP POLICY IF EXISTS "Users can manage their own entries" ON public.timetracking_entries;
CREATE POLICY "Admins can read all entries" ON public.timetracking_entries FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can manage their own entries" ON public.timetracking_entries FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authenticated can read all entries" ON public.timetracking_entries FOR SELECT TO authenticated USING (true);
