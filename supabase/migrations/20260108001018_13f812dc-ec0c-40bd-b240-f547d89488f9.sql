-- Update the check constraint to allow 'client' as an identifier type
ALTER TABLE public.rate_limits DROP CONSTRAINT IF EXISTS rate_limits_identifier_type_check;
ALTER TABLE public.rate_limits ADD CONSTRAINT rate_limits_identifier_type_check 
  CHECK (identifier_type IN ('ip', 'email', 'client'));