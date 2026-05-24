-- Tighten reviews UPDATE: only draft rows can be updated via RLS.
DROP POLICY IF EXISTS reviews_all_update ON public.reviews;

CREATE POLICY reviews_update_drafts_only
ON public.reviews
FOR UPDATE
TO public
USING (submission_status = 'draft')
WITH CHECK (true);

-- Strengthen the existing trigger so submitted rows can ONLY have processed/processed_at changed.
CREATE OR REPLACE FUNCTION public.prevent_submitted_edits()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.submission_status = 'submitted' THEN
    IF NEW.product_id        IS DISTINCT FROM OLD.product_id
    OR NEW.reviewer          IS DISTINCT FROM OLD.reviewer
    OR NEW.store             IS DISTINCT FROM OLD.store
    OR NEW.decision_status   IS DISTINCT FROM OLD.decision_status
    OR NEW.requested_bulk_units IS DISTINCT FROM OLD.requested_bulk_units
    OR NEW.notes             IS DISTINCT FROM OLD.notes
    OR NEW.selected_sizes    IS DISTINCT FROM OLD.selected_sizes
    OR NEW.special_order_notes IS DISTINCT FROM OLD.special_order_notes
    OR NEW.submission_status IS DISTINCT FROM OLD.submission_status
    OR NEW.submitted_at      IS DISTINCT FROM OLD.submitted_at
    THEN
      RAISE EXCEPTION 'Submitted reviews are locked; only processed flag may change';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS prevent_submitted_edits_trg ON public.reviews;
CREATE TRIGGER prevent_submitted_edits_trg
BEFORE UPDATE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.prevent_submitted_edits();

-- Security-definer RPC so the manager UI can still flip processed/processed_at on submitted rows.
CREATE OR REPLACE FUNCTION public.mark_review_processed(_review_id uuid, _value boolean)
RETURNS public.reviews
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  row public.reviews;
BEGIN
  UPDATE public.reviews
     SET processed = _value,
         processed_at = CASE WHEN _value THEN now() ELSE NULL END
   WHERE id = _review_id
   RETURNING * INTO row;
  RETURN row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_review_processed(uuid, boolean) TO anon, authenticated;