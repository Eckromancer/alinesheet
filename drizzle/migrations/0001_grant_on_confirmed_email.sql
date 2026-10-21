CREATE OR REPLACE FUNCTION public.apply_access_grant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g public.access_grants;
BEGIN
  IF NEW.email_confirmed_at IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO g FROM public.access_grants WHERE email = lower(NEW.email);
  IF FOUND THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, g.role) ON CONFLICT DO NOTHING;
    IF g.role = 'dsa' THEN
      INSERT INTO public.dsa_identity (user_id, reviewer, store) VALUES (NEW.id, g.reviewer, g.store)
      ON CONFLICT (user_id) DO UPDATE SET reviewer = EXCLUDED.reviewer, store = EXCLUDED.store;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_confirmed_apply_grant
AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
EXECUTE FUNCTION public.apply_access_grant();