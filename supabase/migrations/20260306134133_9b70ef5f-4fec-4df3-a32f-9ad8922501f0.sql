
-- Add snapshot_type and creator_email columns to snapshots table
ALTER TABLE public.snapshots 
  ADD COLUMN IF NOT EXISTS snapshot_type text NOT NULL DEFAULT 'scenario',
  ADD COLUMN IF NOT EXISTS creator_email text;

-- Add constraint for valid snapshot types
ALTER TABLE public.snapshots 
  ADD CONSTRAINT snapshots_type_check CHECK (snapshot_type IN ('system', 'scenario'));
