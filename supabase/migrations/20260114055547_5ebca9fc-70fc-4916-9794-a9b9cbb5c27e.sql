-- Add file type and size restrictions to part-receipts bucket
UPDATE storage.buckets
SET file_size_limit = 10485760, -- 10MB
    allowed_mime_types = ARRAY[
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic'
    ]
WHERE id = 'part-receipts';