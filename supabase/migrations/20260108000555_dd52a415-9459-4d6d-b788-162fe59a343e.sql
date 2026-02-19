-- Create rate limiting table for service requests
CREATE TABLE public.rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  identifier TEXT NOT NULL,
  identifier_type TEXT NOT NULL CHECK (identifier_type IN ('ip', 'email')),
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for fast lookups
CREATE INDEX idx_rate_limits_lookup ON public.rate_limits (identifier, identifier_type, window_start);

-- Enable RLS (but allow service role to bypass)
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- No public access - only service role can access this table
-- This is intentional as rate limiting is handled server-side only

-- Create function to cleanup old rate limit records (older than 1 hour)
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.rate_limits 
  WHERE window_start < now() - INTERVAL '1 hour';
END;
$$;