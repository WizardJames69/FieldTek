-- Create tutorials table for video metadata
CREATE TABLE public.tutorials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  video_url text, -- Nullable since videos are uploaded separately
  thumbnail_url text,
  duration_seconds integer NOT NULL DEFAULT 60,
  category text NOT NULL DEFAULT 'getting-started',
  feature_key text, -- Links to specific feature for contextual display
  display_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create user tutorial progress table
CREATE TABLE public.user_tutorial_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tutorial_id uuid NOT NULL REFERENCES public.tutorials(id) ON DELETE CASCADE,
  watched_at timestamptz NOT NULL DEFAULT now(),
  completed boolean NOT NULL DEFAULT false,
  watch_duration_seconds integer DEFAULT 0,
  UNIQUE(user_id, tutorial_id)
);

-- Enable RLS
ALTER TABLE public.tutorials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tutorial_progress ENABLE ROW LEVEL SECURITY;

-- Tutorials are publicly readable (for demo users too)
CREATE POLICY "Anyone can view published tutorials"
  ON public.tutorials FOR SELECT
  USING (is_published = true);

-- Platform admins can manage tutorials
CREATE POLICY "Platform admins can manage tutorials"
  ON public.tutorials FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- Users can view their own progress
CREATE POLICY "Users can view own tutorial progress"
  ON public.user_tutorial_progress FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own progress
CREATE POLICY "Users can track own tutorial progress"
  ON public.user_tutorial_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own progress
CREATE POLICY "Users can update own tutorial progress"
  ON public.user_tutorial_progress FOR UPDATE
  USING (auth.uid() = user_id);

-- Deny anonymous access
CREATE POLICY "Deny anonymous access to user_tutorial_progress"
  ON public.user_tutorial_progress FOR SELECT
  USING (false);

-- Create storage bucket for tutorial videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('tutorials', 'tutorials', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to tutorial videos
CREATE POLICY "Anyone can view tutorial videos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'tutorials');

-- Platform admins can upload tutorial videos
CREATE POLICY "Admins can upload tutorial videos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'tutorials' AND is_platform_admin());

CREATE POLICY "Admins can update tutorial videos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'tutorials' AND is_platform_admin());

CREATE POLICY "Admins can delete tutorial videos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'tutorials' AND is_platform_admin());

-- Add index for feature-based lookups
CREATE INDEX idx_tutorials_feature_key ON public.tutorials(feature_key) WHERE feature_key IS NOT NULL;
CREATE INDEX idx_tutorials_category ON public.tutorials(category);
CREATE INDEX idx_user_tutorial_progress_user ON public.user_tutorial_progress(user_id);

-- Insert initial tutorial metadata (videos to be uploaded separately)
INSERT INTO public.tutorials (title, description, category, feature_key, duration_seconds, display_order) VALUES
  ('Getting Started with FieldTek', 'A quick overview of the platform and key features', 'getting-started', 'onboarding', 180, 1),
  ('Creating Your First Job', 'Learn how to create and schedule a new job', 'jobs', 'jobs', 120, 2),
  ('Drag & Drop Scheduling', 'Master the schedule board with drag and drop', 'scheduling', 'schedule', 90, 3),
  ('Using the AI Assistant', 'Get help from the AI field assistant', 'ai', 'assistant', 150, 4),
  ('Bulk Operations', 'Efficiently manage multiple records at once', 'advanced', 'bulk-actions', 120, 5),
  ('Document Upload & OCR', 'Upload documents and extract text automatically', 'documents', 'documents', 150, 6),
  ('Invoice Generation', 'Create and send invoices from completed jobs', 'invoicing', 'invoices', 180, 7),
  ('Customer Portal Setup', 'Set up client access to their service history', 'portal', 'portal', 180, 8),
  ('Team Management', 'Invite team members and manage roles', 'team', 'team', 120, 9),
  ('Settings & Configuration', 'Customize FieldTek for your business', 'settings', 'settings', 180, 10);