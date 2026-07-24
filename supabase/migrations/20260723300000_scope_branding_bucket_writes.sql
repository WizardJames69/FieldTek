-- ============================================================
-- Week 0 security batch C3 (founder-approved 2026-07-22)
-- branding bucket: tenant-folder-scope all writes
-- ============================================================
-- The branding bucket's write policies (20260107062548) checked only
-- is_tenant_admin() with no path constraint — an admin of ANY tenant
-- could upload/overwrite/delete ANY other tenant's logo or favicon
-- (e.g. storage.from('branding').upload('<other-tenant-id>/logo.png')).
-- The frontend already namespaces uploads under ${tenant.id}/
-- (BrandingSettings.tsx), so binding the policies to the caller's
-- tenant folder — the job-evidence pattern (20260420000000) — breaks
-- nothing legitimate.
--
-- The public SELECT policy ("Anyone can view branding assets") is
-- deliberately kept: the bucket is public by design — logos render in
-- the customer portal and in emails.
-- ============================================================

DROP POLICY IF EXISTS "Admins can upload branding" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update branding" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete branding" ON storage.objects;

CREATE POLICY "Admins can upload branding"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'branding'
  AND is_tenant_admin()
  AND (storage.foldername(name))[1] = get_user_tenant_id()::text
);

CREATE POLICY "Admins can update branding"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'branding'
  AND is_tenant_admin()
  AND (storage.foldername(name))[1] = get_user_tenant_id()::text
);

CREATE POLICY "Admins can delete branding"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'branding'
  AND is_tenant_admin()
  AND (storage.foldername(name))[1] = get_user_tenant_id()::text
);
