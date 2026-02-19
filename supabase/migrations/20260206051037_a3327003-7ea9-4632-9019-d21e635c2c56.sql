-- Add email tracking columns to beta_applications
ALTER TABLE public.beta_applications 
ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS email_error TEXT;