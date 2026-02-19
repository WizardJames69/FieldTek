
ALTER TABLE public.tenants 
  ALTER COLUMN trial_ends_at SET DEFAULT (now() + interval '30 days');

ALTER TABLE public.tenants 
  ADD COLUMN IF NOT EXISTS is_beta_founder BOOLEAN DEFAULT false;

-- Update the handle_new_user or tenant creation logic to read is_beta_founder from user metadata
-- We'll create a function that the existing tenant creation trigger can call
CREATE OR REPLACE FUNCTION public.set_beta_founder_on_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_beta_founder BOOLEAN;
  v_user_record RECORD;
BEGIN
  -- Look up the user's metadata to check if they're a beta founder
  SELECT raw_user_meta_data INTO v_user_record FROM auth.users WHERE id = NEW.owner_id;
  
  v_is_beta_founder := COALESCE((v_user_record.raw_user_meta_data->>'is_beta_founder')::boolean, false);
  
  IF v_is_beta_founder THEN
    NEW.is_beta_founder := true;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on tenants table to set is_beta_founder before insert
DROP TRIGGER IF EXISTS set_beta_founder_trigger ON public.tenants;
CREATE TRIGGER set_beta_founder_trigger
  BEFORE INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.set_beta_founder_on_tenant();
