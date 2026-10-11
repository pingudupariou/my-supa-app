CREATE TABLE public.google_ads_structure_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  taken_at timestamptz NOT NULL DEFAULT now(),
  mode text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'running',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  triggered_by uuid,
  finished_at timestamptz
);
GRANT SELECT ON public.google_ads_structure_snapshots TO authenticated;
GRANT ALL ON public.google_ads_structure_snapshots TO service_role;
ALTER TABLE public.google_ads_structure_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Marketing readers view structure" ON public.google_ads_structure_snapshots FOR SELECT TO authenticated USING (public.current_user_marketing_access() IN ('read','write'));
CREATE INDEX ON public.google_ads_structure_snapshots (taken_at DESC);