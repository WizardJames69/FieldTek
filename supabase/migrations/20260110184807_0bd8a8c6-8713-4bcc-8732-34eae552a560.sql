-- Create storage bucket for demo audio files
INSERT INTO storage.buckets (id, name, public)
VALUES ('demo-audio', 'demo-audio', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to demo audio files
CREATE POLICY "Public can view demo audio"
ON storage.objects
FOR SELECT
USING (bucket_id = 'demo-audio');

-- Allow authenticated users to upload demo audio (for the edge function using service role)
CREATE POLICY "Service can upload demo audio"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'demo-audio');