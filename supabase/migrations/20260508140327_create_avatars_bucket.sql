-- Create the avatars storage bucket for user profile avatar uploads.
-- Public bucket so avatars can be served without auth tokens.
-- Users can only upload/delete within their own {user_id}/ folder.

DO $$ BEGIN
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'avatars',
    'avatars',
    true,
    2097152, -- 2 MB
    ARRAY['image/png', 'image/jpeg', 'image/webp']
  );
EXCEPTION WHEN unique_violation THEN NULL;
END $$;

-- Authenticated users can upload avatars to their own folder
DO $$ BEGIN
  CREATE POLICY "Users can upload own avatar"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'avatars'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Anyone can view avatars (public bucket)
DO $$ BEGIN
  CREATE POLICY "Public read access for avatars"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'avatars');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Users can update their own avatars (overwrite)
DO $$ BEGIN
  CREATE POLICY "Users can update own avatar"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'avatars'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Users can delete their own avatars
DO $$ BEGIN
  CREATE POLICY "Users can delete own avatar"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'avatars'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
