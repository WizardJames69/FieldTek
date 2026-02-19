-- Add Stripe Connect fields to tenants table
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS stripe_connect_account_id TEXT;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS stripe_connect_status TEXT DEFAULT 'not_connected';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS stripe_connect_onboarded_at TIMESTAMPTZ;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_tenants_stripe_connect_account_id ON public.tenants(stripe_connect_account_id) WHERE stripe_connect_account_id IS NOT NULL;