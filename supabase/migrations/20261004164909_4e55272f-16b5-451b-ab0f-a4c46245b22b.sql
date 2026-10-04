ALTER TABLE public.erplain_order_lines
  ADD COLUMN IF NOT EXISTS order_created_at text,
  ADD COLUMN IF NOT EXISTS order_dated_at text;