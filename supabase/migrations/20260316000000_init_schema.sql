-- SQL Script to set up the Personal Light Novel Reader Database

-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- ==========================================
-- 1. Create Tables
-- ==========================================

-- Novels Table
create table public.novels (
    id uuid default uuid_generate_v4() primary key,
    title text not null,
    url text not null unique,
    cover_url text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Chapters Table
create table public.chapters (
    id uuid default uuid_generate_v4() primary key,
    novel_id uuid references public.novels(id) on delete cascade not null,
    title text not null,
    chapter_index integer not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(novel_id, chapter_index)
);

-- Contents Table (Stores the individual blocks of a chapter)
create table public.contents (
    id uuid default uuid_generate_v4() primary key,
    chapter_id uuid references public.chapters(id) on delete cascade not null,
    type text not null check (type in ('title', 'text', 'dialog', 'image', 'paragraph')),
    content text,
    image_url text,
    position integer not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(chapter_id, position)
);

-- ==========================================
-- 2. Performance Indexes
-- ==========================================
create index idx_chapters_novel_id on public.chapters(novel_id);
create index idx_contents_chapter_id on public.contents(chapter_id);

-- ==========================================
-- 3. Row Level Security (RLS)
-- ==========================================

-- Enable RLS on all tables
alter table public.novels enable row level security;
alter table public.chapters enable row level security;
alter table public.contents enable row level security;

-- Policies for public reading (anon key can read)
create policy "Allow public read-only access on novels"
    on public.novels for select
    using (true);

create policy "Allow public read-only access on chapters"
    on public.chapters for select
    using (true);

create policy "Allow public read-only access on contents"
    on public.contents for select
    using (true);

-- Policies for service role (Service role key bypasses RLS, so edge functions and scraper can insert/update)
-- This is handled automatically by Postgres when using the service_role key.
