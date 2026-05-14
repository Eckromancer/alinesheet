
-- Enums
CREATE TYPE public.decision_status AS ENUM ('green','yellow','red');
CREATE TYPE public.submission_status AS ENUM ('draft','submitted');

-- Products (catalog)
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  style_number TEXT NOT NULL,
  long_style_desc TEXT NOT NULL,
  color TEXT NOT NULL,
  retail_price NUMERIC(10,2),
  image_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX products_sort_idx ON public.products (sort_order, style_number);

-- Reviews (one per product/reviewer/store)
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  reviewer TEXT NOT NULL,
  store TEXT NOT NULL DEFAULT '19-Michigan Ave',
  decision_status public.decision_status,
  requested_bulk_units INTEGER,
  notes TEXT,
  submission_status public.submission_status NOT NULL DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, reviewer, store)
);
CREATE INDEX reviews_reviewer_idx ON public.reviews (reviewer, store);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER reviews_touch_updated_at
BEFORE UPDATE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Lock submitted reviews from further edits (allow read)
CREATE OR REPLACE FUNCTION public.prevent_submitted_edits()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.submission_status = 'submitted' AND NEW.submission_status = 'submitted' THEN
    RAISE EXCEPTION 'Review is locked after submission';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER reviews_lock_submitted
BEFORE UPDATE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.prevent_submitted_edits();

-- RLS: open access (internal prototype, no auth)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_all_read"  ON public.products FOR SELECT USING (true);
CREATE POLICY "products_all_write" ON public.products FOR INSERT WITH CHECK (true);
CREATE POLICY "products_all_update" ON public.products FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "products_all_delete" ON public.products FOR DELETE USING (true);

CREATE POLICY "reviews_all_read"   ON public.reviews FOR SELECT USING (true);
CREATE POLICY "reviews_all_insert" ON public.reviews FOR INSERT WITH CHECK (true);
CREATE POLICY "reviews_all_update" ON public.reviews FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "reviews_all_delete" ON public.reviews FOR DELETE USING (true);
