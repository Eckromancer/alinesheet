ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS selected_sizes integer[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS special_order_notes text;