-- Create demo_sessions table to track product demo usage
CREATE TABLE public.demo_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_token TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  completed BOOLEAN DEFAULT false,
  lead_captured BOOLEAN DEFAULT false,
  scenes_viewed JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.demo_sessions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to create a demo session (for anonymous visitors)
CREATE POLICY "Anyone can create demo sessions"
ON public.demo_sessions
FOR INSERT
WITH CHECK (true);

-- Users can view their own sessions
CREATE POLICY "Users can view own demo sessions"
ON public.demo_sessions
FOR SELECT
USING (user_id = auth.uid() OR user_id IS NULL);

-- Users can update their own sessions
CREATE POLICY "Users can update own demo sessions"
ON public.demo_sessions
FOR UPDATE
USING (user_id = auth.uid() OR user_id IS NULL);

-- Add index for faster lookups
CREATE INDEX idx_demo_sessions_user_id ON public.demo_sessions(user_id);
CREATE INDEX idx_demo_sessions_started_at ON public.demo_sessions(started_at DESC);