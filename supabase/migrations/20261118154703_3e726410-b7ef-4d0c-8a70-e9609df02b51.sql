ALTER TABLE public.erplain_sales_documents ADD COLUMN IF NOT EXISTS order_label text;
ALTER TABLE public.erplain_sales_customers ADD COLUMN IF NOT EXISTS channel_source text;

CREATE OR REPLACE FUNCTION public.norm_rule_text(_v text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT lower(btrim(translate(coalesce(_v,''), 'àâäáãåçéèêëíìîïñóòôöõúùûüýÿÀÂÄÁÃÅÇÉÈÊËÍÌÎÏÑÓÒÔÖÕÚÙÛÜÝ', 'aaaaaaceeeeiiiinooooouuuuyyAAAAAACEEEEIIIINOOOOOUUUUY')))
$$;

CREATE OR REPLACE FUNCTION public.rule_text_matches(_text text, _op text, _value text) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT CASE WHEN _text IS NULL OR public.norm_rule_text(_value) = '' THEN false
    WHEN _op = 'equals' THEN public.norm_rule_text(_text) = public.norm_rule_text(_value)
    WHEN _op = 'starts_with' THEN left(public.norm_rule_text(_text), length(public.norm_rule_text(_value))) = public.norm_rule_text(_value)
    ELSE strpos(public.norm_rule_text(_text), public.norm_rule_text(_value)) > 0 END
$$;

-- Applies all enabled rules (priority order, first match wins) to every non-manual customer.
CREATE OR REPLACE FUNCTION public.apply_customer_rules() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n_rule int; n_reset int;
BEGIN
  IF auth.role() <> 'service_role' AND public.current_user_classification_access() <> 'write' THEN RAISE EXCEPTION 'forbidden'; END IF;
  WITH r AS (SELECT * FROM public.pipe_channel_rules WHERE enabled AND btrim(value) <> ''),
  hit AS (
    SELECT DISTINCT ON (c.customer_id) c.customer_id, upper(r.channel) ch
    FROM public.erplain_sales_customers c JOIN r ON
      (r.field = 'customer' AND public.rule_text_matches(c.customer_name, r.operator, r.value)) OR
      (r.field = 'customer_id' AND public.rule_text_matches(c.customer_id, r.operator, r.value)) OR
      (r.field = 'label' AND EXISTS (SELECT 1 FROM public.erplain_sales_documents d WHERE d.customer_id = c.customer_id AND public.rule_text_matches(d.order_label, r.operator, r.value))) OR
      (r.field IN ('sku','product') AND EXISTS (SELECT 1 FROM public.erplain_sales_documents d JOIN public.erplain_sales_lines l ON l.document_id = d.id WHERE d.customer_id = c.customer_id AND public.rule_text_matches(CASE WHEN r.field = 'sku' THEN l.sku ELSE l.label END, r.operator, r.value)))
    WHERE coalesce(c.channel_source,'') <> 'manual'
    ORDER BY c.customer_id, r.priority, r.created_at, r.id
  ), upd AS (
    UPDATE public.erplain_sales_customers c SET channel = h.ch, channel_source = 'rule', updated_at = now()
    FROM hit h WHERE c.customer_id = h.customer_id AND h.ch IN ('B2C','B2B','OEM') AND (c.channel IS DISTINCT FROM h.ch OR c.channel_source IS DISTINCT FROM 'rule')
    RETURNING 1
  ) SELECT count(*) INTO n_rule FROM upd;
  WITH r AS (SELECT * FROM public.pipe_channel_rules WHERE enabled AND btrim(value) <> ''),
  matched AS (
    SELECT c.customer_id FROM public.erplain_sales_customers c JOIN r ON
      (r.field = 'customer' AND public.rule_text_matches(c.customer_name, r.operator, r.value)) OR
      (r.field = 'customer_id' AND public.rule_text_matches(c.customer_id, r.operator, r.value)) OR
      (r.field = 'label' AND EXISTS (SELECT 1 FROM public.erplain_sales_documents d WHERE d.customer_id = c.customer_id AND public.rule_text_matches(d.order_label, r.operator, r.value))) OR
      (r.field IN ('sku','product') AND EXISTS (SELECT 1 FROM public.erplain_sales_documents d JOIN public.erplain_sales_lines l ON l.document_id = d.id WHERE d.customer_id = c.customer_id AND public.rule_text_matches(CASE WHEN r.field = 'sku' THEN l.sku ELSE l.label END, r.operator, r.value)))
  ), upd2 AS (
    UPDATE public.erplain_sales_customers c SET channel = 'A_CLASSER', channel_source = NULL, updated_at = now()
    WHERE coalesce(c.channel_source,'') <> 'manual' AND c.channel <> 'A_CLASSER' AND NOT EXISTS (SELECT 1 FROM matched m WHERE m.customer_id = c.customer_id)
    RETURNING 1
  ) SELECT count(*) INTO n_reset FROM upd2;
  RETURN jsonb_build_object('classified', n_rule, 'reset', n_reset, 'docs_without_order_label', (SELECT count(*) FROM public.erplain_sales_documents WHERE order_label IS NULL));
END $$;
REVOKE ALL ON FUNCTION public.apply_customer_rules() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.apply_customer_rules() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.assign_customer_channels(_ids text[], _channel text) RETURNS integer LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE n integer; BEGIN
 IF public.current_user_classification_access()<>'write' THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF _channel IS NULL OR _channel NOT IN ('B2C','B2B','OEM','A_CLASSER','RULES') OR cardinality(_ids) IS NULL OR cardinality(_ids) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Affectation invalide'; END IF;
 IF _channel = 'RULES' THEN
   UPDATE public.erplain_sales_customers SET channel_source=NULL,updated_by=auth.uid(),updated_at=now() WHERE customer_id=ANY(_ids);
 ELSE
   UPDATE public.erplain_sales_customers SET channel=_channel,channel_source='manual',updated_by=auth.uid(),updated_at=now() WHERE customer_id=ANY(_ids);
 END IF;
 GET DIAGNOSTICS n=ROW_COUNT; RETURN n;
END $function$;