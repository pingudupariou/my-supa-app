CREATE TABLE public.pipe_channel_rules (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
 field text NOT NULL CHECK (field IN ('label','customer','customer_id','sku','product')),
 operator text NOT NULL CHECK (operator IN ('contains','equals','starts_with')),
 value text NOT NULL CHECK (length(trim(value)) BETWEEN 1 AND 200),
 channel text NOT NULL CHECK (channel IN ('b2c','b2b','oem')),
 priority integer NOT NULL DEFAULT 100 CHECK (priority BETWEEN 1 AND 9999),
 enabled boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pipe_channel_rules TO authenticated;
GRANT ALL ON public.pipe_channel_rules TO service_role;
ALTER TABLE public.pipe_channel_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY pipe_rules_read ON public.pipe_channel_rules FOR SELECT TO authenticated USING (public.current_user_tab_access('pipe-commercial') IN ('read','write'));
CREATE POLICY pipe_rules_insert ON public.pipe_channel_rules FOR INSERT TO authenticated WITH CHECK (public.current_user_tab_access('pipe-commercial') = 'write');
CREATE POLICY pipe_rules_update ON public.pipe_channel_rules FOR UPDATE TO authenticated USING (public.current_user_tab_access('pipe-commercial') = 'write') WITH CHECK (public.current_user_tab_access('pipe-commercial') = 'write');
CREATE POLICY pipe_rules_delete ON public.pipe_channel_rules FOR DELETE TO authenticated USING (public.current_user_tab_access('pipe-commercial') = 'write');
CREATE TRIGGER pipe_rules_updated BEFORE UPDATE ON public.pipe_channel_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();