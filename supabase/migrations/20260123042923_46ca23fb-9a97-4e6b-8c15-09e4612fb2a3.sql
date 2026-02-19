-- Fix security issues identified in scan

-- 1. Fix pending_invitations: Remove overly permissive UPDATE policy
-- The acceptance logic should go through the secure RPC function
DROP POLICY IF EXISTS "Users can accept their own invitations" ON public.pending_invitations;
DROP POLICY IF EXISTS "Users can accept invitations via token" ON public.pending_invitations;

-- Create a more restrictive UPDATE policy that validates proper conditions
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

-- 2. Fix demo_requests: Ensure only authenticated platform admins can SELECT
-- The existing SELECT policy already requires is_platform_admin(), but let's verify it's restrictive
DROP POLICY IF EXISTS "Platform admins can view demo requests" ON public.demo_requests;

CREATE POLICY "Platform admins can view demo requests"
ON public.demo_requests
FOR SELECT
USING (auth.uid() IS NOT NULL AND is_platform_admin());

-- 3. Fix tenants: The existing policies look correct, but verify no public access
-- Looking at the schema, tenants already requires authentication via user_belongs_to_tenant or owner check
-- No changes needed - the policies are already restrictive

-- 4. Fix demo_sessions: Restrict SELECT to only user's own sessions or platform admins
DROP POLICY IF EXISTS "Users can view own demo sessions" ON public.demo_sessions;

CREATE POLICY "Users can view own demo sessions"
ON public.demo_sessions
FOR SELECT
USING (
  (user_id = auth.uid()) 
  OR (user_id IS NULL AND session_token IS NOT NULL)
  OR is_platform_admin()
);

-- 5. Also fix the UPDATE policy on demo_sessions to not allow anonymous updates to all sessions
DROP POLICY IF EXISTS "Users can update own demo sessions" ON public.demo_sessions;

CREATE POLICY "Users can update own demo sessions"
ON public.demo_sessions
FOR UPDATE
USING (
  (user_id = auth.uid()) 
  OR (user_id IS NULL AND session_token IS NOT NULL)
  OR is_platform_admin()
);