CREATE TABLE public.google_ads_campaign_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  campaign_type text NOT NULL DEFAULT 'SHOPPING',
  status text NOT NULL DEFAULT 'brouillon',
  source text NOT NULL DEFAULT 'manuel',
  source_ref jsonb,
  countries text[] NOT NULL DEFAULT '{}',
  languages text[] NOT NULL DEFAULT '{}',
  daily_budget numeric,
  bidding jsonb NOT NULL DEFAULT '{}'::jsonb,
  products jsonb NOT NULL DEFAULT '{}'::jsonb,
  ad_content jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  conflict_check jsonb,
  validated_by uuid,
  validated_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_ads_campaign_drafts TO authenticated;
GRANT ALL ON public.google_ads_campaign_drafts TO service_role;
ALTER TABLE public.google_ads_campaign_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Marketing readers view drafts" ON public.google_ads_campaign_drafts FOR SELECT TO authenticated USING (public.current_user_marketing_access() IN ('read','write'));
CREATE POLICY "Marketing writers create drafts" ON public.google_ads_campaign_drafts FOR INSERT TO authenticated WITH CHECK (public.current_user_marketing_access() = 'write' AND created_by = auth.uid());
CREATE POLICY "Marketing writers update drafts" ON public.google_ads_campaign_drafts FOR UPDATE TO authenticated USING (public.current_user_marketing_access() = 'write') WITH CHECK (public.current_user_marketing_access() = 'write');
CREATE POLICY "Marketing writers delete drafts" ON public.google_ads_campaign_drafts FOR DELETE TO authenticated USING (public.current_user_marketing_access() = 'write');
CREATE TRIGGER trg_gads_drafts_updated BEFORE UPDATE ON public.google_ads_campaign_drafts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();