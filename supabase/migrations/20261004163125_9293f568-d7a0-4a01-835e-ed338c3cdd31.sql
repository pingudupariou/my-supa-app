ALTER TABLE public.erplain_mo_submissions
  ADD COLUMN IF NOT EXISTS erplain_status text,
  ADD COLUMN IF NOT EXISTS erplain_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS checks jsonb,
  ADD COLUMN IF NOT EXISTS erplain_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;