-- Add receipt_url column to job_parts
ALTER TABLE public.job_parts ADD COLUMN receipt_url TEXT;

-- Create storage bucket for part receipts
INSERT INTO storage.buckets (id, name, public)
VALUES ('part-receipts', 'part-receipts', false);

-- Storage policies for part receipts
CREATE POLICY "Users can view part receipts in their tenant"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'part-receipts' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can upload part receipts"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'part-receipts' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can delete their own receipts"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'part-receipts' 
  AND auth.uid() IS NOT NULL
);