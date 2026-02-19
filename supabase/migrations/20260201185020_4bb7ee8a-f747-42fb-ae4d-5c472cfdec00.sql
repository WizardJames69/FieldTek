-- Drop the duplicate policy first, then recreate properly
DROP POLICY IF EXISTS "Platform admins can view all feedback screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own feedback screenshots" ON storage.objects;

-- Recreate with proper combined logic
CREATE POLICY "Users and admins can view feedback screenshots"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'feedback-screenshots'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_platform_admin()
  )
);