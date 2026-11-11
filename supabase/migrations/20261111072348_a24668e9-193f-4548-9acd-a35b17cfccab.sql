INSERT INTO public.tab_permissions(role, tab_key, permission)
SELECT role, 'customer-classification', CASE WHEN bool_or(tab_key='sales-stats' AND permission::text='write') THEN 'write' ELSE 'read' END
FROM public.tab_permissions WHERE tab_key IN ('sales-stats','pipe-commercial','product-plan','crm','marketing-intelligence') AND permission::text IN ('read','write') GROUP BY role ON CONFLICT (role,tab_key) DO NOTHING;
CREATE OR REPLACE FUNCTION public.current_user_classification_access() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT CASE WHEN public.current_user_tab_access('customer-classification')='write' THEN 'write'
 WHEN EXISTS (SELECT 1 FROM unnest(ARRAY['customer-classification','sales-stats','pipe-commercial','product-plan','crm','marketing-intelligence']) t WHERE public.current_user_tab_access(t) IN ('read','write')) THEN 'read' ELSE 'hidden' END
$$;
REVOKE ALL ON FUNCTION public.current_user_classification_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_classification_access() TO authenticated, service_role;
DROP POLICY IF EXISTS sales_customers_read ON public.erplain_sales_customers;
DO $$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='erplain_sales_customers' LOOP EXECUTE format('DROP POLICY %I ON public.erplain_sales_customers',p.policyname); END LOOP; END $$;
CREATE POLICY classification_read ON public.erplain_sales_customers FOR SELECT TO authenticated USING (public.current_user_classification_access() IN ('read','write'));
CREATE POLICY classification_insert ON public.erplain_sales_customers FOR INSERT TO authenticated WITH CHECK (public.current_user_classification_access()='write' AND channel IN ('B2C','B2B','OEM','A_CLASSER'));
CREATE POLICY classification_update ON public.erplain_sales_customers FOR UPDATE TO authenticated USING (public.current_user_classification_access()='write') WITH CHECK (public.current_user_classification_access()='write' AND channel IN ('B2C','B2B','OEM','A_CLASSER'));
DO $$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='pipe_channel_rules' LOOP EXECUTE format('DROP POLICY %I ON public.pipe_channel_rules',p.policyname); END LOOP; END $$;
CREATE POLICY classification_rules_read ON public.pipe_channel_rules FOR SELECT TO authenticated USING (public.current_user_classification_access() IN ('read','write'));
CREATE POLICY classification_rules_insert ON public.pipe_channel_rules FOR INSERT TO authenticated WITH CHECK (public.current_user_classification_access()='write');
CREATE POLICY classification_rules_update ON public.pipe_channel_rules FOR UPDATE TO authenticated USING (public.current_user_classification_access()='write') WITH CHECK (public.current_user_classification_access()='write');
CREATE POLICY classification_rules_delete ON public.pipe_channel_rules FOR DELETE TO authenticated USING (public.current_user_classification_access()='write');
INSERT INTO public.erplain_sales_customers(customer_id,customer_name,channel)
SELECT customer_id,max(customer_name),'A_CLASSER' FROM public.erplain_sales_documents WHERE customer_id IS NOT NULL GROUP BY customer_id ON CONFLICT(customer_id) DO NOTHING;
CREATE OR REPLACE FUNCTION public.customer_channel(_customer_id text) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT CASE WHEN c.channel IN ('B2C','B2B','OEM') THEN c.channel ELSE 'B2C' END FROM (SELECT 1) seed LEFT JOIN public.erplain_sales_customers c ON c.customer_id=_customer_id
$$;
REVOKE ALL ON FUNCTION public.customer_channel(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.customer_channel(text) TO authenticated,service_role;
DO $$ DECLARE s text; f record; BEGIN
 FOR f IN SELECT oid,proname FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('sales_stats','sales_breakdown','sales_b2b_clients','b2c_ad_margin') LOOP
 s:=pg_get_functiondef(f.oid);
 s:=replace(s, $x$CASE WHEN doc.is_shopify THEN 'B2C' WHEN c.channel IN ('B2B','OEM') THEN c.channel ELSE 'B2C' END$x$, $x$public.customer_channel(doc.customer_id)$x$);
 s:=replace(s, $x$NOT doc.is_shopify AND c.channel = 'B2B'$x$, $x$public.customer_channel(doc.customer_id) = 'B2B'$x$);
 s:=replace(s, $x$(d.is_shopify OR NOT EXISTS (SELECT 1 FROM erplain_sales_customers c WHERE c.customer_id = d.customer_id AND c.channel IN ('B2B','OEM')))$x$, $x$public.customer_channel(d.customer_id) = 'B2C'$x$);
 EXECUTE s;
 END LOOP;
END $$;
ALTER TABLE public.b2b_clients ADD COLUMN erplain_customer_id text REFERENCES public.erplain_sales_customers(customer_id), ADD COLUMN sales_channel text;
UPDATE public.b2b_clients c SET sales_channel=CASE WHEN EXISTS(SELECT 1 FROM public.b2b_client_categories cat WHERE cat.id=c.category_id AND lower(cat.name) LIKE '%oem%') THEN 'OEM' ELSE 'B2B' END;
ALTER TABLE public.b2b_clients ALTER COLUMN sales_channel SET DEFAULT 'B2B', ALTER COLUMN sales_channel SET NOT NULL;
CREATE OR REPLACE FUNCTION public.validate_crm_channel() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN IF NEW.sales_channel NOT IN ('B2C','B2B','OEM') THEN RAISE EXCEPTION 'Canal client invalide'; END IF; RETURN NEW; END $$;
CREATE TRIGGER crm_channel_valid BEFORE INSERT OR UPDATE ON public.b2b_clients FOR EACH ROW EXECUTE FUNCTION public.validate_crm_channel();
CREATE OR REPLACE FUNCTION public.assign_customer_channels(_ids text[],_channel text) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n integer; BEGIN
 IF public.current_user_classification_access()<>'write' THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF _channel IS NULL OR _channel NOT IN ('B2C','B2B','OEM','A_CLASSER') OR cardinality(_ids) IS NULL OR cardinality(_ids) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Affectation invalide'; END IF;
 UPDATE public.erplain_sales_customers SET channel=_channel,updated_by=auth.uid(),updated_at=now() WHERE customer_id=ANY(_ids);
 GET DIAGNOSTICS n=ROW_COUNT; RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.assign_customer_channels(text[],text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.assign_customer_channels(text[],text) TO authenticated,service_role;