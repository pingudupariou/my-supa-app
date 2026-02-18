
-- Drop FK constraints so customer_interactions and customer_opportunities can reference b2b_clients IDs
ALTER TABLE public.customer_interactions
  DROP CONSTRAINT IF EXISTS customer_interactions_customer_id_fkey;

ALTER TABLE public.customer_opportunities
  DROP CONSTRAINT IF EXISTS customer_opportunities_customer_id_fkey;

ALTER TABLE public.customer_orders
  DROP CONSTRAINT IF EXISTS customer_orders_customer_id_fkey;
