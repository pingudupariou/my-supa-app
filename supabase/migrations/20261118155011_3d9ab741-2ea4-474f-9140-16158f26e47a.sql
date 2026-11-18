CREATE OR REPLACE FUNCTION public.apply_customer_rules_guarded() RETURNS void LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.pipe_channel_rules WHERE enabled AND field = 'label')
     AND NOT EXISTS (SELECT 1 FROM public.erplain_sales_documents WHERE order_label IS NOT NULL) THEN
    RAISE EXCEPTION 'Références de bons de commande pas encore lues : lancez la synchronisation des ventes dans Statistiques commerciales, le classement se fera ensuite automatiquement.';
  END IF;
END $$;
DO $$
DECLARE src text;
BEGIN
  src := pg_get_functiondef('public.apply_customer_rules'::regproc);
  src := replace(src, 'IF auth.role() <> ''service_role'' AND public.current_user_classification_access() <> ''write'' THEN RAISE EXCEPTION ''forbidden''; END IF;',
    'IF auth.role() <> ''service_role'' AND public.current_user_classification_access() <> ''write'' THEN RAISE EXCEPTION ''forbidden''; END IF;
  PERFORM public.apply_customer_rules_guarded();');
  EXECUTE src;
END $$;