-- Create feature_flags table for controlled feature rollouts
CREATE TABLE public.feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  is_enabled boolean NOT NULL DEFAULT false,
  rollout_percentage integer NOT NULL DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  allowed_tenant_ids uuid[] DEFAULT '{}',
  blocked_tenant_ids uuid[] DEFAULT '{}',
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Create indexes for fast lookups
CREATE INDEX idx_feature_flags_key ON public.feature_flags(key);
CREATE INDEX idx_feature_flags_is_enabled ON public.feature_flags(is_enabled);

-- Enable RLS
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- Deny anonymous access
CREATE POLICY "Deny anonymous access to feature_flags"
ON public.feature_flags
FOR SELECT
TO anon
USING (false);

-- Authenticated users can read flags (needed for evaluation)
CREATE POLICY "Authenticated users can read feature flags"
ON public.feature_flags
FOR SELECT
TO authenticated
USING (true);

-- Platform admins can manage all flags
CREATE POLICY "Platform admins can manage feature flags"
ON public.feature_flags
FOR ALL
TO authenticated
USING (is_platform_admin())
WITH CHECK (is_platform_admin());

-- Create trigger for updated_at
CREATE TRIGGER update_feature_flags_updated_at
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();