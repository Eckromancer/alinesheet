DROP POLICY IF EXISTS reviews_all_read ON public.reviews;
DROP POLICY IF EXISTS reviews_all_insert ON public.reviews;
DROP POLICY IF EXISTS reviews_update_drafts_only ON public.reviews;
REVOKE ALL ON public.reviews FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;

DROP POLICY IF EXISTS products_all_read ON public.products;
REVOKE ALL ON public.products FROM anon;
GRANT SELECT ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
CREATE POLICY products_signed_in_read ON public.products FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'buyer') OR public.has_role(auth.uid(), 'dsa'));