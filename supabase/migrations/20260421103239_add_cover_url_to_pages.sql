-- Add cover_url column to pages table for page cover images.
-- Nullable text column storing the public URL of the uploaded cover image.
ALTER TABLE pages ADD COLUMN cover_url text;