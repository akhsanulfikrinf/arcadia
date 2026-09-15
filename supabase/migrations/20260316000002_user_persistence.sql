-- Add User Persistence (Profiles, Bookmarks, and History)

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT UNIQUE NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. User Bookmarks
CREATE TABLE IF NOT EXISTS public.bookmarks (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    chapter_id uuid REFERENCES public.chapters(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(profile_id, chapter_id)
);

-- 3. Reading History
CREATE TABLE IF NOT EXISTS public.reading_history (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    novel_id uuid REFERENCES public.novels(id) ON DELETE CASCADE NOT NULL,
    chapter_id uuid REFERENCES public.chapters(id) ON DELETE CASCADE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(profile_id, novel_id, chapter_id)
);

-- Add Indexes
CREATE INDEX IF NOT EXISTS idx_bookmarks_profile ON public.bookmarks(profile_id);
CREATE INDEX IF NOT EXISTS idx_history_profile ON public.reading_history(profile_id);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_history ENABLE ROW LEVEL SECURITY;

-- Simple Policies (Allow everyone for now since it's a personal reader, 
-- or you can restrict to authenticated users if using Supabase Auth)
CREATE POLICY "Allow all access to profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to bookmarks" ON public.bookmarks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to history" ON public.reading_history FOR ALL USING (true) WITH CHECK (true);

-- Insert the default "Sucry" user if it doesn't exist
INSERT INTO public.profiles (username, display_name) 
VALUES ('Sucry', 'Sucry') 
ON CONFLICT (username) DO NOTHING;
