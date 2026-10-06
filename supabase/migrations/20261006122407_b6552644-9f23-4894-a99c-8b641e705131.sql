CREATE OR REPLACE FUNCTION public.bump_erplain_mo_reference(_min bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE cur bigint;
BEGIN
  SELECT last_value INTO cur FROM public.erplain_mo_reference_seq;
  IF _min > cur THEN PERFORM setval('public.erplain_mo_reference_seq', _min, true); END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.bump_erplain_mo_reference(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_erplain_mo_reference(bigint) TO service_role;