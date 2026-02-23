-- ============================================================
-- Fix search_document_chunks() tenant validation for service_role context
-- ============================================================
-- The previous check `IF p_tenant_id != get_user_tenant_id()` is inert when
-- called via service_role because auth.uid() returns NULL, making the comparison
-- evaluate to NULL (not TRUE), so the exception is never raised.
--
-- This fix:
-- 1. Rejects NULL p_tenant_id (prevents accidental unfiltered queries)
-- 2. Skips tenant ownership check for service_role (it bypasses RLS anyway)
-- 3. Enforces tenant ownership check for authenticated users (anon key + JWT)

CREATE OR REPLACE FUNCTION public.search_document_chunks(
  p_tenant_id uuid,
  p_query_embedding extensions.vector,
  p_match_count integer DEFAULT 10,
  p_match_threshold double precision DEFAULT 0.5
)
RETURNS TABLE(
  id uuid,
  document_id uuid,
  chunk_text text,
  document_name text,
  document_category text,
  similarity double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Reject NULL tenant_id to prevent accidentally returning all tenants' data
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id cannot be NULL';
  END IF;

  -- For non-service-role callers, verify tenant ownership
  IF current_setting('role', true) != 'service_role' THEN
    IF p_tenant_id != get_user_tenant_id() THEN
      RAISE EXCEPTION 'Access denied: User does not belong to the requested tenant';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.chunk_text,
    d.name AS document_name,
    d.category AS document_category,
    1 - (dc.embedding <=> p_query_embedding) AS similarity
  FROM public.document_chunks dc
  JOIN public.documents d ON d.id = dc.document_id
  WHERE dc.tenant_id = p_tenant_id
    AND dc.embedding IS NOT NULL
    AND (1 - (dc.embedding <=> p_query_embedding)) > p_match_threshold
  ORDER BY dc.embedding <=> p_query_embedding
  LIMIT p_match_count;
END;
$$;


-- Drop no-op "Deny anonymous" permissive policies
-- These policies use USING(false) but are permissive (not RESTRICTIVE),
-- so PostgreSQL ORs them with other permissive policies, making them inert.
-- Anonymous access is already blocked by the tenant-filtering policies
-- returning NULL/false when auth.uid() is NULL.
DROP POLICY IF EXISTS "Deny anonymous access to document_chunks" ON public.document_chunks;
DROP POLICY IF EXISTS "Deny anonymous access to ai_audit_logs" ON public.ai_audit_logs;
