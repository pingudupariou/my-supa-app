CREATE TABLE public.google_ads_pilot_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid,
  kind text NOT NULL,
  campaign_id bigint,
  campaign_name text,
  title text NOT NULL,
  current_value text,
  proposed_value text,
  proposed_daily_budget numeric,
  proposed_target_roas numeric,
  estimated_impact text,
  evidence text,
  risks text,
  confidence text,
  status text NOT NULL DEFAULT 'proposee',
  draft_id uuid,
  task_id uuid,
  publish_action_id uuid,
  executed_at timestamptz,
  dedupe_key text NOT NULL,
  note text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.google_ads_pilot_actions TO authenticated;
GRANT ALL ON public.google_ads_pilot_actions TO service_role;
ALTER TABLE public.google_ads_pilot_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Marketing readers view pilot actions" ON public.google_ads_pilot_actions FOR SELECT TO authenticated USING (public.current_user_marketing_access() IN ('read','write'));
CREATE POLICY "Marketing writers add pilot actions" ON public.google_ads_pilot_actions FOR INSERT TO authenticated WITH CHECK (public.current_user_marketing_access() = 'write' AND created_by = auth.uid() AND status = 'proposee');
CREATE POLICY "Marketing writers update pilot actions" ON public.google_ads_pilot_actions FOR UPDATE TO authenticated USING (public.current_user_marketing_access() = 'write' AND status <> 'executee') WITH CHECK (public.current_user_marketing_access() = 'write' AND status <> 'executee');
CREATE UNIQUE INDEX google_ads_pilot_actions_open_key ON public.google_ads_pilot_actions (dedupe_key) WHERE status IN ('proposee','acceptee','en_approbation');
CREATE TRIGGER trg_pilot_actions_updated BEFORE UPDATE ON public.google_ads_pilot_actions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.google_ads_publish_actions ALTER COLUMN draft_id DROP NOT NULL;
ALTER TABLE public.google_ads_publish_actions ADD COLUMN pilot_action_id uuid REFERENCES public.google_ads_pilot_actions(id);