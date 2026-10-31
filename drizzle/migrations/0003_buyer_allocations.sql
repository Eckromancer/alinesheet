CREATE TABLE public.buyer_allocations (
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  store text NOT NULL,
  season text,
  approved_units integer CHECK (approved_units IS NULL OR approved_units >= 0),
  sizes jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, store)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.buyer_allocations TO authenticated;
GRANT ALL ON public.buyer_allocations TO service_role;
ALTER TABLE public.buyer_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY buyer_alloc_select ON public.buyer_allocations FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'buyer'));
CREATE POLICY buyer_alloc_insert ON public.buyer_allocations FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'buyer'));
CREATE POLICY buyer_alloc_update ON public.buyer_allocations FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'buyer')) WITH CHECK (public.has_role(auth.uid(), 'buyer'));
CREATE POLICY buyer_alloc_delete ON public.buyer_allocations FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'buyer'));
CREATE TRIGGER buyer_alloc_touch BEFORE UPDATE ON public.buyer_allocations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();