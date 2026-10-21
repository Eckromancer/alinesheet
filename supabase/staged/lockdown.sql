-- STAGED — NOT APPLIED. Run only after every active DSA and buyer has a confirmed,
-- approved account (access_grants filled, users signed up) and AUTH_REQUIRED = true
-- in src/lib/auth.ts is shipped in the same release.
-- Removes anonymous read/write of reviews; signed-in scoped policies
-- (reviews_auth_select / _insert / _update_drafts) remain.

DROP POLICY IF EXISTS reviews_all_read ON public.reviews;
DROP POLICY IF EXISTS reviews_all_insert ON public.reviews;
DROP POLICY IF EXISTS reviews_update_drafts_only ON public.reviews;
REVOKE ALL ON public.reviews FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
