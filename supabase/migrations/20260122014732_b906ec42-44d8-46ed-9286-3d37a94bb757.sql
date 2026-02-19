-- Add new onboarding milestone columns
ALTER TABLE public.onboarding_progress
ADD COLUMN IF NOT EXISTS first_document_uploaded boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS first_document_uploaded_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS first_service_request_received boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS first_service_request_received_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS stripe_connect_completed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS stripe_connect_completed_at timestamp with time zone;