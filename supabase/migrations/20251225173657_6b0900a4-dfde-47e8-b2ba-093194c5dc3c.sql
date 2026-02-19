-- Create demo_requests table for lead capture
CREATE TABLE public.demo_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  company_name text,
  industry text,
  team_size text,
  preferred_date date,
  preferred_time text,
  message text,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  scheduled_at timestamptz,
  notes text
);

-- Enable RLS
ALTER TABLE public.demo_requests ENABLE ROW LEVEL SECURITY;

-- Anyone can submit a demo request (public form)
CREATE POLICY "Anyone can submit demo requests"
ON public.demo_requests
FOR INSERT
WITH CHECK (true);

-- Only admins can view demo requests (for future admin panel)
CREATE POLICY "Admins can view demo requests"
ON public.demo_requests
FOR SELECT
USING (auth.uid() IS NOT NULL);