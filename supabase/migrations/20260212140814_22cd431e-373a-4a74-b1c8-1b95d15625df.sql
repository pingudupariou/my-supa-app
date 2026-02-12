
CREATE TABLE public.pricing_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  config_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- One config per user
CREATE UNIQUE INDEX idx_pricing_config_user ON public.pricing_config(user_id);

-- Enable RLS
ALTER TABLE public.pricing_config ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read all configs (shared model)
CREATE POLICY "Authenticated users can view pricing configs"
ON public.pricing_config FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Only owner can insert
CREATE POLICY "Users can insert their own pricing config"
ON public.pricing_config FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Only owner can update
CREATE POLICY "Users can update their own pricing config"
ON public.pricing_config FOR UPDATE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_pricing_config_updated_at
BEFORE UPDATE ON public.pricing_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
