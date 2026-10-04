CREATE TABLE public.erplain_schema_cache (
  type_name text PRIMARY KEY,
  data jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.erplain_schema_cache TO service_role;
ALTER TABLE public.erplain_schema_cache ENABLE ROW LEVEL SECURITY;