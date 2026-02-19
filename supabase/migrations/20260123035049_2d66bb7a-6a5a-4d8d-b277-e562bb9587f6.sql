-- Create waitlist_signups table
CREATE TABLE public.waitlist_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  company_name TEXT,
  technician_count TEXT,
  industry TEXT,
  source TEXT DEFAULT 'landing_page',
  created_at TIMESTAMPTZ DEFAULT now(),
  notified_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY;

-- Platform admins can manage waitlist
CREATE POLICY "Platform admins can manage waitlist"
ON public.waitlist_signups FOR ALL
USING (public.is_platform_admin());

-- Allow anonymous inserts for waitlist signups
CREATE POLICY "Anyone can join waitlist"
ON public.waitlist_signups FOR INSERT
WITH CHECK (true);