ALTER TABLE public.products ADD COLUMN IF NOT EXISTS season text;
UPDATE public.products SET season = 'Resort 2026' WHERE season IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_season ON public.products(season);