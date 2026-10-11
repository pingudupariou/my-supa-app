DO $migration$
DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef('public.marketing_cockpit(date,date,date)'::regprocedure) INTO definition;
  IF position('jsonb_build_array(b, c, r, n)' IN definition) = 0 OR position('round(sum(net_revenue),2) r, count(*) n' IN definition) = 0 THEN
    RAISE EXCEPTION 'Unexpected marketing_cockpit definition; no change applied';
  END IF;
  definition := replace(definition, 'jsonb_build_array(b, c, r, n)', 'jsonb_build_array(b, c, r, n, sh)');
  definition := replace(definition, 'round(sum(net_revenue),2) r, count(*) n', 'round(sum(net_revenue),2) r, count(*) n, round(sum(coalesce(total_shipping,0)),2) sh');
  EXECUTE definition;
END
$migration$;