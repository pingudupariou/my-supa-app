CREATE TABLE public.costflow_cost_methods (
  variant_id text PRIMARY KEY,
  method text NOT NULL,
  source text NOT NULL,
  set_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.costflow_cost_methods TO service_role;
ALTER TABLE public.costflow_cost_methods ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.costflow_cost_method_validate() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.method NOT IN ('cump_finished','components_plus_mfg','confirmed_full') THEN RAISE EXCEPTION 'Méthode inconnue'; END IF;
  IF length(trim(NEW.source)) < 3 THEN RAISE EXCEPTION 'Source documentée obligatoire'; END IF;
  NEW.updated_at = now(); RETURN NEW;
END $$;
CREATE TRIGGER costflow_cost_methods_validate BEFORE INSERT OR UPDATE ON public.costflow_cost_methods FOR EACH ROW EXECUTE FUNCTION public.costflow_cost_method_validate();