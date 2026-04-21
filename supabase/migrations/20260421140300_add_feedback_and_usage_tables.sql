-- User feedback and usage events tables for the feedback tool.
-- Includes RLS policies and a storage bucket for screenshot attachments.

-- =============================================================================
-- 1. Tables
-- =============================================================================

-- user_feedback: stores user-submitted feedback (bugs, features, general)
create table user_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('bug', 'feature', 'general')),
  message text not null,
  page_path text,
  page_title text,
  screenshot_url text,
  metadata jsonb,
  status text not null default 'new' check (status in ('new', 'reviewed', 'actioned', 'dismissed')),
  created_at timestamptz not null default now()
);

-- usage_events: server-side product analytics
create table usage_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid,
  page_path text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- Index for efficient digest queries on usage_events
create index usage_events_name_created on usage_events (event_name, created_at);

-- =============================================================================
-- 2. Row Level Security
-- =============================================================================

alter table user_feedback enable row level security;
alter table usage_events enable row level security;

-- user_feedback: authenticated users can INSERT their own feedback only
create policy "users can insert own feedback"
  on user_feedback for insert
  to authenticated
  with check (user_id = auth.uid());

-- usage_events: authenticated users can INSERT their own events only
create policy "users can insert own usage events"
  on usage_events for insert
  to authenticated
  with check (user_id = auth.uid());

-- =============================================================================
-- 3. Storage bucket for feedback screenshots
-- =============================================================================

DO $$ BEGIN
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'feedback-screenshots',
    'feedback-screenshots',
    true,
    5242880, -- 5 MB
    ARRAY['image/png', 'image/jpeg', 'image/webp']
  );
EXCEPTION WHEN unique_violation THEN NULL;
END $$;

-- Authenticated users can upload screenshots
DO $$ BEGIN
  CREATE POLICY "Authenticated users can upload feedback screenshots"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'feedback-screenshots');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Anyone can view uploaded screenshots (public bucket)
DO $$ BEGIN
  CREATE POLICY "Public read access for feedback screenshots"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'feedback-screenshots');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Users can delete their own screenshots
DO $$ BEGIN
  CREATE POLICY "Users can delete own feedback screenshots"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'feedback-screenshots' AND auth.uid() = owner);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
