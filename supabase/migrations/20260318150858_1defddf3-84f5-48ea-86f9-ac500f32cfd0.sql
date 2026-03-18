ALTER TABLE public.costflow_planning_blocks
  ALTER COLUMN start_month TYPE numeric(10,2) USING start_month::numeric(10,2),
  ALTER COLUMN duration TYPE numeric(10,2) USING duration::numeric(10,2);