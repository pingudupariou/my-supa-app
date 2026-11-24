CREATE TABLE public.sales_order_backlog (
  year int NOT NULL, month int NOT NULL, segment text NOT NULL, unbilled_ht numeric NOT NULL DEFAULT 0, orders int NOT NULL DEFAULT 0,
  read_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (year, month, segment)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_order_backlog TO authenticated;
GRANT ALL ON public.sales_order_backlog TO service_role;
ALTER TABLE public.sales_order_backlog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "backlog read" ON public.sales_order_backlog FOR SELECT TO authenticated USING (public.current_user_tab_access('sales-stats') IN ('read','write'));
CREATE POLICY "backlog insert" ON public.sales_order_backlog FOR INSERT TO authenticated WITH CHECK (public.current_user_tab_access('sales-stats') = 'write');
CREATE POLICY "backlog update" ON public.sales_order_backlog FOR UPDATE TO authenticated USING (public.current_user_tab_access('sales-stats') = 'write') WITH CHECK (public.current_user_tab_access('sales-stats') = 'write');
CREATE POLICY "backlog delete" ON public.sales_order_backlog FOR DELETE TO authenticated USING (public.current_user_tab_access('sales-stats') = 'write');
CREATE TRIGGER sales_order_backlog_updated BEFORE UPDATE ON public.sales_order_backlog FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();