-- ============================================================
-- PR-SEC-2 — Pre-beta RLS/policy hardening (2 fixes)
-- ============================================================
--
-- Fix 1: `documents` storage bucket SELECT must mirror the public.documents
--        table ACL. Today ANY active tenant member can read (and sign URLs
--        for) EVERY object in their tenant's folder, while the table policy
--        ("Users can view documents in their tenant", 20260107061503) only
--        exposes rows that are public, admin-visible, or self-uploaded. A
--        technician can therefore download an admin-only document directly
--        from storage even though the Documents UI hides it.
--
-- Fix 2: public.service_requests INSERT currently has TWO permissive policies
--        that each allow an anonymous (anon-key) caller to insert into ANY
--        existing tenant: "Service requests require valid tenant"
--        (20260107061503, tenant-exists only) and "Users can create service
--        requests" (20260108035951, has an explicit `auth.uid() IS NULL` arm).
--        Public intake is supposed to flow through the verify-turnstile /
--        verify-turnstile-portal edge functions (CAPTCHA + rate limiting,
--        service role — RLS-bypassing), so direct anon INSERT is pure spam /
--        cross-tenant-injection surface. No frontend code inserts directly.
--
-- Scope: exactly the two SELECT policies on the documents bucket and the two
-- INSERT policies on service_requests. No other bucket, table, or policy is
-- touched. No schema changes. Service-role/edge-function processing is
-- unaffected (service role bypasses RLS).
--
-- Regression script: supabase/tests/pr_sec2_policies_regression.sql
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- Fix 1: documents bucket SELECT mirrors public.documents ACL
-- ────────────────────────────────────────────────────────────
-- Replaces both legacy folder-wide SELECT policies:
--   "Tenant members can view documents"     (20251225011230)
--   "Tenant users can read their documents" (20251226185815)
DROP POLICY IF EXISTS "Tenant members can view documents" ON storage.objects;
DROP POLICY IF EXISTS "Tenant users can read their documents" ON storage.objects;

-- Access requires BOTH:
--   (a) the object lives in the caller's own tenant folder (defense in depth —
--       cross-tenant listing stays impossible even if a documents row is
--       malformed), AND
--   (b) a public.documents row in the caller's tenant references this object
--       and grants access under the same rules as the table SELECT policy:
--       is_public OR tenant admin/owner OR uploader.
--
-- documents.file_url stores either the bare object path (current uploads:
-- "<tenant_id>/<ts>-<uuid>.<ext>") or a legacy full public URL
-- ("https://<host>/storage/v1/object/public/documents/<path>") — matched by
-- exact string or exact URL suffix (no LIKE, so no wildcard-injection via
-- attacker-chosen file extensions).
--
-- Objects with no matching documents row (e.g. orphans from a failed upload)
-- become invisible to all users; internal processing uses the service role
-- and is unaffected.
CREATE POLICY "Document files follow documents table access"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = public.get_user_tenant_id()::text
  AND EXISTS (
    SELECT 1
    FROM public.documents d
    WHERE d.tenant_id = public.get_user_tenant_id()
      AND (
        d.file_url = objects.name
        OR right(
             d.file_url,
             length('/storage/v1/object/public/documents/' || objects.name)
           ) = '/storage/v1/object/public/documents/' || objects.name
      )
      AND (
        d.is_public = true
        OR public.is_tenant_admin()
        OR d.uploaded_by = auth.uid()
      )
  )
);


-- ────────────────────────────────────────────────────────────
-- Fix 2: service_requests INSERT — no direct anonymous inserts
-- ────────────────────────────────────────────────────────────
-- Replaces both permissive INSERT policies with a single authenticated-only
-- policy. Anonymous public intake keeps working exclusively through the
-- verify-turnstile edge function (service role bypasses RLS); with no INSERT
-- policy granted to anon, direct anon-key inserts are denied by default.
DROP POLICY IF EXISTS "Service requests require valid tenant" ON public.service_requests;
DROP POLICY IF EXISTS "Users can create service requests" ON public.service_requests;

-- Allowed authenticated inserts (both same-tenant by construction):
--   (a) active staff members of the target tenant, or
--   (b) portal clients creating a request against their own client record in
--       that tenant (preserves the intended portal arm of 20260108035951;
--       c.tenant_id = tenant_id keeps it cross-tenant-safe).
CREATE POLICY "Members and own portal clients can create service requests"
ON public.service_requests
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    public.user_belongs_to_tenant(tenant_id)
    OR EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = service_requests.client_id
        AND c.tenant_id = service_requests.tenant_id
        AND c.user_id = auth.uid()
    )
  )
);
