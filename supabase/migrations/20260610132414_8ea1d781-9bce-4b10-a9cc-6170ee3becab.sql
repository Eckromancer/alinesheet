
-- Add explicit deny-all SELECT on access_log to prevent any accidental public read of visitor emails
CREATE POLICY "access_log_deny_select"
ON public.access_log
FOR SELECT
TO public
USING (false);

-- Lock down SECURITY DEFINER function from public/auth execution
REVOKE EXECUTE ON FUNCTION public.mark_review_processed(uuid, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_review_processed(uuid, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_review_processed(uuid, boolean) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.mark_review_processed(uuid, boolean) TO service_role;
