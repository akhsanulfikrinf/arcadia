-- ============================================
-- Auth Fixes Migration
-- ============================================

-- 1. Secure RPC for username→email lookup (no email exposed via RLS)
CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username TEXT)
RETURNS TEXT AS $$
  SELECT email FROM public.profiles WHERE username = p_username LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- 2. Fix reading_history constraint
-- Current: UNIQUE(profile_id, novel_id, chapter_id) — creates new row per chapter
-- Desired: UNIQUE(profile_id, novel_id) — tracks last chapter per novel per user
ALTER TABLE public.reading_history DROP CONSTRAINT IF EXISTS reading_history_profile_id_novel_id_chapter_id_key;

-- Deduplicate existing history keeping only the most recently updated chapter per (profile_id, novel_id)
DELETE FROM public.reading_history
WHERE id NOT IN (
  SELECT DISTINCT ON (profile_id, novel_id) id
  FROM public.reading_history
  ORDER BY profile_id, novel_id, updated_at DESC, id
);

ALTER TABLE public.reading_history ADD CONSTRAINT reading_history_profile_id_novel_id_key UNIQUE (profile_id, novel_id);

-- 3. Fix bookmarks & history RLS (currently wide open with 'Allow all access')
DROP POLICY IF EXISTS "Allow all access to bookmarks" ON public.bookmarks;
DROP POLICY IF EXISTS "Allow all access to history" ON public.reading_history;

CREATE POLICY "Users can view own bookmarks" ON public.bookmarks FOR SELECT USING (
  profile_id IN (SELECT id FROM profiles WHERE auth_id = auth.uid())
);
CREATE POLICY "Users can insert own bookmarks" ON public.bookmarks FOR INSERT WITH CHECK (
  profile_id IN (SELECT id FROM profiles WHERE auth_id = auth.uid())
);
CREATE POLICY "Users can delete own bookmarks" ON public.bookmarks FOR DELETE USING (
  profile_id IN (SELECT id FROM profiles WHERE auth_id = auth.uid())
);

CREATE POLICY "Users can view own history" ON public.reading_history FOR SELECT USING (
  profile_id IN (SELECT id FROM profiles WHERE auth_id = auth.uid())
);
CREATE POLICY "Users can insert own history" ON public.reading_history FOR INSERT WITH CHECK (
  profile_id IN (SELECT id FROM profiles WHERE auth_id = auth.uid())
);
CREATE POLICY "Users can update own history" ON public.reading_history FOR UPDATE USING (
  profile_id IN (SELECT id FROM profiles WHERE auth_id = auth.uid())
);

-- 4. Email sync trigger (update profiles.email when auth.users email changes)
CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS trigger AS $$
BEGIN
  UPDATE public.profiles SET email = new.email WHERE auth_id = new.id;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_update();

-- 5. Auto-link Sucry profile to auth user (find auth user with matching email)
-- This updates the Sucry profile's auth_id to match the auth.users entry
DO $$
DECLARE
  v_auth_id uuid;
  v_email text;
BEGIN
  -- Find the Sucry profile
  SELECT auth_id INTO v_auth_id FROM public.profiles WHERE username = 'Sucry';
  
  -- Only link if not already linked
  IF v_auth_id IS NULL THEN
    -- Try to find a matching auth user by looking at user metadata or email patterns
    SELECT id, email INTO v_auth_id, v_email
    FROM auth.users
    WHERE raw_user_meta_data->>'username' = 'Sucry'
       OR email LIKE 'sucry%'
       OR email LIKE 'akhsan%'
    LIMIT 1;
    
    IF v_auth_id IS NOT NULL THEN
      UPDATE public.profiles 
      SET auth_id = v_auth_id, email = v_email 
      WHERE username = 'Sucry';
      RAISE NOTICE 'Linked Sucry profile to auth user %', v_auth_id;
    END IF;
  END IF;
END;
$$;
