-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Create document_chunks table to store document text chunks with embeddings
-- This allows efficient semantic search across large documentation libraries
CREATE TABLE public.document_chunks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  embedding vector(1536), -- OpenAI-compatible embedding dimension
  token_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for vector similarity search (cosine distance)
CREATE INDEX idx_document_chunks_embedding ON public.document_chunks 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Create index for efficient filtering by tenant
CREATE INDEX idx_document_chunks_tenant ON public.document_chunks(tenant_id);

-- Create index for filtering by document
CREATE INDEX idx_document_chunks_document ON public.document_chunks(document_id);

-- Create composite index for common query pattern
CREATE INDEX idx_document_chunks_tenant_document ON public.document_chunks(tenant_id, document_id);

-- Enable Row Level Security
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see chunks from their tenant
CREATE POLICY "Deny anonymous access to document_chunks"
ON public.document_chunks FOR SELECT
USING (false);

CREATE POLICY "Users can view document chunks in their tenant"
ON public.document_chunks FOR SELECT
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Service role can manage document chunks"
ON public.document_chunks FOR ALL
USING (true)
WITH CHECK (true);

-- Add embedding_status column to documents table to track chunking/embedding progress
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS embedding_status TEXT DEFAULT 'pending';

-- Add index for filtering documents by embedding status
CREATE INDEX IF NOT EXISTS idx_documents_embedding_status ON public.documents(embedding_status);

-- Comment on new structures
COMMENT ON TABLE public.document_chunks IS 'Stores document text chunks with vector embeddings for semantic search';
COMMENT ON COLUMN public.document_chunks.embedding IS '1536-dimensional vector embedding for semantic similarity search';
COMMENT ON COLUMN public.document_chunks.chunk_index IS 'Position of this chunk within the source document';
COMMENT ON COLUMN public.documents.embedding_status IS 'Status of vector embedding generation: pending, processing, completed, failed';

-- Create function to search documents by similarity
CREATE OR REPLACE FUNCTION public.search_document_chunks(
  p_tenant_id UUID,
  p_query_embedding vector(1536),
  p_match_count INTEGER DEFAULT 10,
  p_match_threshold FLOAT DEFAULT 0.5
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  chunk_text TEXT,
  document_name TEXT,
  document_category TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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