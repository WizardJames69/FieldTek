-- ============================================================
-- Phase 8E: Admin Re-embedding Wrapper
-- ============================================================
-- Wraps batch_mark_reembed with platform admin authorization
-- so it can be called from the admin UI via supabase.rpc().
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_trigger_reembed(p_limit INTEGER DEFAULT 50)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only platform admins (or service role) can trigger re-embedding
  IF current_setting('role', true) != 'service_role' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'Only platform admins can trigger re-embedding';
    END IF;
  END IF;

  RETURN batch_mark_reembed(p_limit);
END;
$$;
