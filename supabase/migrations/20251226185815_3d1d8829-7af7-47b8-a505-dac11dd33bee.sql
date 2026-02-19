-- Create storage policies for the documents bucket to allow tenant users to upload files

-- Policy to allow authenticated users to upload to their tenant folder
CREATE POLICY "Tenant users can upload documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents' AND
  (storage.foldername(name))[1] = (SELECT get_user_tenant_id()::text)
);

-- Policy to allow authenticated users to update their tenant's documents
CREATE POLICY "Tenant users can update their documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents' AND
  (storage.foldername(name))[1] = (SELECT get_user_tenant_id()::text)
);

-- Policy to allow authenticated users to read their tenant's documents
CREATE POLICY "Tenant users can read their documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' AND
  (storage.foldername(name))[1] = (SELECT get_user_tenant_id()::text)
);

-- Policy to allow authenticated users to delete their tenant's documents
CREATE POLICY "Tenant users can delete their documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents' AND
  (storage.foldername(name))[1] = (SELECT get_user_tenant_id()::text)
);