
-- Add soft delete column to b2b_clients
ALTER TABLE public.b2b_clients ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
