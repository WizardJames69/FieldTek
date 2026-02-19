-- Create RPC function to allow anonymous users to create demo sandbox sessions
-- This bypasses RLS while maintaining security by only exposing this specific operation

CREATE OR REPLACE FUNCTION public.create_demo_sandbox_session(
  p_industry TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_token TEXT;
BEGIN
  INSERT INTO public.demo_sandbox_sessions (
    industry,
    features_explored,
    pages_visited
  )
  VALUES (
    p_industry,
    '[]'::jsonb,
    '[]'::jsonb
  )
  RETURNING session_token INTO v_session_token;
  
  RETURN v_session_token;
END;
$$;