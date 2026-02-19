-- Add columns for document text extraction
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS extracted_text TEXT,
ADD COLUMN IF NOT EXISTS extraction_status TEXT DEFAULT 'pending';

-- Add index for efficient querying by extraction status
CREATE INDEX IF NOT EXISTS idx_documents_extraction_status ON public.documents(extraction_status);

-- Comment explaining the columns
COMMENT ON COLUMN public.documents.extracted_text IS 'AI-extracted text content from the document for grounding the field assistant';
COMMENT ON COLUMN public.documents.extraction_status IS 'Status of text extraction: pending, processing, completed, failed';