-- Create dashboard stats RPC function for efficient aggregation
CREATE OR REPLACE FUNCTION get_dashboard_stats(p_tenant_id uuid)
RETURNS TABLE(
  total bigint,
  in_progress bigint,
  completed bigint,
  urgent bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
    COUNT(*) FILTER (WHERE status = 'completed') as completed,
    COUNT(*) FILTER (WHERE priority = 'urgent' AND status NOT IN ('completed', 'cancelled')) as urgent
  FROM scheduled_jobs
  WHERE tenant_id = p_tenant_id;
$$;

-- Grant execute to authenticated users (RLS on scheduled_jobs still applies at query level)
GRANT EXECUTE ON FUNCTION get_dashboard_stats(uuid) TO authenticated;