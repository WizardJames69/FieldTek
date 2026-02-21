-- Expand the rate_limits identifier_type CHECK constraint to include all types
-- used by edge functions. Five types were missing and causing insert failures:
-- invoice_payment_ip, invoice_payment_invoice, tenant_api, validate_access_code, waitlist_email
ALTER TABLE public.rate_limits DROP CONSTRAINT IF EXISTS rate_limits_identifier_type_check;

ALTER TABLE public.rate_limits ADD CONSTRAINT rate_limits_identifier_type_check
CHECK (identifier_type = ANY (ARRAY[
  'ip'::text,
  'email'::text,
  'client'::text,
  'contact_form_ip'::text,
  'contact_form_email'::text,
  'demo_request_email'::text,
  'invoice_payment_ip'::text,
  'invoice_payment_invoice'::text,
  'tenant_api'::text,
  'validate_access_code'::text,
  'waitlist_email'::text
]));

-- Update cleanup to handle 24h windows (notify-demo-request uses calendar-day windows)
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.rate_limits
  WHERE window_start < now() - INTERVAL '24 hours';
END;
$$;
