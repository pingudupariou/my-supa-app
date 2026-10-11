CREATE TABLE public.marketing_ai_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'diagnosis',
  cache_key text NOT NULL,
  period_from date NOT NULL,
  period_to date NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb NOT NULL,
  model text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX marketing_ai_analyses_key ON public.marketing_ai_analyses(kind, cache_key);
GRANT SELECT ON public.marketing_ai_analyses TO authenticated;
GRANT ALL ON public.marketing_ai_analyses TO service_role;
ALTER TABLE public.marketing_ai_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Marketing readers can view AI analyses" ON public.marketing_ai_analyses
FOR SELECT TO authenticated USING (public.current_user_marketing_access() IN ('read','write'));
CREATE TRIGGER update_marketing_ai_analyses_updated_at BEFORE UPDATE ON public.marketing_ai_analyses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();