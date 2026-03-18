
-- Junction table: which clients belong to which business entity
CREATE TABLE public.crm_entity_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_entity_id uuid NOT NULL REFERENCES public.crm_business_entities(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.b2b_clients(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  UNIQUE(business_entity_id, client_id)
);

ALTER TABLE public.crm_entity_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read crm_entity_clients"
  ON public.crm_entity_clients FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can manage their own crm_entity_clients"
  ON public.crm_entity_clients FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
