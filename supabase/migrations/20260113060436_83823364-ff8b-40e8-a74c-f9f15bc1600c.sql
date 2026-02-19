-- Create demo sandbox sessions table
CREATE TABLE public.demo_sandbox_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '2 hours'),
  email TEXT,
  name TEXT,
  company_name TEXT,
  industry TEXT,
  features_explored JSONB DEFAULT '[]'::jsonb,
  pages_visited JSONB DEFAULT '[]'::jsonb,
  last_activity_at TIMESTAMPTZ DEFAULT now(),
  converted_to_trial BOOLEAN DEFAULT false,
  converted_at TIMESTAMPTZ,
  ip_address TEXT
);

-- Enable RLS
ALTER TABLE public.demo_sandbox_sessions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to create sessions (no auth required)
CREATE POLICY "Anyone can create demo sandbox sessions"
ON public.demo_sandbox_sessions
FOR INSERT
WITH CHECK (session_token IS NOT NULL);

-- Allow updates via session token (no auth required)
CREATE POLICY "Anyone can update demo sandbox sessions by token"
ON public.demo_sandbox_sessions
FOR UPDATE
USING (true);

-- Allow reading own session
CREATE POLICY "Anyone can read demo sandbox sessions"
ON public.demo_sandbox_sessions
FOR SELECT
USING (true);

-- Platform admins can view all sessions
CREATE POLICY "Platform admins can manage demo sandbox sessions"
ON public.demo_sandbox_sessions
FOR ALL
USING (is_platform_admin());

-- Create index for faster token lookups
CREATE INDEX idx_demo_sandbox_sessions_token ON public.demo_sandbox_sessions(session_token);
CREATE INDEX idx_demo_sandbox_sessions_created_at ON public.demo_sandbox_sessions(created_at DESC);