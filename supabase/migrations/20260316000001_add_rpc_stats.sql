-- Function to count chapters with content for a specific novel
CREATE OR REPLACE FUNCTION get_completed_chapters_count(n_id UUID)
RETURNS BIGINT AS $$
BEGIN
  RETURN (
    SELECT count(DISTINCT c.id)
    FROM public.chapters c
    JOIN public.contents cont ON cont.chapter_id = c.id
    WHERE c.novel_id = n_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
