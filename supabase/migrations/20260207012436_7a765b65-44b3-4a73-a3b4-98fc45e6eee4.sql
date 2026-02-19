
-- Add country column to tenant_settings if it exists, otherwise add to tenants
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tenant_settings') THEN
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenant_settings' AND column_name = 'country') THEN
      ALTER TABLE public.tenant_settings ADD COLUMN country TEXT DEFAULT 'US';
    END IF;
  ELSE
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'country') THEN
      ALTER TABLE public.tenants ADD COLUMN country TEXT DEFAULT 'US';
    END IF;
  END IF;
END $$;
