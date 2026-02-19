-- Create beta_feedback table for collecting user feedback during beta
CREATE TABLE public.beta_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('bug', 'feature', 'feedback', 'question')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  urgency TEXT DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high')),
  page_context TEXT,
  screenshot_url TEXT,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'in_progress', 'resolved', 'closed')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.beta_feedback ENABLE ROW LEVEL SECURITY;

-- Deny anonymous access
CREATE POLICY "Deny anonymous access to beta_feedback"
  ON public.beta_feedback
  FOR SELECT
  USING (false);

-- Users can insert their own feedback
CREATE POLICY "Users can create feedback"
  ON public.beta_feedback
  FOR INSERT
  WITH CHECK (auth.uid() = user_id AND user_belongs_to_tenant(tenant_id));

-- Users can view their own feedback
CREATE POLICY "Users can view own feedback"
  ON public.beta_feedback
  FOR SELECT
  USING (auth.uid() = user_id);

-- Platform admins can view all feedback
CREATE POLICY "Platform admins can view all feedback"
  ON public.beta_feedback
  FOR SELECT
  USING (is_platform_admin());

-- Platform admins can update feedback
CREATE POLICY "Platform admins can update feedback"
  ON public.beta_feedback
  FOR UPDATE
  USING (is_platform_admin());

-- Platform admins can delete feedback
CREATE POLICY "Platform admins can delete feedback"
  ON public.beta_feedback
  FOR DELETE
  USING (is_platform_admin());

-- Create trigger for updated_at
CREATE TRIGGER update_beta_feedback_updated_at
  BEFORE UPDATE ON public.beta_feedback
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for feedback screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('feedback-screenshots', 'feedback-screenshots', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for feedback screenshots
CREATE POLICY "Users can upload feedback screenshots"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'feedback-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own feedback screenshots"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'feedback-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Platform admins can view all feedback screenshots"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'feedback-screenshots' AND is_platform_admin());