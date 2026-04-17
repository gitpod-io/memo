-- Create the page-images storage bucket for editor image uploads.
-- Public bucket so images can be served without auth tokens.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'page-images',
  'page-images',
  true,
  5242880, -- 5 MB
  ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can upload images
DO $$ BEGIN
  CREATE POLICY "Authenticated users can upload page images"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'page-images');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Anyone can view uploaded images (public bucket)
DO $$ BEGIN
  CREATE POLICY "Public read access for page images"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'page-images');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Image owners can delete their uploads
DO $$ BEGIN
  CREATE POLICY "Users can delete own page images"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'page-images' AND (storage.foldername(name))[1] = 'uploads' AND auth.uid() = owner);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
