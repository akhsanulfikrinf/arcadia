-- ============================================
-- Storage Setup for Novel Contents
-- ============================================

-- Create the storage bucket for novel content JSON files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'novel-contents',
  'novel-contents',
  true,
  52428800,  -- 50MB max file size
  ARRAY['application/json']
)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access (download) for anyone
CREATE POLICY "Public read access for novel contents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'novel-contents');

-- Allow service role to upload (INSERT) — this is implicit for service_role,
-- but we add an explicit policy for clarity
CREATE POLICY "Service role can upload novel contents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'novel-contents');

-- Allow service role to update (overwrite) existing files
CREATE POLICY "Service role can update novel contents"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'novel-contents');

-- Allow service role to delete files
CREATE POLICY "Service role can delete novel contents"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'novel-contents');

-- ============================================
-- Track Scraped Chapters (Storage or Database)
-- ============================================

-- Add is_scraped flag to chapters table
ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS is_scraped BOOLEAN DEFAULT false;

-- Backfill existing chapters that already have content in DB
UPDATE public.chapters c
SET is_scraped = true
WHERE EXISTS (SELECT 1 FROM public.contents cont WHERE cont.chapter_id = c.id);

-- Update RPC function for admin stats to check both is_scraped and contents table
CREATE OR REPLACE FUNCTION get_completed_chapters_count(n_id UUID)
RETURNS BIGINT AS $$
BEGIN
  RETURN (
    SELECT count(DISTINCT c.id)
    FROM public.chapters c
    WHERE c.novel_id = n_id
      AND (
        c.is_scraped = true
        OR EXISTS (SELECT 1 FROM public.contents cont WHERE cont.chapter_id = c.id)
      )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

