ALTER TABLE public.access_grants ADD COLUMN active boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.access_grants.active IS 'Owner must explicitly approve before a signup receives a role. Buyer sign-off gates DSA activation.';

CREATE OR REPLACE FUNCTION public.apply_access_grant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g public.access_grants;
BEGIN
  IF NEW.email_confirmed_at IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO g FROM public.access_grants WHERE email = lower(NEW.email) AND active;
  IF FOUND THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, g.role) ON CONFLICT DO NOTHING;
    IF g.role = 'dsa' THEN
      INSERT INTO public.dsa_identity (user_id, reviewer, store) VALUES (NEW.id, g.reviewer, g.store)
      ON CONFLICT (user_id) DO UPDATE SET reviewer = EXCLUDED.reviewer, store = EXCLUDED.store;
    END IF;
  END IF;
  RETURN NEW;
END $$;