DO $m$
DECLARE s text;
BEGIN
  s := pg_get_functiondef('public.sales_stats(date,date,boolean,text[],numeric)'::regprocedure);
  s := replace(s, $x$CASE WHEN doc.is_shopify THEN 'B2C' ELSE coalesce(c.channel, 'A_CLASSER') END AS channel$x$,
                  $x$CASE WHEN doc.is_shopify THEN 'B2C' WHEN c.channel IN ('B2B','OEM') THEN c.channel ELSE 'B2C' END AS channel$x$);
  EXECUTE s;
  s := pg_get_functiondef('public.b2c_ad_margin(date,date,boolean,numeric)'::regprocedure);
  s := replace(s, $x$WHERE d.counted AND d.is_shopify AND d.dated_at$x$,
                  $x$WHERE d.counted AND (d.is_shopify OR NOT EXISTS (SELECT 1 FROM erplain_sales_customers c WHERE c.customer_id = d.customer_id AND c.channel IN ('B2B','OEM'))) AND d.dated_at$x$);
  EXECUTE s;
END $m$;