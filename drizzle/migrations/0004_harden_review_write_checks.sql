DROP POLICY IF EXISTS reviews_all_insert ON public.reviews;
DROP POLICY IF EXISTS reviews_update_drafts_only ON public.reviews;

CREATE POLICY reviews_all_insert ON public.reviews FOR INSERT TO public
WITH CHECK (
  submission_status = 'draft'::submission_status
  AND processed = false
  AND length(btrim(reviewer)) BETWEEN 1 AND 120
  AND length(btrim(store)) BETWEEN 1 AND 120
  AND (requested_bulk_units IS NULL OR requested_bulk_units BETWEEN 0 AND 10)
  AND (notes IS NULL OR length(notes) <= 2000)
  AND (special_order_notes IS NULL OR length(special_order_notes) <= 2000)
  AND selected_sizes <@ ARRAY[2,4,6,8,10,12,14,16]
  AND EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id)
);

CREATE POLICY reviews_update_drafts_only ON public.reviews FOR UPDATE TO public
USING (submission_status = 'draft'::submission_status)
WITH CHECK (
  processed = false
  AND length(btrim(reviewer)) BETWEEN 1 AND 120
  AND length(btrim(store)) BETWEEN 1 AND 120
  AND (requested_bulk_units IS NULL OR requested_bulk_units BETWEEN 0 AND 10)
  AND (notes IS NULL OR length(notes) <= 2000)
  AND (special_order_notes IS NULL OR length(special_order_notes) <= 2000)
  AND selected_sizes <@ ARRAY[2,4,6,8,10,12,14,16]
  AND EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id)
);