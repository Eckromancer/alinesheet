CREATE TYPE public.app_role AS ENUM ('buyer', 'dsa');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_roles_read_own ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

-- One DSA account maps to the reviewer/store pair already stamped on existing reviews,
-- so historical submissions keep their owner with no data rewrite.
CREATE TABLE public.dsa_identity (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewer text NOT NULL,
  store text NOT NULL
);
GRANT SELECT ON public.dsa_identity TO authenticated;
GRANT ALL ON public.dsa_identity TO service_role;
ALTER TABLE public.dsa_identity ENABLE ROW LEVEL SECURITY;
CREATE POLICY dsa_identity_read_own ON public.dsa_identity FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Approved-email allowlist. Only the owner (via service role / admin SQL) can see or change it.
CREATE TABLE public.access_grants (
  email text PRIMARY KEY,
  role public.app_role NOT NULL,
  reviewer text,
  store text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT access_grants_email_lower CHECK (email = lower(email)),
  CONSTRAINT access_grants_dsa_fields CHECK (role <> 'dsa' OR (reviewer IS NOT NULL AND store IS NOT NULL))
);
GRANT ALL ON public.access_grants TO service_role;
ALTER TABLE public.access_grants ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.can_access_review(_reviewer text, _store text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.has_role(auth.uid(), 'buyer')
    OR EXISTS (SELECT 1 FROM public.dsa_identity d
               WHERE d.user_id = auth.uid() AND d.reviewer = _reviewer AND d.store = _store)
  )
$$;

CREATE OR REPLACE FUNCTION public.apply_access_grant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g public.access_grants;
BEGIN
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

CREATE TRIGGER on_auth_user_created_apply_grant
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.apply_access_grant();

-- Additive, scoped policies for signed-in users. The existing open policies stay in place
-- until the staged lockdown runs, so active DSAs are not locked out.
CREATE POLICY reviews_auth_select ON public.reviews FOR SELECT TO authenticated
  USING (public.can_access_review(reviewer, store));
CREATE POLICY reviews_auth_insert ON public.reviews FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'dsa') AND public.can_access_review(reviewer, store));
CREATE POLICY reviews_auth_update_drafts ON public.reviews FOR UPDATE TO authenticated
  USING (submission_status = 'draft' AND public.has_role(auth.uid(), 'dsa') AND public.can_access_review(reviewer, store))
  WITH CHECK (public.has_role(auth.uid(), 'dsa') AND public.can_access_review(reviewer, store));

-- Buyers only may mark processed.
CREATE OR REPLACE FUNCTION public.mark_review_processed(_review_id uuid, _value boolean)
RETURNS public.reviews LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r public.reviews;
BEGIN
  IF NOT public.has_role(auth.uid(), 'buyer') THEN
    RAISE EXCEPTION 'Buyer access required';
  END IF;
  UPDATE public.reviews SET processed = _value,
         processed_at = CASE WHEN _value THEN now() ELSE NULL END
   WHERE id = _review_id RETURNING * INTO r;
  RETURN r;
END $$;
REVOKE EXECUTE ON FUNCTION public.mark_review_processed(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_review_processed(uuid, boolean) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.apply_access_grant() FROM PUBLIC, anon, authenticated;