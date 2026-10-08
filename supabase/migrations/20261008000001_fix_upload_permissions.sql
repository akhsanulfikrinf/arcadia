-- Fix permissions for manual upload

-- Allow authenticated users to insert and update novels and chapters
CREATE POLICY "Users can insert novels" ON public.novels FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update novels" ON public.novels FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert chapters" ON public.chapters FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update chapters" ON public.chapters FOR UPDATE USING (auth.role() = 'authenticated');

-- Allow authenticated users to upload to storage
CREATE POLICY "Users can upload novel contents" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'novel-contents' AND auth.role() = 'authenticated');
CREATE POLICY "Users can update novel contents" ON storage.objects FOR UPDATE USING (bucket_id = 'novel-contents' AND auth.role() = 'authenticated');

-- Update bucket to allow images (for cover uploads)
UPDATE storage.buckets 
SET allowed_mime_types = ARRAY['application/json', 'image/jpeg', 'image/png', 'image/webp'] 
WHERE id = 'novel-contents';
