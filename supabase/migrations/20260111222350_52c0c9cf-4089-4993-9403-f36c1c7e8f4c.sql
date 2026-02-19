-- Fix security linter findings introduced/flagged after latest migration

-- 1) rate_limits has RLS enabled but no policies: deny all client access explicitly
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'rate_limits'
  ) THEN
    -- Ensure RLS is enabled (should already be)
    EXECUTE 'ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY';

    -- Create a deny-all policy to satisfy linter and prevent direct client access
    EXECUTE 'DROP POLICY IF EXISTS "Deny all access" ON public.rate_limits';
    EXECUTE 'CREATE POLICY "Deny all access" ON public.rate_limits FOR ALL TO public USING (false) WITH CHECK (false)';
  END IF;
END
$$;

-- 2) demo_sessions INSERT policy has WITH CHECK (true): tighten it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'demo_sessions'
      AND policyname = 'Anyone can create demo sessions'
  ) THEN
    EXECUTE 'DROP POLICY "Anyone can create demo sessions" ON public.demo_sessions';
  END IF;
END
$$;

CREATE POLICY "Anyone can create demo sessions"
ON public.demo_sessions
FOR INSERT
TO public
WITH CHECK (
  session_token IS NOT NULL
  AND (
    user_id IS NULL
    OR user_id = auth.uid()
  )
);
