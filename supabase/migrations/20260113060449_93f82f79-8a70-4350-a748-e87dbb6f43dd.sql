-- Drop overly permissive policies
DROP POLICY IF EXISTS "Anyone can update demo sandbox sessions by token" ON public.demo_sandbox_sessions;
DROP POLICY IF EXISTS "Anyone can read demo sandbox sessions" ON public.demo_sandbox_sessions;

-- More restrictive update policy - only non-expired sessions
CREATE POLICY "Update demo sandbox sessions by valid token"
ON public.demo_sandbox_sessions
FOR UPDATE
USING (expires_at > now());

-- More restrictive select policy - only non-expired sessions
CREATE POLICY "Read non-expired demo sandbox sessions"
ON public.demo_sandbox_sessions
FOR SELECT
USING (expires_at > now());