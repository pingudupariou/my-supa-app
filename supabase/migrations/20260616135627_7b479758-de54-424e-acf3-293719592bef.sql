CREATE TABLE IF NOT EXISTS public.user_approval_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL,
  target_email text,
  action text NOT NULL CHECK (action IN ('signup','approved','revoked','deleted','role_changed')),
  performed_by uuid,
  performed_by_email text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.user_approval_history TO authenticated;
GRANT ALL ON public.user_approval_history TO service_role;

ALTER TABLE public.user_approval_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read approval history"
  ON public.user_approval_history FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_user_approval_history_target ON public.user_approval_history(target_user_id, created_at DESC);

-- Log signup automatically via trigger on user_roles INSERT
CREATE OR REPLACE FUNCTION public.log_user_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_approval_history (target_user_id, action, details)
  VALUES (NEW.user_id, 'signup', jsonb_build_object('initial_role', NEW.role));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_roles_log_signup ON public.user_roles;
CREATE TRIGGER user_roles_log_signup
  AFTER INSERT ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.log_user_signup();

REVOKE EXECUTE ON FUNCTION public.log_user_signup() FROM anon, authenticated, public;