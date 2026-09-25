ALTER TABLE public.costflow_stock
  ADD COLUMN IF NOT EXISTS available_quantity numeric,
  ADD COLUMN IF NOT EXISTS reserved_quantity numeric,
  ADD COLUMN IF NOT EXISTS incoming_quantity numeric,
  ADD COLUMN IF NOT EXISTS reorder_point numeric;