-- Fix remaining critical security gaps

-- Drop the overly permissive demo_sessions policies
DROP POLICY IF EXISTS "Users can view own demo sessions" ON public.demo_sessions;
DROP POLICY IF EXISTS "Users can update own demo sessions" ON public.demo_sessions;

-- Create more restrictive demo_sessions policies
CREATE POLICY "Session owners can view their sessions"
  ON public.demo_sessions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR is_platform_admin());

CREATE POLICY "Anon users can view by exact token match"
  ON public.demo_sessions FOR SELECT
  TO anon
  USING (false);

CREATE POLICY "Session owners can update their sessions"
  ON public.demo_sessions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR is_platform_admin());

CREATE POLICY "Anon cannot update demo sessions"
  ON public.demo_sessions FOR UPDATE
  TO anon
  USING (false);

-- Drop the overly permissive demo_sandbox_sessions policies
DROP POLICY IF EXISTS "Read non-expired demo sandbox sessions" ON public.demo_sandbox_sessions;
DROP POLICY IF EXISTS "Update demo sandbox sessions by valid token" ON public.demo_sandbox_sessions;
DROP POLICY IF EXISTS "Deny anonymous access to demo_sandbox_sessions" ON public.demo_sandbox_sessions;

-- Create restrictive demo_sandbox_sessions policies (platform admins only for SELECT)
CREATE POLICY "Only platform admins can view sandbox sessions"
  ON public.demo_sandbox_sessions FOR SELECT
  TO authenticated
  USING (is_platform_admin());

CREATE POLICY "Anon cannot view sandbox sessions"
  ON public.demo_sandbox_sessions FOR SELECT
  TO anon
  USING (false);

CREATE POLICY "Only platform admins can update sandbox sessions"
  ON public.demo_sandbox_sessions FOR UPDATE
  TO authenticated
  USING (is_platform_admin());

CREATE POLICY "Anon cannot update sandbox sessions"
  ON public.demo_sandbox_sessions FOR UPDATE
  TO anon
  USING (false);

-- Add explicit deny for regular authenticated users on demo_requests
DROP POLICY IF EXISTS "Deny anonymous access to demo_requests" ON public.demo_requests;

CREATE POLICY "Only platform admins can read demo requests"
  ON public.demo_requests FOR SELECT
  TO authenticated
  USING (is_platform_admin());

CREATE POLICY "Anon cannot read demo requests"
  ON public.demo_requests FOR SELECT
  TO anon
  USING (false);

-- Add explicit deny for regular authenticated users on waitlist_signups  
DROP POLICY IF EXISTS "Deny anonymous access to waitlist_signups" ON public.waitlist_signups;

CREATE POLICY "Only platform admins can read waitlist"
  ON public.waitlist_signups FOR SELECT
  TO authenticated
  USING (is_platform_admin());

CREATE POLICY "Anon cannot read waitlist"
  ON public.waitlist_signups FOR SELECT
  TO anon
  USING (false);