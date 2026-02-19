-- Drop the existing CHECK constraint on identifier_type
ALTER TABLE rate_limits DROP CONSTRAINT IF EXISTS rate_limits_identifier_type_check;

-- Add updated CHECK constraint with additional identifier types for contact and demo forms
ALTER TABLE rate_limits ADD CONSTRAINT rate_limits_identifier_type_check 
CHECK (identifier_type = ANY (ARRAY[
  'ip'::text, 
  'email'::text, 
  'client'::text, 
  'contact_form_ip'::text, 
  'contact_form_email'::text,
  'demo_request_email'::text
]));