CREATE TABLE public.erplain_mo_settings (id int PRIMARY KEY DEFAULT 1 CHECK (id = 1), reference_prefix text NOT NULL DEFAULT 'NOV-OF-', updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid);
GRANT ALL ON public.erplain_mo_settings TO service_role;
ALTER TABLE public.erplain_mo_settings ENABLE ROW LEVEL SECURITY;
INSERT INTO public.erplain_mo_settings (id) VALUES (1);
CREATE SEQUENCE public.erplain_mo_reference_seq START 1 NO CYCLE;
ALTER TABLE public.erplain_mo_submissions ADD COLUMN app_reference text UNIQUE, ADD COLUMN reference_number bigint UNIQUE;
CREATE OR REPLACE FUNCTION public.next_erplain_mo_reference() RETURNS TABLE(reference text, num bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n bigint; p text;
BEGIN
  n := nextval('public.erplain_mo_reference_seq');
  SELECT reference_prefix INTO p FROM public.erplain_mo_settings WHERE id = 1;
  RETURN QUERY SELECT coalesce(p, 'NOV-OF-') || lpad(n::text, 5, '0'), n;
END $$;
REVOKE ALL ON FUNCTION public.next_erplain_mo_reference() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_erplain_mo_reference() TO service_role;
GRANT USAGE ON SEQUENCE public.erplain_mo_reference_seq TO service_role;