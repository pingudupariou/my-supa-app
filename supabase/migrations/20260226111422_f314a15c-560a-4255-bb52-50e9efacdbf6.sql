
-- Add cost calculation mode and manual cost to costflow_products
ALTER TABLE public.costflow_products
ADD COLUMN cost_mode text NOT NULL DEFAULT 'bom',
ADD COLUMN manual_unit_cost numeric DEFAULT 0;
