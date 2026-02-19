-- Recreate the security definer function to lookup session by token
CREATE OR REPLACE FUNCTION public.get_demo_session_by_token(p_session_token text)
RETURNS TABLE (
  id uuid,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  completed boolean,
  scenes_viewed jsonb,
  max_duration_seconds integer,
  auto_ended boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id,
    started_at,
    ended_at,
    duration_seconds,
    completed,
    scenes_viewed,
    max_duration_seconds,
    auto_ended
  FROM demo_sessions
  WHERE session_token = p_session_token
  LIMIT 1;
$$;

-- Recreate security definer function to lookup sandbox session by token
CREATE OR REPLACE FUNCTION public.get_demo_sandbox_session_by_token(p_session_token text)
RETURNS TABLE (
  id uuid,
  industry text,
  expires_at timestamptz,
  features_explored jsonb,
  pages_visited jsonb,
  last_activity_at timestamptz,
  converted_to_trial boolean,
  email text,
  name text,
  company_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id,
    industry,
    expires_at,
    features_explored,
    pages_visited,
    last_activity_at,
    converted_to_trial,
    email,
    name,
    company_name
  FROM demo_sandbox_sessions
  WHERE session_token = p_session_token AND expires_at > now()
  LIMIT 1;
$$;

-- Recreate security definer function to update demo session by token
CREATE OR REPLACE FUNCTION public.update_demo_session_by_token(
  p_session_token text,
  p_ended_at timestamptz DEFAULT NULL,
  p_duration_seconds integer DEFAULT NULL,
  p_completed boolean DEFAULT NULL,
  p_lead_captured boolean DEFAULT NULL,
  p_scenes_viewed jsonb DEFAULT NULL,
  p_auto_ended boolean DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE demo_sessions
  SET 
    ended_at = COALESCE(p_ended_at, ended_at),
    duration_seconds = COALESCE(p_duration_seconds, duration_seconds),
    completed = COALESCE(p_completed, completed),
    lead_captured = COALESCE(p_lead_captured, lead_captured),
    scenes_viewed = COALESCE(p_scenes_viewed, scenes_viewed),
    auto_ended = COALESCE(p_auto_ended, auto_ended)
  WHERE session_token = p_session_token;
  RETURN FOUND;
END;
$$;