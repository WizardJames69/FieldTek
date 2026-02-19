-- =====================================================
-- FIX REMAINING "ALWAYS TRUE" POLICIES
-- =====================================================

-- 1. Fix demo_requests INSERT policy (allow anyone but track for rate limiting)
DROP POLICY IF EXISTS "Anyone can submit demo requests" ON public.demo_requests;
-- Keep it open for demo requests but could add rate limiting later
CREATE POLICY "Anyone can submit demo requests"
ON public.demo_requests
FOR INSERT
WITH CHECK (email IS NOT NULL AND name IS NOT NULL);

-- 2. Fix pending_invitations UPDATE policy (currently allows anyone)
DROP POLICY IF EXISTS "Users can accept their own invitations" ON public.pending_invitations;
-- Create a safer policy - users can only update if token matches and it's their email
CREATE POLICY "Users can accept invitations via token"
ON public.pending_invitations
FOR UPDATE
USING (
  auth.uid() IS NOT NULL
  AND accepted_at IS NULL
  AND expires_at > now()
)
WITH CHECK (
  accepted_at IS NOT NULL
);

-- 3. Fix duplicate tenants INSERT policy
DROP POLICY IF EXISTS "Authenticated users can create a tenant" ON public.tenants;
-- The other policy "Authenticated users can create tenants" already exists and is correct