-- First, recreate the update_demo_sandbox_session_by_token function that was dropped
CREATE OR REPLACE FUNCTION public.update_demo_sandbox_session_by_token(
  p_session_token text,
  p_features_explored jsonb DEFAULT NULL,
  p_pages_visited jsonb DEFAULT NULL,
  p_last_activity_at timestamptz DEFAULT NULL,
  p_converted_to_trial boolean DEFAULT NULL,
  p_converted_at timestamptz DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_name text DEFAULT NULL,
  p_company_name text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE demo_sandbox_sessions
  SET 
    features_explored = COALESCE(p_features_explored, features_explored),
    pages_visited = COALESCE(p_pages_visited, pages_visited),
    last_activity_at = COALESCE(p_last_activity_at, last_activity_at),
    converted_to_trial = COALESCE(p_converted_to_trial, converted_to_trial),
    converted_at = COALESCE(p_converted_at, converted_at),
    email = COALESCE(p_email, email),
    name = COALESCE(p_name, name),
    company_name = COALESCE(p_company_name, company_name)
  WHERE session_token = p_session_token AND expires_at > now();
  RETURN FOUND;
END;
$$;