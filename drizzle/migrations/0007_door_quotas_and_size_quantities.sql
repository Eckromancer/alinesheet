CREATE TABLE public.door_quotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season text NOT NULL,
  store text NOT NULL,
  door_code text NOT NULL,
  style_number text NOT NULL,
  color text NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  quota integer CHECK (quota IS NULL OR quota BETWEEN 0 AND 100),
  source text,
  updated_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (season, door_code, style_number, color)
);
CREATE UNIQUE INDEX door_quotas_product_store_uq ON public.door_quotas(product_id, store) WHERE product_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.door_quotas TO authenticated;
GRANT ALL ON public.door_quotas TO service_role;
ALTER TABLE public.door_quotas ENABLE ROW LEVEL SECURITY;
CREATE POLICY door_quotas_select ON public.door_quotas FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'buyer')
  OR EXISTS (SELECT 1 FROM public.dsa_identity d WHERE d.user_id = auth.uid() AND d.store = door_quotas.store)
);
CREATE POLICY door_quotas_buyer_insert ON public.door_quotas FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'buyer'));
CREATE POLICY door_quotas_buyer_update ON public.door_quotas FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'buyer')) WITH CHECK (public.has_role(auth.uid(), 'buyer'));
CREATE POLICY door_quotas_buyer_delete ON public.door_quotas FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'buyer'));
CREATE TRIGGER door_quotas_touch BEFORE UPDATE ON public.door_quotas FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.reviews ADD COLUMN size_quantities jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.check_review_size_quantities()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _k text; _v jsonb; _sum integer := 0; _quota integer; _has boolean;
BEGIN
  IF jsonb_typeof(NEW.size_quantities) <> 'object' THEN
    RAISE EXCEPTION 'size_quantities must be an object';
  END IF;
  FOR _k, _v IN SELECT * FROM jsonb_each(NEW.size_quantities) LOOP
    IF _k NOT IN ('2','4','6','8','10','12','14','16') THEN RAISE EXCEPTION 'Invalid size %', _k; END IF;
    IF jsonb_typeof(_v) <> 'number' OR (_v::text)::numeric <> floor((_v::text)::numeric) OR (_v::text)::numeric < 0 THEN
      RAISE EXCEPTION 'Size counts must be whole numbers';
    END IF;
    _sum := _sum + (_v::text)::integer;
  END LOOP;
  SELECT true, q.quota INTO _has, _quota FROM public.door_quotas q WHERE q.product_id = NEW.product_id AND q.store = NEW.store;
  IF coalesce(_has, false) THEN
    IF _quota IS NULL AND _sum > 0 THEN RAISE EXCEPTION 'Buyer allocation missing for this style'; END IF;
    IF _quota IS NOT NULL AND _sum > _quota THEN RAISE EXCEPTION 'Size counts (%) exceed allocation (%)', _sum, _quota; END IF;
    IF NEW.submission_status = 'submitted' AND _quota IS NOT NULL AND _sum <> _quota THEN
      RAISE EXCEPTION 'Size counts (%) must equal allocation (%) before submitting', _sum, _quota;
    END IF;
  ELSIF _sum > 0 THEN
    RAISE EXCEPTION 'No allocation exists for this style and store';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER reviews_check_size_quantities BEFORE INSERT OR UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.check_review_size_quantities();

CREATE OR REPLACE FUNCTION public.prevent_submitted_edits()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
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
    OR NEW.size_quantities   IS DISTINCT FROM OLD.size_quantities
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