
-- Table for business entities (dynamic list managed by admin)
CREATE TABLE public.crm_business_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  color text DEFAULT '#6366f1',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NOT NULL
);

ALTER TABLE public.crm_business_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read crm_business_entities"
ON public.crm_business_entities FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage crm_business_entities"
ON public.crm_business_entities FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add business_entity_id to existing CRM tables
ALTER TABLE public.crm_meetings ADD COLUMN business_entity_id uuid REFERENCES public.crm_business_entities(id) ON DELETE SET NULL;
ALTER TABLE public.crm_reminders ADD COLUMN business_entity_id uuid REFERENCES public.crm_business_entities(id) ON DELETE SET NULL;
ALTER TABLE public.customer_interactions ADD COLUMN business_entity_id uuid REFERENCES public.crm_business_entities(id) ON DELETE SET NULL;

-- Indexes for filtering
CREATE INDEX idx_crm_meetings_entity ON public.crm_meetings(business_entity_id);
CREATE INDEX idx_crm_reminders_entity ON public.crm_reminders(business_entity_id);
CREATE INDEX idx_customer_interactions_entity ON public.customer_interactions(business_entity_id);
