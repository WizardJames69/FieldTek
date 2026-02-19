-- Security Migration: Fix critical vulnerabilities
-- 1. Fix search_document_chunks() to validate tenant access
-- 2. Fix part-receipts storage policies for tenant isolation

-- =============================================
-- FIX 1: search_document_chunks() RLS bypass
-- Add tenant validation to prevent cross-tenant access
-- =============================================

CREATE OR REPLACE FUNCTION public.search_document_chunks(
  p_tenant_id uuid, 
  p_query_embedding vector, 
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
  -- SECURITY CHECK: Verify caller belongs to the requested tenant
  IF p_tenant_id != get_user_tenant_id() THEN
    RAISE EXCEPTION 'Access denied: User does not belong to the requested tenant';
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

-- =============================================
-- FIX 2: part-receipts storage policies
-- Add proper tenant isolation using folder path
-- =============================================

-- First, drop the existing insecure policies
DROP POLICY IF EXISTS "Users can view part receipts in their tenant" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload part receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their uploaded receipts" ON storage.objects;

-- Create properly secured policies with tenant isolation
-- Files are stored as: {tenant_id}/{job_id}/{filename}

-- SELECT: Only allow viewing receipts in user's tenant folder
CREATE POLICY "Users can view part receipts in their tenant"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'part-receipts' 
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = get_user_tenant_id()::text
);

-- INSERT: Only allow uploading to user's tenant folder
CREATE POLICY "Users can upload part receipts"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'part-receipts' 
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = get_user_tenant_id()::text
);

-- UPDATE: Only allow updating receipts in user's tenant folder
CREATE POLICY "Users can update part receipts"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'part-receipts' 
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = get_user_tenant_id()::text
);

-- DELETE: Only tenant admins can delete, within their tenant folder
CREATE POLICY "Admins can delete part receipts"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'part-receipts' 
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = get_user_tenant_id()::text
  AND is_tenant_admin()
);