CREATE OR REPLACE FUNCTION public.validate_crm_channel() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.sales_channel NOT IN ('B2C','B2B','OEM') THEN RAISE EXCEPTION 'Canal client invalide'; END IF;
 IF current_user NOT IN ('postgres','service_role','supabase_admin') THEN
  IF (TG_OP='UPDATE' AND (NEW.sales_channel IS DISTINCT FROM OLD.sales_channel OR NEW.erplain_customer_id IS DISTINCT FROM OLD.erplain_customer_id)) OR (TG_OP='INSERT' AND (NEW.sales_channel<>'B2B' OR NEW.erplain_customer_id IS NOT NULL)) THEN
   IF public.current_user_classification_access()<>'write' THEN RAISE EXCEPTION 'Droit Classement clients requis'; END IF;
  END IF;
 END IF;
 RETURN NEW;
END $$;