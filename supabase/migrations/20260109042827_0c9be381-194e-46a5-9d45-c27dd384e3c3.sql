-- Add columns for IP tracking, max duration, and auto-end status
ALTER TABLE public.demo_sessions 
ADD COLUMN IF NOT EXISTS ip_address TEXT,
ADD COLUMN IF NOT EXISTS max_duration_seconds INTEGER DEFAULT 120,
ADD COLUMN IF NOT EXISTS auto_ended BOOLEAN DEFAULT false;

-- Create index for IP-based rate limiting queries
CREATE INDEX IF NOT EXISTS idx_demo_sessions_ip_started 
ON public.demo_sessions(ip_address, started_at);