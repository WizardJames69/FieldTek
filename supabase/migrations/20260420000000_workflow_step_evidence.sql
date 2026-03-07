-- Workflow Step Evidence: verifiable proof for checklist item completions
-- Additive migration — no existing tables modified destructively

-- 1. Create workflow_step_evidence table
CREATE TABLE public.workflow_step_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  job_id UUID NOT NULL REFERENCES public.scheduled_jobs(id) ON DELETE CASCADE,
  checklist_item_id TEXT NOT NULL,
  stage_name TEXT NOT NULL,
  technician_id UUID NOT NULL REFERENCES auth.users(id),
  evidence_type TEXT NOT NULL CHECK (evidence_type IN ('photo', 'measurement', 'serial_scan', 'gps_checkin')),

  -- Photo evidence
  photo_url TEXT,

  -- Measurement evidence
  measurement_value DOUBLE PRECISION,
  measurement_unit TEXT,

  -- Serial/QR scan
  serial_number TEXT,

  -- GPS evidence
  gps_location JSONB,

  -- Timestamps
  device_timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Verification
  verification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'verified', 'failed', 'flagged')),
  verification_details JSONB,

  -- AI analysis (populated async by Sentinel)
  ai_analysis JSONB
);

-- Indexes
CREATE INDEX idx_step_evidence_job ON public.workflow_step_evidence(job_id);
CREATE INDEX idx_step_evidence_tenant ON public.workflow_step_evidence(tenant_id);
CREATE INDEX idx_step_evidence_checklist ON public.workflow_step_evidence(job_id, checklist_item_id);

-- RLS
ALTER TABLE public.workflow_step_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view evidence in their tenant"
  ON public.workflow_step_evidence FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Technicians can insert evidence"
  ON public.workflow_step_evidence FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id() AND technician_id = auth.uid());

CREATE POLICY "Admins can update evidence"
  ON public.workflow_step_evidence FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id() AND public.is_tenant_admin());

-- 2. Extend job_stage_templates with required_evidence column
ALTER TABLE public.job_stage_templates
  ADD COLUMN IF NOT EXISTS required_evidence JSONB DEFAULT '{}';

COMMENT ON COLUMN public.job_stage_templates.required_evidence IS
  'Per-item evidence requirements. Keys are checklist_item ids, values are requirement objects like {"photo": true, "measurement": {"unit": "PSI", "min": 50, "max": 500}, "gps_required": true, "serial_scan": true}.';

-- 3. Feature flag
INSERT INTO public.feature_flags (key, name, description, is_enabled, rollout_percentage, metadata)
VALUES (
  'workflow_step_verification',
  'Workflow Step Verification',
  'Require verifiable evidence (photos, measurements, GPS, serial scans) when completing workflow steps',
  false,
  0,
  '{"rollout_week": 1, "mode": "logging_only"}'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- 4. Add step_evidence_count to ai_audit_logs
ALTER TABLE public.ai_audit_logs
  ADD COLUMN IF NOT EXISTS step_evidence_count INTEGER DEFAULT 0;

-- 5. Storage bucket for job evidence photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'job-evidence',
  'job-evidence',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
CREATE POLICY "Tenant members can upload job evidence"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'job-evidence'
    AND (storage.foldername(name))[1] = public.get_user_tenant_id()::TEXT
  );

CREATE POLICY "Tenant members can view job evidence"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'job-evidence'
    AND (storage.foldername(name))[1] = public.get_user_tenant_id()::TEXT
  );
