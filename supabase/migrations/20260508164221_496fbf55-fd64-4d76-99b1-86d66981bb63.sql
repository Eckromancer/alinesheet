ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS processed boolean NOT NULL DEFAULT false;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS processed_at timestamptz;