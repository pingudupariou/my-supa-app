ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT false;

-- Auto-approve existing users so we don't lock anyone out
UPDATE public.user_roles SET approved = true WHERE approved = false;

-- Update handle_new_user trigger: new users are NOT approved by default
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_roles (user_id, role, approved) VALUES (NEW.id, 'lecteur', false);
  RETURN NEW;
END;
$function$;

-- Helper function to check approval (security definer to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_user_approved(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE((SELECT approved FROM public.user_roles WHERE user_id = _user_id LIMIT 1), false)
$$;