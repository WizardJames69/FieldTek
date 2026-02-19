-- Fix dashboard_stats to validate user belongs to tenant before returning data
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_tenant_id uuid)
RETURNS TABLE(
  total bigint,
  in_progress bigint,
  completed bigint,
  urgent bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify the calling user belongs to the requested tenant
  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = auth.uid()
    AND tenant_id = p_tenant_id
    AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Access denied: User does not belong to the requested tenant';
  END IF;

  -- Return the stats
  RETURN QUERY
  SELECT
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
    COUNT(*) FILTER (WHERE status = 'completed') as completed,
    COUNT(*) FILTER (WHERE priority = 'urgent' AND status NOT IN ('completed', 'cancelled')) as urgent
  FROM scheduled_jobs
  WHERE scheduled_jobs.tenant_id = p_tenant_id;
END;
$$;

-- Create a secure view for team_invitations that excludes tokens
-- This view shows invitation metadata without exposing the actual tokens
CREATE VIEW public.team_invitations_safe
WITH (security_invoker=on) AS
  SELECT 
    id,
    tenant_id,
    email,
    role,
    invited_by,
    expires_at,
    accepted_at,
    created_at
  FROM public.team_invitations;

-- Grant access to the view
GRANT SELECT ON public.team_invitations_safe TO authenticated;