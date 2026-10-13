CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
    AND (auth.uid() IS NULL OR _user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.user_roles a WHERE a.user_id = auth.uid() AND a.role = 'admin' AND a.approved))
$$;
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid) RETURNS app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id
    AND (auth.uid() IS NULL OR _user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.user_roles a WHERE a.user_id = auth.uid() AND a.role = 'admin' AND a.approved))
  LIMIT 1
$$;
CREATE OR REPLACE FUNCTION public.is_user_approved(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT approved FROM public.user_roles WHERE user_id = _user_id
    AND (auth.uid() IS NULL OR _user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.user_roles a WHERE a.user_id = auth.uid() AND a.role = 'admin' AND a.approved))
    LIMIT 1), false)
$$;

CREATE TABLE public.google_ads_publish_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL REFERENCES public.google_ads_campaign_drafts(id) ON DELETE RESTRICT,
  draft_snapshot jsonb NOT NULL,
  action_kind text NOT NULL,
  summary text NOT NULL,
  operations jsonb NOT NULL,
  status text NOT NULL DEFAULT 'prevue',
  preflight jsonb,
  requested_by uuid NOT NULL,
  approved_by uuid,
  approved_at timestamptz,
  executed_at timestamptz,
  google_response jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.google_ads_publish_actions TO authenticated;
GRANT ALL ON public.google_ads_publish_actions TO service_role;
ALTER TABLE public.google_ads_publish_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Marketing readers view publish log" ON public.google_ads_publish_actions FOR SELECT TO authenticated USING (public.current_user_marketing_access() IN ('read','write'));
CREATE TRIGGER trg_gads_publish_updated BEFORE UPDATE ON public.google_ads_publish_actions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX ON public.google_ads_publish_actions (draft_id, created_at DESC);