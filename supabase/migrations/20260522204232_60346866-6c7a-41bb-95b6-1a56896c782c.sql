CREATE TABLE public.access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  path text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "access_log_public_insert"
ON public.access_log
FOR INSERT
TO public
WITH CHECK (email IS NOT NULL AND length(email) <= 320);

CREATE INDEX idx_access_log_created_at ON public.access_log (created_at DESC);
CREATE INDEX idx_access_log_email ON public.access_log (email);