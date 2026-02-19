-- Drop the overly permissive service role policy
DROP POLICY IF EXISTS "Service role can manage document chunks" ON public.document_chunks;

-- Note: Service role bypasses RLS by default, so we don't need an explicit policy.
-- The INSERT/UPDATE/DELETE operations will only happen from edge functions using service role.